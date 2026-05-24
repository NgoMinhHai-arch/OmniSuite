import { spawn, exec } from 'child_process';
import path from 'path';
import axios from 'axios';
import fs from 'fs';
import { resolvePythonExecutable } from '@/shared/lib/python/resolve-python';
import { redactSecrets } from '@/shared/lib/server/secret-redact';

const HEALTH_URL = 'http://127.0.0.1:8000/api/v1/health';

function clipWarmupAttempts(): number {
  const sec = parseInt(process.env.OMNISUITE_CLIP_WARMUP_SEC || '90', 10);
  return Math.max(5, Math.ceil(sec / 2));
}

function tailLogFile(logPath: string, maxLines = 12): string {
  try {
    if (!fs.existsSync(logPath)) return '';
    const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines).join('\n');
  } catch {
    return '';
  }
}

class AiProcessManager {
  private static instance: AiProcessManager;
  private childProcess: ReturnType<typeof spawn> | null = null;
  private isReady: boolean = false;
  private startPromise: Promise<boolean> | null = null;
  private lastStartError: string | null = null;

  private constructor() {
    this.setupLifecycleHooks();
  }

  public static getInstance(): AiProcessManager {
    if (!AiProcessManager.instance) AiProcessManager.instance = new AiProcessManager();
    return AiProcessManager.instance;
  }

  public getLastStartError(): string | null {
    return this.lastStartError ? redactSecrets(this.lastStartError) : null;
  }

  /**
   * Đảm bảo AI đã bật. Nếu đang bật bởi một yêu cầu khác, sẽ cùng chờ đợi.
   */
  public async ensureStarted(onProgress?: (msg: string) => void): Promise<boolean> {
    if (this.isReady) {
      if (await this.ping()) return true;
      this.isReady = false;
    }

    if (this.startPromise) {
      if (onProgress) onProgress('🕒 Một yêu cầu khác đang khởi động Lõi AI, vui lòng đợi...');
      return this.startPromise;
    }

    this.startPromise = this.performStart(onProgress);
    try {
      const result = await this.startPromise;
      this.isReady = result;
      return result;
    } finally {
      this.startPromise = null;
    }
  }

  private async performStart(onProgress?: (msg: string) => void): Promise<boolean> {
    this.lastStartError = null;
    try {
      if (await this.ping()) {
        this.isReady = true;
        return true;
      }

      const isChildAlive =
        !!this.childProcess && this.childProcess.exitCode === null && !this.childProcess.killed;
      const attempts = clipWarmupAttempts();
      if (isChildAlive) {
        for (let i = 0; i < attempts; i++) {
          if (onProgress) onProgress(`Đang nạp mô hình AI vào RAM... (${i * 2}/${attempts * 2}s)`);
          await new Promise((r) => setTimeout(r, 2000));
          if (await this.ping()) return true;
        }
        this.lastStartError = 'Lõi AI (port 8000) chưa phản hồi sau khi khởi động — có thể đang tải CLIP hoặc thiếu thư viện Python.';
        return false;
      }

      const pythonDir = path.resolve(process.cwd(), 'services', 'clip_service');
      const logFile = path.join(pythonDir, 'backend_out.log');
      const out = fs.openSync(logFile, 'a');
      const pythonExe = resolvePythonExecutable();

      console.log(`[AiProcessManager] Khởi động Python tại: ${pythonDir} (${pythonExe})`);

      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      };
      const token = (process.env.INTERNAL_TOKEN || '').trim();
      if (token) childEnv.INTERNAL_TOKEN = token;

      this.childProcess = spawn(pythonExe, ['pipeline_engine.py'], {
        cwd: pythonDir,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', out, out],
        env: childEnv,
      });

      this.childProcess.on('exit', (code) => {
        if (!this.isReady && code !== 0 && code !== null) {
          const tail = redactSecrets(tailLogFile(logFile));
          this.lastStartError =
            tail ||
            `Lõi AI thoát với mã ${code}. Chạy: npm run setup:all (cài torch/fastapi cho services/clip_service).`;
        }
        this.isReady = false;
        this.childProcess = null;
      });
      this.childProcess.on('error', (err) => {
        this.lastStartError = `Không chạy được Python (${pythonExe}): ${err.message}. Chạy npm run setup:all hoặc khởi động bằng launcher (01_START).`;
        this.isReady = false;
      });

      for (let i = 0; i < attempts; i++) {
        if (onProgress) onProgress(`Đang nạp mô hình AI vào RAM... (${i * 2}/${attempts * 2}s)`);
        await new Promise((r) => setTimeout(r, 2000));
        if (await this.ping()) return true;
      }

      const tail = redactSecrets(tailLogFile(logFile));
      this.lastStartError =
        this.lastStartError ||
        tail ||
        'Không kết nối được Lõi AI (http://127.0.0.1:8000). Kiểm tra pip install -r services/clip_service/requirements.txt và cổng 8000.';
      return false;
    } catch (error: any) {
      console.error('[AiProcessManager] Start Error:', error);
      this.lastStartError = redactSecrets(error?.message || String(error));
      return false;
    }
  }

  public async getStatus(): Promise<'ready' | 'loading' | 'stopped' | 'error'> {
    if (this.isReady && (await this.ping())) return 'ready';
    if (this.startPromise) return 'loading';
    const ping = await this.pingDetailed();
    if (ping.status === 'ready' || ping.status === 'ok') return 'ready';
    if (ping.status === 'error') return 'error';
    return 'stopped';
  }

  private async ping(): Promise<boolean> {
    const data = await this.pingDetailed();
    return data.status === 'ready' || data.status === 'ok';
  }

  private async pingDetailed(): Promise<{ status: string; message?: string }> {
    try {
      const res = await axios.get(HEALTH_URL, { timeout: 3000 });
      return res.data || { status: 'stopped' };
    } catch {
      return { status: 'stopped' };
    }
  }

  private setupLifecycleHooks() {
    const stop = () => {
      if (this.childProcess?.pid) exec(`taskkill /F /T /PID ${this.childProcess.pid}`);
    };
    process.on('exit', stop);
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }
}

export default AiProcessManager;
