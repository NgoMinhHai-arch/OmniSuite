import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';

const PYTHON_BIN = process.env.PYTHON_BIN?.trim() || (process.platform === 'win32' ? 'python' : 'python3');

const OPEN_MANUS_MANUS_PY = path.join(
  process.cwd(),
  'integrations',
  'ai-support',
  'submodules',
  'open-manus',
  'app',
  'agent',
  'manus.py',
);

/** Khong import Manus (config.toml / Daytona — tranh false negative). Chi deps PyPI + submodule co ton tai. */
const OPEN_MANUS_DEPS_PROBE =
  'import pydantic, openai, loguru, yaml; print("ok")';

interface PythonProbe {
  ok: boolean;
  /** Stdout/stderr cuối — cắt ngắn để UI hiển thị gọn. */
  detail: string;
  /** Phân tích các package thiếu, cho UI hiển thị ngắn gọn. */
  missing: string[];
}

async function probePython(snippet: string, timeoutMs = 8000): Promise<PythonProbe> {
  return await new Promise<PythonProbe>((resolve) => {
    let settled = false;
    const finish = (probe: PythonProbe) => {
      if (settled) return;
      settled = true;
      resolve(probe);
    };
    let child: ReturnType<typeof spawn> | null = null;
    try {
      child = spawn(PYTHON_BIN, ['-c', snippet], { windowsHide: true });
    } catch (err) {
      finish({ ok: false, detail: err instanceof Error ? err.message : String(err), missing: ['python'] });
      return;
    }
    let buf = '';
    child.stdout?.on('data', (c: Buffer) => {
      buf += c.toString('utf-8');
    });
    child.stderr?.on('data', (c: Buffer) => {
      buf += c.toString('utf-8');
    });
    const killer = setTimeout(() => {
      try {
        child?.kill('SIGKILL');
      } catch {
        /* noop */
      }
      finish({ ok: false, detail: 'timeout', missing: ['python'] });
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(killer);
      finish({ ok: false, detail: err.message, missing: ['python'] });
    });
    child.on('close', (code) => {
      clearTimeout(killer);
      const text = buf.trim().slice(-800);
      const missing: string[] = [];
      if (/No module named/i.test(text)) missing.push('open_manus_deps');
      finish({ ok: code === 0, detail: text, missing });
    });
  });
}

/**
 * GET — báo capabilities thật của server cho UI:
 * runnerEnabled, python, openManus, browserUse, playwright, setupHint.
 */
export async function GET() {
  const runnerEnabled = (process.env.AI_SUPPORT_RUNNER_ENABLED || '').toLowerCase() === 'true';

  if (!runnerEnabled) {
    return NextResponse.json({
      runnerEnabled: false,
      python: false,
      openManus: false,
      browserUse: false,
      playwright: false,
      setupHint:
        'Bật runner: đặt AI_SUPPORT_RUNNER_ENABLED=true trong .env.\n' +
        'Sau đó:\n' +
        '  /run → npm run integrations:sync + scripts/setup-runners-venv.ps1 (OpenManus submodule + deps)\n' +
        '  /run-browser → cd integrations/ai-support/submodules/browser-use && pip install -e . && python -m playwright install chromium',
    });
  }

  const pyBase = await probePython('import sys; print("ok")');
  const pythonOk = pyBase.ok && !pyBase.missing.includes('python');

  const openManusSubmoduleOk = fs.existsSync(OPEN_MANUS_MANUS_PY);

  const [omDepsProbe, brProbe] = await Promise.all([
    probePython(OPEN_MANUS_DEPS_PROBE),
    probePython('import browser_use; import playwright; print("ok")'),
  ]);

  const openManusOk =
    openManusSubmoduleOk && omDepsProbe.ok && !omDepsProbe.missing.includes('open_manus_deps');
  const browserUseOk = brProbe.ok && !brProbe.missing.includes('browser_use');
  const playwrightOk = brProbe.ok && !brProbe.missing.includes('playwright');

  const hints: string[] = [];
  if (!pythonOk && pyBase.detail !== 'timeout') {
    hints.push('Không tìm thấy Python hoặc lỗi khởi chạy. Cài Python 3.10+ và đặt PYTHON_BIN nếu cần.');
  }
  if (!openManusSubmoduleOk && pythonOk) {
    hints.push('Thiếu submodule OpenManus: npm run integrations:sync');
  }
  if (openManusSubmoduleOk && !omDepsProbe.ok && pythonOk) {
    hints.push('/run (OpenManus deps): chạy scripts/setup-runners-venv.ps1 hoặc .sh');
  }
  if ((!browserUseOk || !playwrightOk) && pythonOk) {
    hints.push(
      '/run-browser: cd integrations/ai-support/submodules/browser-use → pip install -e . → python -m playwright install chromium',
    );
  }

  const setupHint = hints.length ? hints.join('\n') : null;

  return NextResponse.json({
    runnerEnabled: true,
    python: pythonOk,
    openManus: openManusOk,
    browserUse: browserUseOk,
    playwright: playwrightOk,
    detail: [
      openManusSubmoduleOk ? 'submodule:ok' : 'submodule:missing',
      omDepsProbe.detail,
      brProbe.detail,
    ]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 400),
    setupHint,
  });
}
