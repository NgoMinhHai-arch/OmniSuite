/** Shared Ollama (OpenAI-compatible /v1) URL helpers. */

export const DEFAULT_OLLAMA_ORIGIN = "http://localhost:11434";

/**
 * Normalize user-pasted Ollama URL to origin/base:
 * - supports raw origin: `https://xxx.ngrok-free.app`
 * - supports `/v1`, `/v1/chat/completions`, `/api/tags` pasted by mistake
 * - keeps custom path prefix if present: `https://host/proxy/ollama`
 */
export function normalizeOllamaOrigin(input?: string | null): string {
  let raw = (input || "").trim();
  if (!raw) return DEFAULT_OLLAMA_ORIGIN;

  raw = raw.replace(/\/+$/, "");
  raw = raw
    .replace(/\/v1\/chat\/completions$/i, "")
    .replace(/\/v1$/i, "")
    .replace(/\/api\/tags$/i, "");

  try {
    // If user pasted a full URL, normalize and preserve optional base path.
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}` || DEFAULT_OLLAMA_ORIGIN;
  } catch {
    // Fallback for plain host:port / malformed inputs.
    return raw || DEFAULT_OLLAMA_ORIGIN;
  }
}

/** Base URL passed to OpenAI SDK / fetch chat completions: `{origin}/v1`. */
export function ollamaOpenAiV1Base(input?: string | null): string {
  return `${normalizeOllamaOrigin(input)}/v1`;
}

/**
 * Ollama dùng được trên UI: đã nhập URL/key tunnel, hoặc chọn Ollama làm mặc định
 * (máy local `http://localhost:11434` không bắt buộc nhập URL).
 */
export function shouldExposeOllamaInUi(settings: Record<string, unknown>): boolean {
  const url = String(settings.ollama_base_url ?? "").trim();
  const key = String(settings.ollama_api_key ?? "").trim();
  const def = String(settings.default_provider ?? "").trim();
  return !!(url || key || def === "Ollama");
}

/**
 * Số request inference Ollama chạy đồng thời (mặc định 1).
 * Nhiều tab/tool gọi LLM cùng lúc + 2 model trong Ollama = dễ đầy VRAM/RAM và giật UI.
 * Đặt `OLLAMA_MAX_CONCURRENT=1` trong `.env` để an toàn; máy GPU mạnh có thể thử 2.
 */
export function readOllamaMaxConcurrent(): number {
  const raw = process.env.OLLAMA_MAX_CONCURRENT;
  const n = parseInt(String(raw ?? "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 8);
}

/** Timeout mặc định cho Ollama (local chậm hơn API cloud). Đơn vị ms. */
export function defaultOllamaTimeoutMs(): number {
  const raw = process.env.OLLAMA_TIMEOUT_MS;
  const n = parseInt(String(raw ?? "180000"), 10);
  if (!Number.isFinite(n)) return 180_000;
  return Math.min(Math.max(n, 30_000), 600_000);
}

/**
 * Thời gian Ollama daemon giữ model trong RAM/VRAM sau lần gọi cuối.
 * Mặc định OmniSuite = "30s" (cân bằng: gọi liên tiếp vẫn nhanh, idle là tự nhả VRAM).
 * - "0"  → unload NGAY sau mỗi gọi (chậm khi gọi liên tiếp, tiết kiệm VRAM tối đa).
 * - "5m" → giữ 5 phút (nhanh nhất khi gọi liên tiếp, tốn VRAM lâu).
 * Override qua env `OLLAMA_KEEP_ALIVE` nếu cần.
 */
export function readOllamaKeepAlive(): string {
  const raw = String(process.env.OLLAMA_KEEP_ALIVE ?? "30s").trim();
  return raw || "30s";
}

/**
 * Cap context window khi inference Ollama.
 *
 * Vì sao quan trọng: nhiều model (vd. llama3.2, llama3.1, qwen2.5) khai báo
 * `num_ctx=131072` (128k) trong Modelfile. Ollama allocate KV-cache cho TOÀN
 * BỘ context khi load → một model 3B có thể đòi 13–16 GiB RAM. Trên máy không
 * có nhiều RAM/VRAM sẽ fail: "model requires more system memory".
 *
 * OmniSuite mặc định cap về **4096** (đủ cho mọi tool SEO/content) → 3B model
 * chỉ cần ~3 GiB. Người dùng có thể override `OLLAMA_NUM_CTX=8192` nếu cần
 * prompt dài, hoặc `OLLAMA_NUM_CTX=0` để tôn trọng giá trị trong Modelfile.
 */
export function readOllamaNumCtx(): number {
  const raw = process.env.OLLAMA_NUM_CTX;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 4096;
  }
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return 4096;
  if (n === 0) return 0; // 0 = không gửi field, để Modelfile quyết định.
  return Math.min(Math.max(n, 512), 131072);
}

/**
 * Sau bao lâu (ms) idle thì OmniSuite CHỦ ĐỘNG gọi Ollama unload toàn bộ model.
 * Mặc định OmniSuite = 120000ms (2 phút). Đặt `OLLAMA_IDLE_UNLOAD_MS=0` để tắt.
 */
export function readOllamaIdleUnloadMs(): number {
  const raw = process.env.OLLAMA_IDLE_UNLOAD_MS;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 120_000;
  }
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.max(n, 5_000), 24 * 60 * 60_000);
}

/**
 * Gửi yêu cầu unload mọi model đang load trong Ollama daemon (dựa trên `/api/ps`).
 * Best-effort, không throw — dùng cho idle watcher và shutdown hook.
 */
export async function unloadOllamaModelsAt(origin: string, timeoutMs = 4_000): Promise<number> {
  const base = normalizeOllamaOrigin(origin);
  if (typeof fetch !== "function" || typeof AbortController !== "function") return 0;
  let unloaded = 0;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    let models: string[] = [];
    try {
      const psResp = await fetch(`${base}/api/ps`, { signal: ac.signal, cache: "no-store" });
      if (psResp.ok) {
        const data = (await psResp.json().catch(() => null)) as { models?: Array<{ name?: string; model?: string }> } | null;
        models = Array.isArray(data?.models)
          ? data!.models!.map((m) => m.name || m.model || "").filter(Boolean)
          : [];
      }
    } finally {
      clearTimeout(t);
    }
    for (const model of models) {
      try {
        const ac2 = new AbortController();
        const t2 = setTimeout(() => ac2.abort(), timeoutMs);
        const resp = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, keep_alive: 0 }),
          signal: ac2.signal,
          cache: "no-store",
        });
        clearTimeout(t2);
        if (resp.ok) unloaded++;
      } catch {
        // ignore: best-effort unload
      }
    }
  } catch {
    // ignore: daemon offline / network blip
  }
  return unloaded;
}

class AsyncSemaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }

  get activeCount(): number {
    return this.active;
  }
}

const ollamaInferenceSemaphore = new AsyncSemaphore(readOllamaMaxConcurrent());

let lastOllamaOrigin: string | null = null;
let idleUnloadTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleUnloadTimer(): void {
  if (idleUnloadTimer) {
    clearTimeout(idleUnloadTimer);
    idleUnloadTimer = null;
  }
}

function scheduleIdleUnload(): void {
  const idleMs = readOllamaIdleUnloadMs();
  if (idleMs <= 0) return;
  if (!lastOllamaOrigin) return;
  clearIdleUnloadTimer();
  const origin = lastOllamaOrigin;
  idleUnloadTimer = setTimeout(() => {
    idleUnloadTimer = null;
    if (ollamaInferenceSemaphore.activeCount > 0) return;
    void unloadOllamaModelsAt(origin).catch(() => {});
  }, idleMs);
  // Không giữ event loop sống chỉ vì timer này (Node-only API; bỏ qua nếu thiếu).
  const timerWithUnref = idleUnloadTimer as unknown as { unref?: () => void };
  if (typeof timerWithUnref.unref === "function") timerWithUnref.unref();
}

/**
 * Giới hạn đồng thời các lần gọi sinh văn bản tới Ollama trong một tiến trình Next.js,
 * giảm spike VRAM và tranh chấp khi nhiều route/request chồng lên nhau.
 *
 * Truyền `origin` (đã normalize hoặc URL gốc người dùng nhập) để watcher biết
 * gọi unload tới đâu khi idle, và để shutdown hook biết server nào.
 */
export async function withOllamaInferenceLock<T>(
  fn: () => Promise<T>,
  opts?: { origin?: string | null },
): Promise<T> {
  if (opts?.origin) lastOllamaOrigin = normalizeOllamaOrigin(opts.origin);
  clearIdleUnloadTimer();
  await ollamaInferenceSemaphore.acquire();
  try {
    return await fn();
  } finally {
    ollamaInferenceSemaphore.release();
    if (ollamaInferenceSemaphore.activeCount === 0) scheduleIdleUnload();
  }
}

/** Origin Ollama gần đây nhất đã được dùng (để launcher gọi unload khi tắt app). */
export function getLastOllamaOrigin(): string | null {
  return lastOllamaOrigin;
}
