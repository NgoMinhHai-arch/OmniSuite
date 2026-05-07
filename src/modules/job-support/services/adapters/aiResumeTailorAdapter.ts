import type { JobSupportRunResult } from '@/modules/job-support/domain/contracts';
import type { AdapterContext, JobSupportAdapter } from '@/modules/job-support/services/adapters/baseAdapter';
import { integrationPath, pathExists } from '@/modules/job-support/services/adapters/fsUtils';
import { runShell } from '@/modules/job-support/services/adapters/shellRunner';

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
    const command = 'node -e "console.log(\'ai-resume-tailor adapter run\')"';
    const result = await runShell(command, this.cwd, 60_000);
    const endedAt = new Date();
    const combinedStdout = `${result.stdout}\n${previewPrompt(ctx)}`;
    return {
      id: ctx.runId,
      workspace: ctx.workspace,
      provider: this.provider,
      mode: 'dry-run',
      command,
      cwd: this.cwd,
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      durationMs: endedAt.getTime() - ctx.startedAt.getTime(),
      startedAt: ctx.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      stdout: combinedStdout,
      stderr: result.stderr,
      summary: 'CV tailoring adapter executed.',
      errorCode: result.exitCode === 0 ? undefined : 'COMMAND_FAILED',
      hint: result.exitCode === 0 ? 'Tiếp theo: nối trực tiếp tới /api/tailor của ai-resume-tailor.' : 'Kiểm tra Node.js và dependency setup.',
      meta: {
        recommendedNextStep: 'Integrate with ai-resume-tailor /api/tailor endpoint',
      },
    };
  }
}
