import { spawn, exec } from 'child_process';
import path from 'path';
import axios from 'axios';
import fs from 'fs';

const HEALTH_URL = 'http://127.0.0.1:8000/api/v1/health';

class AiProcessManager {
  private static instance: AiProcessManager;
  private childProcess: any = null;
  private isReady: boolean = false;
  private startPromise: Promise<boolean> | null = null;

  private constructor() {
    this.setupLifecycleHooks();
  }

  public static getInstance(): AiProcessManager {
    if (!AiProcessManager.instance) AiProcessManager.instance = new AiProcessManager();
    return AiProcessManager.instance;
  }

  /**
   * Đảm bảo AI đã bật. Nếu đang bật bởi một yêu cầu khác, sẽ cùng chờ đợi.
   */
  public async ensureStarted(onProgress?: (msg: string) => void): Promise<boolean> {
    // 1. Nếu đã sẵn sàng, trả về ngay
    if (this.isReady) {
      if (await this.ping()) return true;
      this.isReady = false;
    }

    // 2. Nếu đang có một tiến trình khởi động khác, hãy đợi cùng nó
    if (this.startPromise) {
      if (onProgress) onProgress("🕒 Một yêu cầu khác đang khởi động AI, vui lòng đợi...");
      return this.startPromise;
    }

    // 3. Bắt đầu khởi động mới
    this.startPromise = this.performStart(onProgress);
    try {
      const result = await this.startPromise;
      this.isReady = result;
      return result;
    } finally {
      this.startPromise = null; // Giải phóng khóa khi xong
    }
  }

  private async performStart(onProgress?: (msg: string) => void): Promise<boolean> {
    try {
      // Kiểm tra xem thực tế có đang chạy ngầm không
      if (await this.ping()) {
        this.isReady = true;
        return true;
      }

      // Nếu process do manager đang chạy, chỉ chờ nó warmup - tuyệt đối không spawn chồng.
      const isChildAlive = !!this.childProcess && this.childProcess.exitCode === null && !this.childProcess.killed;
      if (isChildAlive) {
        for (let i = 0; i < 15; i++) {
          if (onProgress) onProgress(`Đang nạp mô hình AI vào RAM... (${i * 2}/30s)`);
          await new Promise(r => setTimeout(r, 2000));
          if (await this.ping()) return true;
        }
        return false;
      }

      const pythonDir = path.resolve(process.cwd(), 'services', 'clip_service');
      const logFile = path.join(pythonDir, 'backend_out.log');
      const out = fs.openSync(logFile, 'a');

      console.log(`[AiProcessManager] Khởi động Python tại: ${pythonDir}`);

      this.childProcess = spawn('python', ['pipeline_engine.py'], {
        cwd: pythonDir,
        shell: true,
        windowsHide: true,
        stdio: ['ignore', out, out],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      this.childProcess.on('exit', () => {
        this.isReady = false;
        this.childProcess = null;
      });
      this.childProcess.on('error', () => {
        this.isReady = false;
      });

      // Vòng lặp chờ đợi tối đa 30 giây (vì CPU cần thời gian nạp model)
      for (let i = 0; i < 15; i++) {
        if (onProgress) onProgress(`Đang nạp mô hình AI vào RAM... (${i * 2}/30s)`);
        await new Promise(r => setTimeout(r, 2000));
        if (await this.ping()) return true;
      }

      return false;
    } catch (error) {
      console.error("[AiProcessManager] Start Error:", error);
      return false;
    }
  }

  public async getStatus(): Promise<'ready' | 'loading' | 'stopped'> {
    if (this.isReady && await this.ping()) return 'ready';
    if (this.startPromise) return 'loading';
    return (await this.ping()) ? 'ready' : 'stopped';
  }

  private async ping(): Promise<boolean> {
    try {
      const res = await axios.get(HEALTH_URL, { timeout: 3000 });
      return res.status === 200 && (res.data.status === 'ready' || res.data.status === 'ok');
    } catch { return false; }
  }

  private setupLifecycleHooks() {
    const stop = () => { if (this.childProcess) exec(`taskkill /F /T /PID ${this.childProcess.pid}`); };
    process.on('exit', stop);
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }
}

export default AiProcessManager;
