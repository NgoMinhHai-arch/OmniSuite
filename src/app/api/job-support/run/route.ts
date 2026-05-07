import { NextRequest, NextResponse } from 'next/server';
import { runWorkspace } from '@/modules/job-support/services/orchestrator';
import type { JobSupportRequest } from '@/modules/job-support/domain/contracts';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<JobSupportRequest>;
    const workspace = body.workspace || 'find-jobs';
    const result = await runWorkspace({
      workspace,
      mode: body.mode || 'dry-run',
      approved: body.approved ?? false,
      jobUrl: body.jobUrl || '',
      jobTitle: body.jobTitle || '',
      location: body.location || '',
      jdText: body.jdText || '',
      companyPortals: body.companyPortals || '',
      scoreThreshold: body.scoreThreshold || '',
      resumeText: body.resumeText || '',
      serpapi_key: typeof body.serpapi_key === 'string' ? body.serpapi_key : undefined,
      tavily_api_key: typeof body.tavily_api_key === 'string' ? body.tavily_api_key : undefined,
      ecoMode: typeof body.ecoMode === 'boolean' ? body.ecoMode : undefined,
      maxQueries: typeof body.maxQueries === 'number' ? body.maxQueries : undefined,
      applyJobUrls: typeof body.applyJobUrls === 'string' ? body.applyJobUrls : undefined,
    });
    const status = result.ok ? 200 : result.errorCode === 'INVALID_INPUT' || result.errorCode === 'MISSING_APPROVAL' ? 400 : 500;
    return NextResponse.json(result, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to execute provider action';
    return NextResponse.json({ ok: false, error: message, errorCode: 'COMMAND_FAILED' }, { status: 500 });
  }
}
