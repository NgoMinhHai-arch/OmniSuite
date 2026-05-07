import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export type JobSupportProvider = 'applypilot' | 'career-ops' | 'job-scraper';
export type JobSupportAction = 'scan' | 'evaluate' | 'pipeline';

export type JobSupportRunInput = {
  provider: JobSupportProvider;
  action: JobSupportAction;
  jobUrl?: string;
  jobTitle?: string;
  location?: string;
  jdText?: string;
  scoreThreshold?: string;
  companyPortals?: string;
};

export type JobSupportRunOutput = {
  id: string;
  provider: JobSupportProvider;
  action: JobSupportAction;
  cwd: string;
  command: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  stdout: string;
  stderr: string;
  errorCode?: JobSupportErrorCode;
  hint?: string;
};

export type JobSupportErrorCode =
  | 'PROVIDER_NOT_FOUND'
  | 'MISSING_INPUT'
  | 'TIMEOUT'
  | 'DEPENDENCIES_MISSING'
  | 'COMMAND_FAILED';

type ProviderStatus = {
  provider: JobSupportProvider;
  cwd: string;
  exists: boolean;
  keyFiles: string[];
  ready: boolean;
  setupHint: string[];
};

const BRIDGE_TMP_DIR = path.join(process.cwd(), '.tmp', 'job-support-bridge');
const MAX_LOG_CHARS = 12000;

function providerPath(provider: JobSupportProvider): string {
  return path.join(process.cwd(), 'integrations', provider);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function commandFor(input: JobSupportRunInput, cwd: string): string {
  const quotedJd = (input.jdText || input.jobTitle || 'Evaluate sample job description').replace(/"/g, '\\"');
  const threshold = input.scoreThreshold || '4.0';

  if (input.provider === 'applypilot') {
    if (input.action === 'evaluate') {
      return 'python -m applypilot.cli doctor';
    }
    if (input.action === 'scan') {
      return `set PYTHONPATH=${path.join(cwd, 'src')} && python -m applypilot.cli run --dry-run --min-score ${threshold}`;
    }
    return `set PYTHONPATH=${path.join(cwd, 'src')} && python -m applypilot.cli run --dry-run --workers 2`;
  }

  if (input.provider === 'career-ops') {
    if (input.action === 'scan') {
      return 'npm run scan';
    }
    if (input.action === 'evaluate') {
      return `node gemini-eval.mjs "${quotedJd}"`;
    }
    return 'npm run doctor';
  }

  if (input.action === 'scan') {
    return 'python scraper.py';
  }
  if (input.action === 'evaluate') {
    return 'python score_jobs.py';
  }
  return 'python job_manager.py';
}

function trimLog(raw: string): string {
  if (raw.length <= MAX_LOG_CHARS) return raw;
  const trimmed = raw.slice(0, MAX_LOG_CHARS);
  return `${trimmed}\n\n[Log truncated at ${MAX_LOG_CHARS} chars]`;
}

function deriveError(output: { exitCode: number; stderr: string }): { errorCode?: JobSupportErrorCode; hint?: string } {
  const stderr = output.stderr.toLowerCase();
  if (output.exitCode === -1 && stderr.includes('timed out')) {
    return {
      errorCode: 'TIMEOUT',
      hint: 'Lệnh chạy quá lâu và bị timeout. Thử action nhẹ hơn (Evaluate), hoặc setup provider trước.',
    };
  }
  if (stderr.includes('dependencies not installed') || stderr.includes('module not found') || stderr.includes('no module named')) {
    return {
      errorCode: 'DEPENDENCIES_MISSING',
      hint: 'Provider chưa cài đủ dependency. Hãy vào provider tương ứng và chạy lệnh cài đặt được gợi ý ở Provider health.',
    };
  }
  if (output.exitCode !== 0) {
    return {
      errorCode: 'COMMAND_FAILED',
      hint: 'Lệnh đã chạy nhưng thất bại. Kiểm tra stderr để biết file/config còn thiếu.',
    };
  }
  return {};
}

function runShell(command: string, cwd: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: process.env,
      shell: true,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timeoutHit = false;
    const timer = setTimeout(() => {
      timeoutHit = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timeoutHit) {
        resolve({ stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms`, exitCode: -1 });
        return;
      }
      resolve({ stdout, stderr, exitCode: typeof code === 'number' ? code : -1 });
    });
  });
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const providerDefs: Array<{ provider: JobSupportProvider; keyFiles: string[]; setupHint: string[] }> = [
    {
      provider: 'applypilot',
      keyFiles: ['pyproject.toml', 'src/applypilot/cli.py'],
      setupHint: ['python -m venv .venv', '.venv\\Scripts\\pip install -e .'],
    },
    {
      provider: 'career-ops',
      keyFiles: ['package.json', 'scan.mjs'],
      setupHint: ['npm install', 'npx playwright install chromium'],
    },
    {
      provider: 'job-scraper',
      keyFiles: ['requirements.txt', 'scraper.py'],
      setupHint: ['python -m venv .venv', '.venv\\Scripts\\pip install -r requirements.txt'],
    },
  ];

  const rows = await Promise.all(
    providerDefs.map(async (def) => {
      const cwd = providerPath(def.provider);
      const exists = await pathExists(cwd);
      const checks = await Promise.all(def.keyFiles.map((f) => pathExists(path.join(cwd, f))));
      return {
        provider: def.provider,
        cwd,
        exists,
        keyFiles: def.keyFiles,
        ready: exists && checks.every(Boolean),
        setupHint: def.setupHint,
      };
    }),
  );

  return rows;
}

async function saveRunOutput(output: JobSupportRunOutput): Promise<void> {
  await fs.mkdir(BRIDGE_TMP_DIR, { recursive: true });
  const oneRunPath = path.join(BRIDGE_TMP_DIR, `${output.id}.json`);
  const lastRunPath = path.join(BRIDGE_TMP_DIR, 'last-run.json');
  await fs.writeFile(oneRunPath, JSON.stringify(output, null, 2), 'utf-8');
  await fs.writeFile(lastRunPath, JSON.stringify(output, null, 2), 'utf-8');
}

export async function executeProviderAction(input: JobSupportRunInput): Promise<JobSupportRunOutput> {
  const cwd = providerPath(input.provider);
  const exists = await pathExists(cwd);
  const startedAt = new Date();
  const id = `${Date.now()}-${input.provider}-${input.action}`;

  if (!exists) {
    const failOutput: JobSupportRunOutput = {
      id,
      provider: input.provider,
      action: input.action,
      cwd,
      command: '',
      ok: false,
      exitCode: -1,
      durationMs: 0,
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      stdout: '',
      stderr: `Provider folder not found at ${cwd}`,
      errorCode: 'PROVIDER_NOT_FOUND',
      hint: 'Chưa có provider này trong integrations. Kiểm tra clone/setup module.',
    };
    await saveRunOutput(failOutput);
    return failOutput;
  }

  const command = commandFor(input, cwd);
  const result = await runShell(command, cwd, 180_000);
  const endedAt = new Date();

  const stderr = trimLog(result.stderr);
  const stdout = trimLog(result.stdout);
  const errorMeta = deriveError({ exitCode: result.exitCode, stderr });

  const output: JobSupportRunOutput = {
    id,
    provider: input.provider,
    action: input.action,
    cwd,
    command,
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    durationMs: endedAt.getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    stdout,
    stderr,
    errorCode: errorMeta.errorCode,
    hint: errorMeta.hint,
  };

  await saveRunOutput(output);
  return output;
}

export async function readRunOutput(id?: string): Promise<JobSupportRunOutput | null> {
  const target = id ? path.join(BRIDGE_TMP_DIR, `${id}.json`) : path.join(BRIDGE_TMP_DIR, 'last-run.json');
  if (!(await pathExists(target))) return null;
  const raw = await fs.readFile(target, 'utf-8');
  return JSON.parse(raw) as JobSupportRunOutput;
}
