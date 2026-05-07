import { spawn } from 'node:child_process';

const MAX_LOG_CHARS = 12000;

function trimLog(raw: string): string {
  if (raw.length <= MAX_LOG_CHARS) return raw;
  return `${raw.slice(0, MAX_LOG_CHARS)}\n\n[Log truncated at ${MAX_LOG_CHARS} chars]`;
}

export async function runShell(
  command: string,
  cwd: string,
  timeoutMs: number,
  envOverrides?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...(envOverrides || {}) },
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
      const baseStderr = timeoutHit ? `${stderr}\nTimed out after ${timeoutMs}ms` : stderr;
      resolve({
        stdout: trimLog(stdout),
        stderr: trimLog(baseStderr),
        exitCode: typeof code === 'number' ? code : -1,
      });
    });
  });
}
