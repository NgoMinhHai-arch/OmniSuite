/**
 * AI Hỗ trợ Runner — OpenManus (mặc định /run), browser-use, ApplyPilot, job-scraper.
 *
 * Security gates (cả 3 phải đúng):
 *   1. AI_SUPPORT_RUNNER_ENABLED === 'true'        (default false)
 *   2. Header `x-internal-token` khớp AI_SUPPORT_RUNNER_SECRET nếu env có set (KHÔNG dùng INTERNAL_TOKEN — tránh trùng biến Windows)
 *   3. Body có task (string non-empty)
 *
 * Response:
 *   - NDJSON stream từ stdout của Python runner.
 *   - Content-Type: application/x-ndjson
 *   - Mỗi dòng là 1 JSON event (xem browser_runner.py).
 */

import { NextResponse } from 'next/server';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RunnerId = 'open_manus' | 'browser_use' | 'applypilot' | 'job_scraper';

interface RunBody {
  /** Mặc định open_manus (Quản gia /run). */
  runner?: RunnerId;
  task?: string;
  provider?: string;
  model?: string;
  ollama_base_url?: string;
  ollama_api_key?: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  /** Browser-use và OpenManus (BrowserUseTool): Playwright headless. */
  headless?: boolean;
  max_steps?: number;
  /** action cho applypilot: init | doctor | run | apply (mặc định doctor cho an toàn). */
  action?: string;
  /** workers cho applypilot run/apply (1-8). */
  workers?: number;
  /** dry_run cho applypilot apply. */
  dry_run?: boolean;
  /** input cho job_scraper: jd, resume_text… */
  jd?: string;
  resume_text?: string;
}

const PYTHON_BIN = process.env.PYTHON_BIN?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
const RUNNERS: Record<RunnerId, string> = {
  open_manus: 'integrations/ai-support/runners/open_manus_runner.py',
  browser_use: 'integrations/ai-support/runners/browser_runner.py',
  applypilot: 'integrations/ai-support/runners/applypilot_runner.py',
  job_scraper: 'integrations/ai-support/runners/job_scraper_runner.py',
};
/** Cứng giới hạn task không quá 4KB để tránh prompt khổng lồ. */
const MAX_TASK_LEN = 4000;

function isRunnerEnabled(): boolean {
  return (process.env.AI_SUPPORT_RUNNER_ENABLED || '').toLowerCase() === 'true';
}

function checkRunnerSecret(req: Request): { ok: boolean; reason?: string } {
  const expected = (process.env.AI_SUPPORT_RUNNER_SECRET || '').trim();
  if (!expected) return { ok: true };
  const got = (req.headers.get('x-internal-token') || '').trim();
  if (got !== expected) {
    return {
      ok: false,
      reason:
        'Runner secret không khớp. Đặt AI_SUPPORT_RUNNER_SECRET trong .env hoặc nhập cùng giá trị vào Cấu hình (internal_token).',
    };
  }
  return { ok: true };
}

function buildRejection(message: string, status = 403, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ type: 'error', error: message, ...extra }) + '\n',
    {
      status,
      headers: { 'Content-Type': 'application/x-ndjson' },
    },
  );
}

function sanitizePayload(body: RunBody, runner: RunnerId): RunBody | null {
  const cleaned: RunBody = { runner };
  if (body.provider) cleaned.provider = String(body.provider).slice(0, 32);
  if (body.model) cleaned.model = String(body.model).slice(0, 128);
  if (body.ollama_base_url) cleaned.ollama_base_url = String(body.ollama_base_url).slice(0, 256);
  if (body.openai_api_key) cleaned.openai_api_key = String(body.openai_api_key).slice(0, 256);
  if (body.gemini_api_key) cleaned.gemini_api_key = String(body.gemini_api_key).slice(0, 256);
  if (body.ollama_api_key) cleaned.ollama_api_key = String(body.ollama_api_key).slice(0, 256);

  if (runner === 'open_manus') {
    const task = (body.task || '').toString().trim();
    if (!task || task.length > MAX_TASK_LEN) return null;
    cleaned.task = task;
    if (typeof body.headless === 'boolean') cleaned.headless = body.headless;
    return cleaned;
  }

  if (runner === 'browser_use') {
    const task = (body.task || '').toString().trim();
    if (!task || task.length > MAX_TASK_LEN) return null;
    cleaned.task = task;
    if (typeof body.headless === 'boolean') cleaned.headless = body.headless;
    if (typeof body.max_steps === 'number' && Number.isFinite(body.max_steps)) {
      cleaned.max_steps = Math.min(Math.max(Math.floor(body.max_steps), 1), 100);
    }
    return cleaned;
  }

  if (runner === 'applypilot') {
    const allowedActions = ['doctor', 'init', 'run', 'apply'];
    const action = (body.action || 'doctor').toString().toLowerCase();
    if (!allowedActions.includes(action)) return null;
    cleaned.action = action;
    if (typeof body.workers === 'number' && Number.isFinite(body.workers)) {
      cleaned.workers = Math.min(Math.max(Math.floor(body.workers), 1), 8);
    }
    if (typeof body.dry_run === 'boolean') cleaned.dry_run = body.dry_run;
    return cleaned;
  }

  if (runner === 'job_scraper') {
    const jd = (body.jd || body.task || '').toString().trim();
    if (!jd || jd.length > MAX_TASK_LEN) return null;
    cleaned.jd = jd;
    if (body.resume_text) cleaned.resume_text = String(body.resume_text).slice(0, MAX_TASK_LEN * 2);
    return cleaned;
  }

  return null;
}

export async function POST(req: Request) {
  if (!isRunnerEnabled()) {
    return buildRejection(
      'AI_SUPPORT_RUNNER_ENABLED chưa bật. Đặt biến môi trường = true để cho phép Runner.',
      403,
      { setup_required: true },
    );
  }
  const secretCheck = checkRunnerSecret(req);
  if (!secretCheck.ok) {
    return buildRejection(secretCheck.reason || 'Forbidden', 403);
  }

  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return buildRejection('Body không phải JSON.', 400);
  }
  const runner: RunnerId = (body.runner as RunnerId) || 'open_manus';
  if (!Object.prototype.hasOwnProperty.call(RUNNERS, runner)) {
    return buildRejection(`runner không hợp lệ: ${runner}. Cho phép: ${Object.keys(RUNNERS).join(', ')}`, 400);
  }
  const payload = sanitizePayload(body, runner);
  if (!payload) {
    return buildRejection(`Thiếu/sai input cho runner=${runner}.`, 400);
  }

  const runnerPath = path.resolve(process.cwd(), RUNNERS[runner]);
  const child: ChildProcessWithoutNullStreams = spawn(PYTHON_BIN, [runnerPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1',
    },
    windowsHide: true,
  });

  let aborted = false;
  req.signal.addEventListener('abort', () => {
    aborted = true;
    try { child.kill('SIGTERM'); } catch { /* noop */ }
    setTimeout(() => {
      try { if (!child.killed) child.kill('SIGKILL'); } catch { /* noop */ }
    }, 1500);
  });

  try {
    child.stdin.write(JSON.stringify(payload) + '\n');
    child.stdin.end();
  } catch (err) {
    try { child.kill('SIGTERM'); } catch { /* noop */ }
    return buildRejection(`Không gửi được input cho runner: ${err instanceof Error ? err.message : String(err)}`, 500);
  }

  const encoder = new TextEncoder();
  let stderrBuf = '';

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const onStdout = (chunk: Buffer) => {
        controller.enqueue(chunk);
      };
      const onStderr = (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf-8');
        if (stderrBuf.length > 16_384) stderrBuf = stderrBuf.slice(-16_384);
      };
      const onError = (err: Error) => {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'error', error: `Spawn error: ${err.message}` }) + '\n'),
        );
      };
      const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
        if (aborted) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'aborted' }) + '\n'));
        } else if (code === 2) {
          // Setup required: runner đã in event setup_required → chỉ cần kết thúc.
        } else if (code !== 0) {
          const tail = stderrBuf.split('\n').filter(Boolean).slice(-4).join(' | ');
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'exit',
                code,
                signal,
                stderr_tail: tail,
              }) + '\n',
            ),
          );
        } else {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'exit', code: 0 }) + '\n'));
        }
        controller.close();
      };
      child.stdout.on('data', onStdout);
      child.stderr.on('data', onStderr);
      child.on('error', onError);
      child.on('close', onClose);
    },
    cancel() {
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Pre-flight nhẹ — báo trạng thái cả 3 runner. */
export async function GET() {
  if (!isRunnerEnabled()) {
    return NextResponse.json({
      enabled: false,
      reason: 'AI_SUPPORT_RUNNER_ENABLED chưa bật.',
      runners: Object.keys(RUNNERS),
    });
  }
  const checks = await Promise.all(
    (Object.keys(RUNNERS) as RunnerId[]).map(async (id) => {
      const probe = await new Promise<{ ok: boolean; detail: string }>((resolve) => {
        let snippet: string;
        if (id === 'open_manus') {
          snippet =
            'import pathlib; p=pathlib.Path("integrations/ai-support/submodules/open-manus/app/agent/manus.py"); print("ok" if p.is_file() else "missing")';
        } else if (id === 'browser_use') {
          snippet = 'import browser_use; import playwright; print("ok")';
        } else if (id === 'applypilot') {
          snippet = 'import applypilot; print("ok")';
        } else {
          snippet = 'import sys; sys.path.insert(0, "integrations/job-scraper"); import llm_client; print("ok")';
        }
        const child = spawn(PYTHON_BIN, ['-c', snippet], { windowsHide: true });
        let buf = '';
        child.stdout?.on('data', (c: Buffer) => { buf += c.toString('utf-8'); });
        child.stderr?.on('data', (c: Buffer) => { buf += c.toString('utf-8'); });
        child.on('error', (err) => resolve({ ok: false, detail: err.message }));
        child.on('close', (code) => resolve({ ok: code === 0, detail: buf.trim().slice(0, 400) }));
      });
      return { id, runnerPath: RUNNERS[id], ok: probe.ok, detail: probe.detail };
    }),
  );
  return NextResponse.json({
    enabled: true,
    pythonBin: PYTHON_BIN,
    runners: checks,
  });
}
