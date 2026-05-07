import { NextRequest, NextResponse } from 'next/server';
import type { JobDetailEnrichRequest, JobDetailEnrichResponse } from '@/modules/job-support/domain/contracts';
import { enrichJobDetail } from '@/modules/job-support/services/jobDetailEnrichment';
import { resolveSerpApiKey, resolveTavilyKey } from '@/modules/job-support/services/adapters/vnJobsSerpAdapter';

const VALID_COST_MODES = new Set(['free_only', 'free_then_paid', 'paid_priority']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<JobDetailEnrichRequest>;
    const link = typeof body.link === 'string' ? body.link.trim() : '';
    const costMode = typeof body.costMode === 'string' ? body.costMode : 'free_only';
    if (!link) {
      return NextResponse.json<JobDetailEnrichResponse>(
        { ok: false, error: 'Thiếu link job.', errorCode: 'INVALID_INPUT', hint: 'Gửi link job trước khi lấy chi tiết.' },
        { status: 400 },
      );
    }
    if (!VALID_COST_MODES.has(costMode)) {
      return NextResponse.json<JobDetailEnrichResponse>(
        { ok: false, error: 'costMode không hợp lệ.', errorCode: 'INVALID_INPUT', hint: 'Dùng free_only, free_then_paid hoặc paid_priority.' },
        { status: 400 },
      );
    }

    const serpapi_key = typeof body.serpapi_key === 'string' ? body.serpapi_key : undefined;
    const tavily_api_key = typeof body.tavily_api_key === 'string' ? body.tavily_api_key : undefined;

    const mergedReq = { workspace: 'find-jobs' as const, serpapi_key, tavily_api_key };
    const output = await enrichJobDetail({
      link,
      title: typeof body.title === 'string' ? body.title : '',
      costMode,
      serpApiKey: resolveSerpApiKey(mergedReq),
      tavilyApiKey: resolveTavilyKey(mergedReq),
    });

    if (!output.ok) {
      return NextResponse.json<JobDetailEnrichResponse>(
        {
          ok: false,
          error: output.error || 'Không lấy được chi tiết job.',
          errorCode: 'COMMAND_FAILED',
          hint: output.hint,
          creditsEstimate: output.creditsEstimate,
        },
        { status: 200 },
      );
    }

    return NextResponse.json<JobDetailEnrichResponse>({
      ok: true,
      detail: output.detail,
      strategyUsed: output.strategyUsed,
      fallbackUsed: output.fallbackUsed,
      creditsEstimate: output.creditsEstimate,
    });
  } catch (err) {
    return NextResponse.json<JobDetailEnrichResponse>(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Không parse được request.',
        errorCode: 'COMMAND_FAILED',
      },
      { status: 500 },
    );
  }
}
