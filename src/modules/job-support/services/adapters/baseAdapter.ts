import type { JobSupportRequest, JobSupportRunResult, JobWorkspace } from '@/modules/job-support/domain/contracts';

export type AdapterContext = {
  request: JobSupportRequest;
  workspace: JobWorkspace;
  startedAt: Date;
  runId: string;
};

export interface JobSupportAdapter {
  readonly provider: 'vn-job-feed' | 'manual-apply' | 'ai-resume-tailor';
  readonly workspace: JobWorkspace;
  readonly cwd: string;
  /** Optional request for providers that validate API keys (e.g. SerpApi). */
  preflight(ctx?: Pick<AdapterContext, 'request'>): Promise<{ ok: boolean; hint?: string }>;
  execute(ctx: AdapterContext): Promise<JobSupportRunResult>;
}
