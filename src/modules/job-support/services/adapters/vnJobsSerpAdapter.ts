import path from 'node:path';

import type { JobSupportRunResult } from '@/modules/job-support/domain/contracts';
import type { AdapterContext, JobSupportAdapter } from '@/modules/job-support/services/adapters/baseAdapter';
import { mergeConfig, getSystemConfig } from '@/shared/lib/config';
import { aggregateVnJobListings, DEFAULT_VN_JOB_DOMAINS, parseDomainList } from '@/modules/job-support/services/vnJobSerpAggregation';

export function resolveSerpApiKey(req: AdapterContext['request']): string {
  const merged = mergeConfig({
    serpapi_key: (req.serpapi_key || '').trim() || undefined,
  });
  return (merged.serpapi_key || getSystemConfig().serpapi_key || '').trim();
}

export function resolveTavilyKey(req: AdapterContext['request']): string {
  const merged = mergeConfig({
    tavily_api_key: (req.tavily_api_key || '').trim() || undefined,
  });
  return (merged.tavily_api_key || getSystemConfig().tavily_api_key || '').trim();
}

export class VnJobsSerpAdapter implements JobSupportAdapter {
  readonly provider = 'vn-job-feed' as const;
  readonly workspace = 'find-jobs' as const;
  readonly cwd = path.join(process.cwd(), 'src', 'modules', 'job-support');

  async preflight(ctx?: Pick<AdapterContext, 'request'>): Promise<{ ok: boolean; hint?: string }> {
    const serp = ctx?.request ? resolveSerpApiKey(ctx.request) : (getSystemConfig().serpapi_key || '').trim();
    const tavily = ctx?.request ? resolveTavilyKey(ctx.request) : (getSystemConfig().tavily_api_key || '').trim();
    if (!serp && !tavily) {
      return {
        ok: false,
        hint: 'Thiếu API key: cần SerpApi hoặc Tavily (ít nhất một). Thêm trong Cài đặt hoặc biến môi trường.',
      };
    }
    return { ok: true };
  }

  async execute(ctx: AdapterContext): Promise<JobSupportRunResult> {
    const started = ctx.startedAt;
    const serpApiKey = resolveSerpApiKey(ctx.request);
    const tavilyApiKey = resolveTavilyKey(ctx.request);
    const endedAt = new Date();

    if (!serpApiKey && !tavilyApiKey) {
      return {
        id: ctx.runId,
        workspace: ctx.workspace,
        provider: this.provider,
        mode: ctx.request.mode || 'dry-run',
        command: 'aggregateVnJobListings(no-provider-key)',
        cwd: this.cwd,
        ok: false,
        exitCode: 2,
        durationMs: endedAt.getTime() - started.getTime(),
        startedAt: started.toISOString(),
        endedAt: endedAt.toISOString(),
        stdout: '',
        stderr: 'Missing SerpApi and Tavily keys',
        summary: 'Find Jobs VN không chạy được vì thiếu key provider.',
        errorCode: 'PROVIDER_NOT_READY',
        hint: 'Mở Cài đặt → nhập SerpApi hoặc Tavily key, hoặc cấu hình SERPAPI_KEY / TAVILY_API_KEY trên server.',
      };
    }

    const jobTitle = (ctx.request.jobTitle || '').trim();
    const location = (ctx.request.location || '').trim();
    const domains = parseDomainList(ctx.request.companyPortals, DEFAULT_VN_JOB_DOMAINS);

    const { jobs, queriesUsed, stderrLines } = await aggregateVnJobListings({
      serpApiKey,
      tavilyApiKey,
      jobTitle,
      location,
      domains,
      ecoMode: ctx.request.ecoMode,
      maxQueries: ctx.request.maxQueries,
    });

    const stdoutObj = {
      count: jobs.length,
      jobs: jobs.slice(0, 80),
      queriesUsed,
    };

    const ended = new Date();
    const stderrText = stderrLines.join('\n');

    return {
      id: ctx.runId,
      workspace: ctx.workspace,
      provider: this.provider,
      mode: ctx.request.mode || 'dry-run',
      command: `aggregateVnJobListings(domains=${domains.length}, providers=tavily+serpapi, eco=${ctx.request.ecoMode !== false}, maxQueries=${ctx.request.maxQueries || 'auto'})`,
      cwd: this.cwd,
      ok: true,
      exitCode: 0,
      durationMs: ended.getTime() - started.getTime(),
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
      stdout: JSON.stringify(stdoutObj, null, 2),
      stderr: stderrText,
      summary: `Đã gom ${jobs.length} tin (Tavily + SerpApi hybrid).`,
      hint:
        jobs.length === 0
          ? 'Không lấy được tin nào. Kiểm tra quota Tavily/SerpApi, từ khóa, hoặc giảm số domain.'
          : stderrText
            ? 'Một vài truy vấn provider báo lỗi — xem stderr trong chi tiết chạy.'
            : undefined,
      meta: {
        jobs,
        queriesUsed,
        summaryText: `${jobs.length} việc từ các nguồn đã chọn.`,
        estimatedCreditsUsed: queriesUsed.length,
      },
    };
  }
}
