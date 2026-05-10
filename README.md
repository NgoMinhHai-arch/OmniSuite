# OmniSuite AI - All-in-One SEO & Marketing Intelligence Hub

**OmniSuite AI** is a comprehensive ecosystem designed to automate data analysis, keyword research, and website performance optimization through advanced Artificial Intelligence.

## Key Features

### SEO Intelligence
*   **Page Analyzer:** Deep analysis of on-page SEO, header structures, and keyword density.
*   **Bulk Metrics:** Rapidly gather Volume, CPC, and Keyword Difficulty for large lists.
*   **Competitor Gap:** Identify strategic keyword opportunities compared to competitors.

### AI-Driven Insights
*   **Smart Intent Engine:** Automatically classify Search Intent using multi-modal AI models.
*   **AI Integration:** Seamless connection with Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, and **Ollama (local / tunnel)**.
*   **Auto-Discovery:** Intelligent model selection based on task requirements.
*   **Local-First:** Run 100% offline with [Ollama](https://ollama.com) — no cloud key required.

### Advanced Scraping
*   **Stealth Mode:** Robust data mining using Puppeteer Stealth & Playwright to bypass bot detection.
*   **Python Core:** High-performance Python backend for complex data processing.
*   **Universal Parsing:** Extract data from PDF, DOCX, and XLSX files effortlessly.

### Professional Dashboard
*   **Interactive UI:** High-performance visualizations for quick ROI identification.
*   **Keyword Hub:** Centralized storage with smart caching for efficient data management.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 16 (App Router)](https://nextjs.org), React 19, Tailwind CSS 4 |
| **UI/UX** | Framer Motion (Animations), Lucide React (Icons) |
| **AI SDK** | [Vercel AI SDK](https://sdk.vercel.ai/docs), Google Generative AI, OpenAI |
| **Backend** | Python (FastAPI), Puppeteer Stealth, Playwright |
| **Data Engine** | SQLite, Cheerio, Mammoth (DOCX), PDF-Parse |

---

## Project Structure

*   `src/app/api/`: Route Handlers for AI & Backend integration.
*   `src/components/features/`: Core functional modules (BulkMetrics, Analyzer, etc.).
*   `scripts/`: Python core scrapers and data processing utilities.

---

## Getting Started

### Quick Start - Just 1 Click!

#### Option 1: Using Launcher (Recommended)
**Requirements:** Node.js 18+ and Python 3.10+ installed

1. **Run directly:**
   ```bash
   node launcher.js
   ```
   Or: `npm run app`

2. **Build .exe file (one-click run):**
   ```bash
   npm run build:exe
   ```
   Then **double-click** `OmniSuite.exe` to run

#### Option 2: Manual Setup
1. Install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```
2. Create `.env` file from `.env.example`
3. Run: `npm run dev`

### Integrations (submodule — bền, một lệnh cho mọi OS)

Repo kèm các dự án trong `integrations/` qua **git submodule** (đã có URL trong `.gitmodules`).
Sau khi `git clone` OmniSuite hoặc khi submodule thiếu:

```bash
npm run integrations:sync
```

Kiểm tra (CI hoặc trước khi ship): `npm run integrations:verify`. Chi tiết: [`integrations/ai-support/README.md`](integrations/ai-support/README.md).

### Useful Commands
| Command | Description |
|---------|-------------|
| `npm run app` | Run app using launcher |
| `npm run build:exe` | Build OmniSuite.exe file |
| `npm run dev` | Run dev mode (frontend + backend) |
| `npm run integrations:sync` | Lấy đủ submodule integrations + shallow clone OpenManus nếu thiếu |
| `npm run integrations:verify` | Fail nếu submodule chưa init |
| `npm run integrations:sync:upstream` | Kéo submodule theo HEAD remote (tuỳ chọn, có thể lệch pin) |
| `npm run dev:next` | Run Next.js only |
| `npm run dev:engine` | Run Python backend only |
| `npm run security:scan` | Scan tracked files for obvious secrets before push |
| `npm run security:scan:staged` | Scan staged diff for secrets before commit |
| `npm run security:install-hooks` | Install local pre-commit/pre-push security hooks |

### System Requirements
*   **Node.js 18+** - [Download here](https://nodejs.org/)
*   **Python 3.10+** - [Download here](https://www.python.org/downloads/)
*   **API Keys** - Add to `.env` file (Gemini, OpenAI, etc.)
*   **(Optional) Ollama** - [Download here](https://ollama.com) for fully local LLM (no cloud key needed)

### Use Ollama (Local LLM, no API key)
1. Install Ollama from [ollama.com](https://ollama.com), then run:
   ```bash
   ollama serve
   ollama pull llama3.2     # or qwen2.5, mistral, ...
   ```
2. Open OmniSuite → **Cấu hình hệ thống** → set **Nhà cung cấp AI mặc định = `Ollama`**.
   *Local default URL `http://localhost:11434` is used automatically — leave the URL field blank.*
3. (Optional, remote) Run Ollama on Colab / a server, expose via Cloudflare Tunnel, then paste the origin (no `/v1`) into **Ollama — URL máy chủ** and (if enabled) the bearer token into **Ollama — API Key**.

The launcher (`node launcher.js` / `npm run app`) auto-detects a running Ollama and lists installed models on startup.

**Chạy mượt với nhiều model trong Ollama (chống giật / nóng / VRAM tràn) — KHÔNG cần chỉnh `.env`:**

OmniSuite mặc định bật cả 3 lớp bảo vệ ngay khi cài (chỉ override khi bạn thật sự muốn):

1. **Sequential queue** — chỉ 1 inference Ollama chạy tại một thời điểm trong mỗi tiến trình (Next.js & Python engine). Xong task này rồi mới đến task tiếp.
2. **Auto-unload `keep_alive=30s`** — mỗi request đính kèm `keep_alive: "30s"`. Sau 30 giây không gọi nữa, daemon Ollama tự đẩy model ra khỏi VRAM/RAM. Gọi liên tiếp vẫn nhanh vì model còn “ấm”.
3. **Idle watcher 2 phút** — nếu OmniSuite phát hiện đã 2 phút không có inference, nó chủ động gọi `/api/ps` + `/api/generate {keep_alive:0}` cho mọi model đang load để giải phóng VRAM ngay.
4. **Cap `num_ctx=4096`** — nhiều Modelfile (llama3.2, llama3.1, qwen2.5...) khai báo `num_ctx=131072`; Ollama vì thế cấp KV-cache cho 128k token → một model 3B có thể đòi 13–16 GiB RAM. OmniSuite tự gửi `options.num_ctx=4096` để KV-cache nhỏ lại ~32× (3B chỉ cần ~3 GiB). Override bằng `OLLAMA_NUM_CTX=8192` nếu cần prompt dài, hoặc `OLLAMA_NUM_CTX=0` để dùng giá trị Modelfile.

> Nếu bạn vẫn gặp lỗi `model requires more system memory (X GiB) than is available`: tải model nhỏ hơn (`ollama pull llama3.2:1b`, `qwen2.5:1.5b`), hạ `OLLAMA_NUM_CTX=2048`, đóng app khác để giải phóng RAM, hoặc đặt `OLLAMA_KEEP_ALIVE=0`.

**Khi tắt app** (Ctrl+C trên launcher hoặc đóng `OmniSuite.exe`), launcher tự gọi unload tất cả model Ollama đang load trước khi thoát — không để model treo trong RAM.

Muốn override (tuỳ chọn): xem `.env.example` mục `OLLAMA_*`. Trên Windows/Linux có thể thêm `OLLAMA_NUM_PARALLEL`, `OLLAMA_MAX_LOADED_MODELS` cho daemon — chỉ tăng khi chắc chắn phần cứng chịu được.

### AI Hỗ trợ → Browser Agent (`/run`)

AI Hỗ trợ tích hợp sẵn `browser-use` (clone trong `integrations/ai-support/submodules/browser-use`). Mặc định **tắt vì lý do an toàn** — bật theo các bước sau khi bạn muốn AI thật sự **mở trình duyệt và làm task**:

1. **Cài Python deps cho browser-use** (lần đầu):
   ```bash
   cd integrations/ai-support/submodules/browser-use
   python -m venv .venv
   . .venv/Scripts/Activate.ps1     # Windows PowerShell
   pip install -e .
   python -m playwright install chromium
   ```
2. **Bật runner trong `.env`** (gốc dự án):
   ```
   AI_SUPPORT_RUNNER_ENABLED=true
   AI_SUPPORT_RUNNER_SECRET=your_runner_secret_here   # tuỳ chọn; nếu đặt thì UI gửi header x-internal-token khớp giá trị này
   ```
3. Mở `/dashboard/ai-support` → gõ `/run <task>`. Ví dụ:
   - `/run Tìm 10 sản phẩm camera Sony A7 IV trên ebay.com và liệt kê giá`
   - `/run Truy cập wikipedia.org, tóm tắt bài về Browser automation`

UI sẽ hiển thị **log streaming** (NDJSON) realtime: `ready` → `step N` → `done`. Có thể chạy với Ollama (mặc định `llama3.1:8b`), OpenAI, hoặc Gemini — chọn provider/model trong panel **Nâng cao**.

Pre-flight: `GET /api/ai-support/capabilities` báo cáo trạng thái runner (`runnerEnabled`, `python`, `browserUse`, `playwright`, kèm `setupHint` nếu thiếu).

#### Các integration khác đã được clone & wire (`integrations/`)

Gõ `/integrations` trong AI Hỗ trợ để xem bảng đầy đủ. Tóm tắt nhanh:

| Tính năng | Slash | Loại tích hợp | Cài đặt |
|---|---|---|---|
| `browser-use` (Browser Agent) | `/run` | runner | `pip install -e integrations/.../browser-use && python -m playwright install chromium` |
| `applypilot` (auto-apply jobs) | `/apply doctor\|init\|run\|apply` | runner | `pip install applypilot && pip install --no-deps python-jobspy && pip install pydantic tls-client requests markdownify regex` |
| `job-scraper` (score JD vs resume) | `/score <jd>` | runner | `cd integrations/job-scraper && pip install litellm google-genai pydantic python-dotenv pdfplumber reportlab html2text supabase` |
| `ai-resume-tailor` | — | external Next.js | `cd integrations/benchmarks/ai-resume-tailor && npm install && npm run dev` |
| `resume-lm` | — | external Next.js | `cd integrations/benchmarks/resume-lm && pnpm install && pnpm dev` |
| `job-ops` | — | Docker | `cd integrations/benchmarks/job-ops && docker compose up -d` |
| `mr-jobs` | — | Docker | `cd integrations/benchmarks/mr-jobs && docker compose up -d` |
| `career-ops` | — | Node + Claude/Gemini CLI | `cd integrations/career-ops && npm install` |

API hỗ trợ:
- `GET /api/ai-support/integrations` — quét đĩa, kiểm tra deps Python từng integration → trả `cloned/probeOk/setupHint`.
- `POST /api/ai-support/run` với `{ runner: "browser_use" | "applypilot" | "job_scraper", ... }` — NDJSON streaming.

### Security Before GitHub Push
1. Copy `.env.example` to `.env` and fill local secrets only on your machine.
2. Never commit `.env` (already ignored by `.gitignore`).
3. Run `npm run security:install-hooks` once per clone.
4. Run `npm run security:scan` before each push (CI also enforces this via GitHub Actions).

---

*Developed and maintained by NgoMinhHai.*

**Note:** `OmniSuite.exe` is not included in the GitHub repository. After cloning, run `npm run build:exe` to create your own executable.
