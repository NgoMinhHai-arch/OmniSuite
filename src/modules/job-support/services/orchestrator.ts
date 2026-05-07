import path from 'node:path';
import { promises as fs } from 'node:fs';
import type {
  JobSupportApiResponse,
  JobSupportErrorCode,
  JobSupportRequest,
  JobSupportRunResult,
  JobWorkspace,
} from '@/modules/job-support/domain/contracts';
import type { JobSupportAdapter } from '@/modules/job-support/services/adapters/baseAdapter';
import { AiResumeTailorAdapter } from '@/modules/job-support/services/adapters/aiResumeTailorAdapter';
import { ManualApplyAdapter, parseApplyJobUrls } from '@/modules/job-support/services/adapters/manualApplyAdapter';
import { VnJobsSerpAdapter } from '@/modules/job-support/services/adapters/vnJobsSerpAdapter';
import { integrationPath } from '@/modules/job-support/services/adapters/fsUtils';
import { mergeConfig } from '@/shared/lib/config';

type ApplyRateState = { day: string; count: number };

const TMP_DIR = path.join(process.cwd(), '.tmp', 'job-support-bridge');
const LAST_RUN_FILE = path.join(TMP_DIR, 'last-run.json');
const RATE_FILE = path.join(TMP_DIR, 'apply-rate-limit.json');
const MAX_APPLY_PER_DAY = 20;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readRateState(): Promise<ApplyRateState> {
  try {
    const raw = await fs.readFile(RATE_FILE, 'utf-8');
    return JSON.parse(raw) as ApplyRateState;
  } catch {
    return { day: todayKey(), count: 0 };
  }
}

async function writeRateState(state: ApplyRateState): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.writeFile(RATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function adapterFor(workspace: JobWorkspace): JobSupportAdapter {
  if (workspace === 'tailor-cv') return new AiResumeTailorAdapter();
  if (workspace === 'find-jobs') return new VnJobsSerpAdapter();
  return new ManualApplyAdapter();
}

function validateInput(req: JobSupportRequest): { ok: true } | { ok: false; code: JobSupportErrorCode; error: string; hint: string } {
  if (req.workspace === 'find-jobs' && !(req.jobTitle || req.location)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Thiếu tiêu chí tìm việc',
      hint: 'Nhập ít nhất Vị trí mục tiêu hoặc Địa điểm trước khi chạy để tránh tốn credit SerpApi vô ích.',
    };
  }
  if (req.workspace === 'tailor-cv' && !(req.jdText || req.jobUrl)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Thiếu JD để tailor CV',
      hint: 'Cần JD text hoặc Job URL trước khi chạy Tailor CV.',
    };
  }
  if (req.workspace === 'auto-apply') {
    const urls = parseApplyJobUrls(req);
    if (urls.length === 0) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: 'Chưa có link ứng tuyển',
        hint: 'Dán ít nhất một URL vào ô “Link ứng tuyển” (hoặc mỗi dòng một link).',
      };
    }
  }
  if (req.workspace === 'auto-apply' && req.mode === 'live' && !req.approved) {
    return {
      ok: false,
      code: 'MISSING_APPROVAL',
      error: 'Live batch chưa được duyệt',
      hint: 'Bật xác nhận (approved=true). Server không mở trình duyệt — bạn vẫn mở link và nộp tay trên máy.',
    };
  }
  return { ok: true };
}

async function enforceApplyRateLimit(req: JobSupportRequest): Promise<{ ok: true } | { ok: false; error: string; code: JobSupportErrorCode; hint: string }> {
  if (req.workspace !== 'auto-apply' || req.mode !== 'live') return { ok: true };
  const state = await readRateState();
  const day = todayKey();
  const normalized = state.day === day ? state : { day, count: 0 };
  if (normalized.count >= MAX_APPLY_PER_DAY) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      error: 'Đã chạm giới hạn xác nhận batch trong ngày',
      hint: `Giới hạn hiện tại là ${MAX_APPLY_PER_DAY} lần live batch/ngày. Thử lại ngày mai hoặc dùng dry-run.`,
    };
  }
  await writeRateState({ day, count: normalized.count + 1 });
  return { ok: true };
}

async function saveLastRun(output: JobSupportRunResult): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.writeFile(LAST_RUN_FILE, JSON.stringify(output, null, 2), 'utf-8');
}

export async function runWorkspace(req: JobSupportRequest): Promise<JobSupportApiResponse> {
  const validation = validateInput(req);
  if (!validation.ok) {
    return { ok: false, error: validation.error, errorCode: validation.code, hint: validation.hint };
  }

  const limiter = await enforceApplyRateLimit(req);
  if (!limiter.ok) {
    return { ok: false, error: limiter.error, errorCode: limiter.code, hint: limiter.hint };
  }

  const adapter = adapterFor(req.workspace);
  const preflight = await adapter.preflight({ request: req });
  if (!preflight.ok) {
    return { ok: false, error: 'Provider chưa sẵn sàng', errorCode: 'PROVIDER_NOT_READY', hint: preflight.hint };
  }

  const startedAt = new Date();
  const runId = `${Date.now()}-${req.workspace}`;
  const output = await adapter.execute({
    request: req,
    workspace: req.workspace,
    startedAt,
    runId,
  });
  await saveLastRun(output);
  return {
    ok: output.ok,
    output,
    error: output.ok ? undefined : 'Lệnh chạy thất bại',
    errorCode: output.errorCode,
    hint: output.hint,
  };
}

export async function readLastWorkspaceRun(): Promise<JobSupportRunResult | null> {
  try {
    const raw = await fs.readFile(LAST_RUN_FILE, 'utf-8');
    return JSON.parse(raw) as JobSupportRunResult;
  } catch {
    return null;
  }
}

export type JobSupportProviderRow = {
  provider: 'vn-job-feed' | 'manual-apply' | 'ai-resume-tailor';
  ready: boolean;
  cwd: string;
  setupHint: string[];
};

export async function getModernProviderStatuses(): Promise<JobSupportProviderRow[]> {
  const merged = mergeConfig({});
  const hasSerp =
    Boolean((merged.serpapi_key || '').trim()) || Boolean(process.env.SERPAPI_KEY?.trim?.());

  const rows: JobSupportProviderRow[] = [
    {
      provider: 'vn-job-feed',
      /** Client có thể gửi key trong body; có env thì báo ready chắc chắn */
      ready: true,
      cwd: path.join(process.cwd(), 'src', 'modules', 'job-support'),
      setupHint: hasSerp
        ? ['SerpApi: đã phát hiện key trong môi trường (hoặc cấu hình server).']
        : ['Mở Cài đặt → nhập SerpApi Key, hoặc đặt SERPAPI_KEY trong .env của Next.js.', 'Credit SerpApi: tối đa ~8 query mỗi lần chạy Find Jobs VN.'],
    },
    {
      provider: 'manual-apply',
      ready: true,
      cwd: path.join(process.cwd(), 'src', 'modules', 'job-support'),
      setupHint: ['Chế độ thủ công: không cần cài thêm CLI; chỉ dán danh sách URL.'],
    },
    {
      provider: 'ai-resume-tailor',
      ready: false,
      cwd: integrationPath('ai-resume-tailor'),
      setupHint: ['cd integrations/benchmarks/ai-resume-tailor', 'npm install', 'npm run dev'],
    },
  ];

  for (const row of rows) {
    if (row.provider !== 'ai-resume-tailor') continue;
    try {
      await fs.access(row.cwd);
      row.ready = true;
    } catch {
      row.ready = false;
    }
  }
  return rows;
}
