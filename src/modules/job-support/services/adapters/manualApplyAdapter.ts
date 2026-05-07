import path from 'node:path';

import type { JobSupportRunResult } from '@/modules/job-support/domain/contracts';
import type { AdapterContext, JobSupportAdapter } from '@/modules/job-support/services/adapters/baseAdapter';
import { normalizeJobLink } from '@/modules/job-support/services/vnJobSerpAggregation';

export function parseApplyJobUrls(req: AdapterContext['request']): string[] {
  const raw = (req.applyJobUrls || req.jdText || '').trim();
  if (!raw) return [];
  const scraped = raw.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
  const lines = raw.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
  const lineExact = lines.filter((l) => /^https?:\/\//i.test(l));
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const cand of [...lineExact, ...scraped]) {
    const normalized = normalizeJobLink(cand);
    if (!normalized) continue;
    const k = normalized.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      urls.push(normalized);
    }
  }
  return urls;
}

function domainCounts(urls: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const u of urls) {
    try {
      const h = new URL(u).hostname.toLowerCase();
      m[h] = (m[h] || 0) + 1;
    } catch {
      m.other = (m.other || 0) + 1;
    }
  }
  return m;
}

export class ManualApplyAdapter implements JobSupportAdapter {
  readonly provider = 'manual-apply' as const;
  readonly workspace = 'auto-apply' as const;
  readonly cwd = path.join(process.cwd(), 'src', 'modules', 'job-support');

  async preflight(_ctx?: Pick<AdapterContext, 'request'>): Promise<{ ok: boolean; hint?: string }> {
    return { ok: true };
  }

  async execute(ctx: AdapterContext): Promise<JobSupportRunResult> {
    const started = ctx.startedAt;
    const mode = ctx.request.mode || 'dry-run';
    const urls = parseApplyJobUrls(ctx.request);
    const endedAt = new Date();
    const counts = domainCounts(urls);

    if (urls.length === 0) {
      return {
        id: ctx.runId,
        workspace: ctx.workspace,
        provider: this.provider,
        mode,
        command: 'manualApply(checklist)',
        cwd: this.cwd,
        ok: false,
        exitCode: 2,
        durationMs: endedAt.getTime() - started.getTime(),
        startedAt: started.toISOString(),
        endedAt: endedAt.toISOString(),
        stdout: '',
        stderr: 'No URLs',
        summary: 'Chưa có URL việc để lập checklist.',
        errorCode: 'INVALID_INPUT',
        hint: 'Dán danh sách link ứng tuyển (mỗi dòng một URL) vào ô “Link ứng tuyển”.',
      };
    }

    const payload = {
      mode,
      urlCount: urls.length,
      applyUrls: urls,
      domainCounts: counts,
      checklist: [
        'Mở từng link trong trình duyệt và nộp hồ sơ thủ công trên site đích.',
        'Live mode chỉ ghi nhận xác nhận hàng loạt (server không tự mở trình duyệt).',
        'Giới hạn apply/ngày vẫn áp dụng khi bật Live + Approval.',
      ],
    };

    const stdout = JSON.stringify(payload, null, 2);
    const summary =
      mode === 'live'
        ? `Đã xác nhận batch thủ công: ${urls.length} link (mở và nộp trên trình duyệt của bạn).`
        : `Dry-run: ${urls.length} link sẵn sàng — xem checklist bên dưới.`;

    return {
      id: ctx.runId,
      workspace: ctx.workspace,
      provider: this.provider,
      mode,
      command: 'manualApply(checklist)',
      cwd: this.cwd,
      ok: true,
      exitCode: 0,
      durationMs: endedAt.getTime() - started.getTime(),
      startedAt: started.toISOString(),
      endedAt: endedAt.toISOString(),
      stdout,
      stderr: '',
      summary,
      meta: {
        applyUrls: urls,
        domainCounts: counts,
        summaryText: summary,
      },
    };
  }
}
