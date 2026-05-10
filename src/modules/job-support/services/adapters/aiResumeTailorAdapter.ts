import type { JobSupportRunResult } from '@/modules/job-support/domain/contracts';
import type { AdapterContext, JobSupportAdapter } from '@/modules/job-support/services/adapters/baseAdapter';
import { integrationPath, pathExists } from '@/modules/job-support/services/adapters/fsUtils';

function previewPrompt(ctx: AdapterContext): string {
  const title = ctx.request.jobTitle || 'Target role';
  const location = ctx.request.location || 'N/A';
  return [
    'Tailor CV request preview',
    `- Title: ${title}`,
    `- Location: ${location}`,
    `- JD length: ${(ctx.request.jdText || '').length}`,
    `- Resume length: ${(ctx.request.resumeText || '').length}`,
  ].join('\n');
}

const DEFAULT_TAILOR_URL = 'http://127.0.0.1:8082/api/job/tailor';

type ResumeRecord = Record<string, unknown>;

function resolveTailorEndpoint(): string {
  const fromEnv = process.env.PYTHON_JOB_TAILOR_URL?.trim() || process.env.AI_RESUME_TAILOR_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_TAILOR_URL;
}

function normalizeResumeInput(rawResumeText: string, fallbackTitle: string): ResumeRecord {
  const trimmed = rawResumeText.trim();
  if (!trimmed) {
    return {
      summary: '',
      experience: [],
      skills: [],
      targetRole: fallbackTitle || 'Target role',
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ResumeRecord;
    }
  } catch {
    // Fall back to plain-text mode below.
  }

  return {
    summary: trimmed,
    experience: [],
    skills: [],
    targetRole: fallbackTitle || 'Target role',
  };
}

function toPlainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => toPlainText(item)).filter(Boolean).join(' ');
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => toPlainText(item))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
  return new Set(tokens);
}

function computeMatchMetrics(jobDescription: string, tailoredResume: unknown): {
  overlapCount: number;
  jdTokenCount: number;
  overlapRatio: number;
  overlapSample: string[];
} {
  const jdTokens = tokenize(jobDescription);
  const resumeText = toPlainText(tailoredResume);
  const resumeTokens = tokenize(resumeText);
  const overlap = [...jdTokens].filter((token) => resumeTokens.has(token));
  const ratio = jdTokens.size > 0 ? overlap.length / jdTokens.size : 0;
  return {
    overlapCount: overlap.length,
    jdTokenCount: jdTokens.size,
    overlapRatio: Number(ratio.toFixed(4)),
    overlapSample: overlap.slice(0, 25),
  };
}

export class AiResumeTailorAdapter implements JobSupportAdapter {
  readonly provider = 'ai-resume-tailor' as const;
  readonly workspace = 'tailor-cv' as const;
  readonly cwd: string;

  constructor() {
    this.cwd = integrationPath('ai-resume-tailor');
  }

  async preflight(_ctx?: Pick<AdapterContext, 'request'>): Promise<{ ok: boolean; hint?: string }> {
    const exists = await pathExists(this.cwd);
    if (!exists) return { ok: false, hint: `Missing benchmark repo at ${this.cwd}` };
    const packageExists = await pathExists(`${this.cwd}\\package.json`);
    if (!packageExists) return { ok: false, hint: 'ai-resume-tailor missing package.json.' };
    return { ok: true };
  }

  async execute(ctx: AdapterContext): Promise<JobSupportRunResult> {
    const endpoint = resolveTailorEndpoint();
    const command = `POST ${endpoint}`;
    const resumeJson = normalizeResumeInput(ctx.request.resumeText || '', ctx.request.jobTitle || '');
    const resumeText = toPlainText(resumeJson);
    const jobDescription = (ctx.request.jdText || '').trim();
    if (!jobDescription) {
      const endedAt = new Date();
      return {
        id: ctx.runId,
        workspace: ctx.workspace,
        provider: this.provider,
        mode: 'dry-run',
        command,
        cwd: this.cwd,
        ok: false,
        exitCode: 1,
        durationMs: endedAt.getTime() - ctx.startedAt.getTime(),
        startedAt: ctx.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        stdout: previewPrompt(ctx),
        stderr: 'Missing JD text for tailoring request.',
        summary: 'CV tailoring failed: missing job description.',
        errorCode: 'INVALID_INPUT',
        hint: 'Nhập JD text trước khi chạy Tailor CV.',
      };
    }

    let responseStatus = 0;
    let rawBody = '';
    let tailoredResume: unknown;
    let requestFailed = false;
    let requestErrorMessage = '';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: jobDescription,
        }),
      });
      responseStatus = response.status;
      rawBody = await response.text();
      try {
        tailoredResume = JSON.parse(rawBody);
      } catch {
        tailoredResume = null;
      }
      if (!response.ok) {
        requestFailed = true;
        const errText =
          tailoredResume && typeof tailoredResume === 'object' && !Array.isArray(tailoredResume)
            ? String((tailoredResume as Record<string, unknown>).error || '').trim()
            : '';
        requestErrorMessage = errText || `ai-resume-tailor returned HTTP ${response.status}`;
      }
    } catch (error) {
      requestFailed = true;
      requestErrorMessage = error instanceof Error ? error.message : 'Failed to call ai-resume-tailor endpoint';
    }

    const endedAt = new Date();
    const preview = previewPrompt(ctx);
    const stdoutParts = [preview];
    if (!requestFailed && tailoredResume !== null && tailoredResume !== undefined) {
      stdoutParts.push(JSON.stringify(tailoredResume, null, 2));
    } else if (rawBody.trim()) {
      stdoutParts.push(rawBody.trim());
    }
    const combinedStdout = stdoutParts.join('\n\n');
    const tailoredText =
      tailoredResume && typeof tailoredResume === 'object' && !Array.isArray(tailoredResume)
        ? String((tailoredResume as Record<string, unknown>).tailored_resume || '')
        : '';
    const matchScore =
      tailoredResume && typeof tailoredResume === 'object' && !Array.isArray(tailoredResume)
        ? Number((tailoredResume as Record<string, unknown>).match_score ?? NaN)
        : NaN;
    const suggestions =
      tailoredResume && typeof tailoredResume === 'object' && !Array.isArray(tailoredResume)
        ? (Array.isArray((tailoredResume as Record<string, unknown>).suggestions)
            ? ((tailoredResume as Record<string, unknown>).suggestions as unknown[])
                .map((x) => String(x))
                .filter(Boolean)
            : [])
        : [];
    const metrics = !requestFailed ? computeMatchMetrics(jobDescription, tailoredText || tailoredResume) : null;
    const ok = !requestFailed;
    const hint = ok
      ? 'Tailor CV đã gọi Python engine contract thành công.'
      : `Không gọi được ${endpoint}. Hãy chạy Python engine (:8082) và đặt PYTHON_JOB_TAILOR_URL nếu dùng URL khác.`;
    return {
      id: ctx.runId,
      workspace: ctx.workspace,
      provider: this.provider,
      mode: 'dry-run',
      command,
      cwd: this.cwd,
      ok,
      exitCode: ok ? 0 : 1,
      durationMs: endedAt.getTime() - ctx.startedAt.getTime(),
      startedAt: ctx.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      stdout: combinedStdout,
      stderr: ok ? '' : requestErrorMessage,
      summary: ok ? 'CV tailoring pipeline executed via Python engine contract.' : 'CV tailoring pipeline failed.',
      errorCode: ok ? undefined : 'COMMAND_FAILED',
      hint,
      meta: {
        endpoint,
        responseStatus,
        pipelineContract: 'POST /api/job/tailor',
        tailoredResume: tailoredText || undefined,
        matchScore: Number.isFinite(matchScore) ? matchScore : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        quality: metrics || undefined,
        architectureDecision:
          'Keep orchestration in TypeScript; move heavy AI scoring/tailoring to Python engine (:8082) to avoid duplicate logic.',
      },
    };
  }
}
