# OmniSuite AI — All-in-One SEO & Marketing Intelligence Hub

---

## Project status · Trạng thái dự án

Everything below is **what is true today in this repository** (clone after `git submodule update --init --recursive` where needed).

### Done · Đã hoàn thành (trên repo)

| EN | VI |
| :--- | :--- |
| Next.js 16 (App Router) dashboard + SEO tooling surface | Giao diện dashboard + bộ công cụ SEO trên Next.js 16 |
| Multi-provider AI wiring (Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama local/tunnel**) | Tích hợp nhiều nhà cung cấp AI + Ollama (local / tunnel) |
| Python **FastAPI** engine (`python_engine/`) + keyword / content / job-related routes | Backend Python FastAPI, route keyword & content & job |
| **Launcher** (`node launcher.js` / `npm run app`) — starts stack, optional browser open to localhost | Launcher khởi động stack, có thể mở trình duyệt localhost |
| **AI Hỗ trợ** UI (`/dashboard/ai-support`): chat, slash commands, planner | Trang Quản gia: chat, slash, kế hoạch |
| **Runner bridge** `/api/ai-support/run` — OpenManus `/run`, browser-use `/run-browser`, optional ApplyPilot / job-scraper (**off by default**, secret optional) | API runner (OpenManus, browser-use…) — **mặc định tắt**, có thể khóa secret |
| Git **submodules** under `integrations/` + `npm run integrations:sync` / `integrations:verify` | Submodule `integrations/` + script đồng bộ / kiểm tra |
| Security scripts + hooks: `npm run security:scan`, `security:scan:staged`, `security:install-hooks` | Quét secret trước commit/push + hook |
| `.env.example` + `.gitignore` excluding `.env`, `.venv-runners/`, nested `open-interpreter/` | Mẫu `.env`; không commit secret / venv runner / thư mục clone lồng |

### Partial / optional · Một phần hoặc tuỳ chọn (phụ thuộc máy bạn)

| EN | VI |
| :--- | :--- |
| **Browser agent:** needs Playwright Chromium + Python deps in submodule path; runner env flags | **Browser agent:** cần cài Playwright + deps Python trong submodule; bật biến môi trường runner |
| **Integrations table** (ApplyPilot, job-scraper, Docker apps): paths exist as submodules; **you** install deps / run services | Các integration có submodule; **bạn** tự cài deps / chạy Docker |
| API routes assume **trusted/local network** — no global auth middleware on every `/api/*` | API thiết kế kiểu **mạng tin cậy / local** — chưa có middleware đăng nhập cho mọi `/api/*` |
| `OmniSuite.exe` — **not** in GitHub; build locally with `npm run build:exe` | File `.exe` **không** có trên GitHub; tự build |

### Not done / out of scope · Chưa làm hoặc không đưa vào repo

| EN | VI |
| :--- | :--- |
| Hosted SaaS hardening (rate limits, org RBAC, audit logs) — **not** promised here | Hard SaaS (rate limit, RBAC, audit) — **không** cam kết trong repo này |
| **`open-interpreter`** folder — intentionally **not** tracked (nested clone); add yourself if needed | Thư mục **`open-interpreter`** — **không** đưa lên Git (clone riêng nếu cần) |
| Unified automated E2E suite across all SEO tools — varies by module | Bộ E2E thống nhất cho mọi SEO tool — chưa có cam kết đầy đủ |

---

**EN — What OmniSuite is:** A comprehensive ecosystem to automate SEO/marketing workflows: keyword intelligence, scraping, dashboards, and AI-assisted tasks — with optional **local** LLMs via Ollama.

**VI — OmniSuite là gì:** Hệ sinh thái hỗ trợ SEO/marketing: keyword, scrape, dashboard và tác vụ AI — có thể chạy LLM **local** qua Ollama.

---

## Key features · Tính năng chính

### SEO intelligence · Trí tuệ SEO

**EN**
- **Page analyzer:** On-page SEO, headings, density.
- **Bulk metrics:** Volume, CPC, difficulty at scale.
- **Competitor gap:** Find keyword opportunities vs competitors.

**VI**
- **Phân tích trang:** SEO on-page, heading, mật độ từ khóa.
- **Bulk metrics:** Volume, CPC, độ khó cho danh sách lớn.
- **Competitor gap:** Cơ hội từ khóa so với đối thủ.

### AI-driven insights · AI đa nhà cung cấp

**EN**
- **Intent engine:** Classify search intent with multimodal models.
- **Providers:** Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama**.
- **Local-first:** Offline-capable with [Ollama](https://ollama.com) (no cloud key).

**VI**
- **Intent:** Phân loại intent tìm kiếm.
- **Nhà cung cấp:** Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama**.
- **Ưu tiên local:** Chạy offline với Ollama (không bắt buộc cloud key).

### Advanced scraping · Scraping nâng cao

**EN**
- Stealth-oriented flows (Puppeteer Stealth & Playwright).
- Python core for heavy processing.
- Parse PDF, DOCX, XLSX.

**VI**
- Luồng gần stealth (Puppeteer Stealth & Playwright).
- Python xử lý nặng.
- Đọc PDF, DOCX, XLSX.

### Dashboard · Bảng điều khiển

**EN**
- Interactive UI, charts, keyword hub with caching.

**VI**
- Giao diện tương tác, biểu đồ, hub từ khóa có cache.

---

## Tech stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 16 (App Router)](https://nextjs.org), React 19, Tailwind CSS 4 |
| **UI** | Framer Motion, Lucide React |
| **AI SDK** | [Vercel AI SDK](https://sdk.vercel.ai/docs), Google Generative AI, OpenAI |
| **Backend** | Python (FastAPI), Puppeteer Stealth, Playwright |
| **Data** | SQLite, Cheerio, Mammoth, PDF-Parse |

---

## Project structure · Cấu trúc

**EN**
- `src/app/api/` — Route handlers (AI, SEO, runners).
- `src/components/features/` — Feature modules.
- `python_engine/` — FastAPI services.
- `integrations/` — Git submodules (AI support stacks, benchmarks).
- `scripts/` — Sync, security, runner venv helpers.

**VI**
- `src/app/api/` — API Next.js.
- `python_engine/` — FastAPI.
- `integrations/` — Submodule (tích hợp ngoài).
- `scripts/` — Đồng bộ submodule, security, setup venv runner.

---

## Getting started · Bắt đầu

### Quick start · Khởi động nhanh

**Requirements · Yêu cầu:** Node.js 18+, Python 3.10+

#### Option 1 — Launcher (recommended · khuyên dùng)

```bash
node launcher.js
# or
npm run app
```

Build Windows executable · **Tạo file .exe:**

```bash
npm run build:exe
```

Then run · Sau đó chạy `OmniSuite.exe`.

#### Option 2 — Manual · Thủ công

```bash
npm install
pip install -r requirements.txt
```

Copy `.env.example` → `.env`, then · **Sao chép `.env.example` → `.env`, rồi:**

```bash
npm run dev
```

### Integrations (submodules)

**EN:** After `git clone`, pull submodules:

```bash
npm run integrations:sync
```

Verify · **Kiểm tra:** `npm run integrations:verify`.  
More · **Chi tiết AI runner:** [`integrations/ai-support/README.md`](integrations/ai-support/README.md).

### Useful commands · Lệnh hay dùng

| Command | EN | VI |
| :--- | :--- | :--- |
| `npm run app` | Launcher | Chạy launcher |
| `npm run build:exe` | Build `.exe` | Build file `.exe` |
| `npm run dev` | Dev (frontend + backends) | Dev đầy đủ |
| `npm run integrations:sync` | Fetch submodules | Kéo submodule |
| `npm run integrations:verify` | Fail if submodules missing | Lỗi nếu thiếu submodule |
| `npm run integrations:sync:upstream` | Advance submodules to remote HEAD | Cập nhật submodule theo remote |
| `npm run dev:next` | Next.js only | Chỉ Next.js |
| `npm run dev:engine` | Python engine only | Chỉ Python engine |
| `npm run security:scan` | Scan repo for secrets | Quét secret |
| `npm run security:scan:staged` | Scan staged diff | Quét diff đã stage |
| `npm run security:install-hooks` | Install git hooks | Cài hook git |

### System requirements · Yêu cầu hệ thống

**EN:** Node 18+, Python 3.10+, API keys in `.env` as needed, optional Ollama for local LLM.

**VI:** Node 18+, Python 3.10+, điền key vào `.env` khi cần, Ollama tuỳ chọn cho LLM local.

---

## Ollama (local LLM, no cloud key)

**EN**
1. Install from [ollama.com](https://ollama.com), run `ollama serve`, `ollama pull <model>`.
2. In OmniSuite **Settings**, set default provider to **Ollama**. Leave URL blank for `http://localhost:11434`.
3. Remote: paste tunnel **origin** (no `/v1`); optional bearer in **Ollama API Key**.

**VI**
1. Cài Ollama, chạy `ollama serve`, `ollama pull <model>`.
2. Trong **Cấu hình**, chọn nhà cung cấp **Ollama**. Để trống URL = `http://localhost:11434`.
3. Remote: dán **origin** tunnel (không có `/v1`); bearer tuỳ chọn.

**Smooth multi-model defaults (VRAM / RAM friendly)**

**EN:** Sequential inference queue, `keep_alive` tuning, idle unload, optional `num_ctx` cap — see `.env.example` (`OLLAMA_*`). Launcher attempts unload on exit.

**VI:** Hàng đợi tuần tự, `keep_alive`, unload khi rảnh, giới hạn `num_ctx` — xem `.env.example`. Launcher cố unload model khi thoát.

---

## AI support → Browser agent (`/run`)

**EN:** `browser-use` lives under `integrations/ai-support/submodules/browser-use`. **Disabled by default.** Enable only on trusted machines.

**VI:** `browser-use` nằm trong submodule. **Mặc định tắt.** Chỉ bật máy tin cậy.

1. **Install deps (first time)**

```bash
cd integrations/ai-support/submodules/browser-use
python -m venv .venv
# Windows PowerShell:
. .venv/Scripts/Activate.ps1
pip install -e .
python -m playwright install chromium
```

2. **`.env` at repo root**

```
AI_SUPPORT_RUNNER_ENABLED=true
AI_SUPPORT_RUNNER_SECRET=your_runner_secret_here   # optional; if set, UI sends matching x-internal-token header
```

**VI:** `AI_SUPPORT_RUNNER_SECRET` **tuỳ chọn** — nếu có giá trị thật, UI gửi header `x-internal-token` khớp.

3. Open **`/dashboard/ai-support`**, run **`/run <task>`** or **`/run-browser …`**.

**EN:** Stream NDJSON logs (`ready` → `step` → `done`). Preflight: `GET /api/ai-support/capabilities`.

**VI:** Log NDJSON realtime. Kiểm tra nhanh: `GET /api/ai-support/capabilities`.

### Integrations summary · Bảng tích hợp

**EN:** Type `/integrations` in AI support for the live registry.

**VI:** Gõ `/integrations` trong Quản gia để xem bảng đầy đủ.

| Feature | Slash | Type | Setup hint |
| :--- | :--- | :--- | :--- |
| browser-use | `/run`, `/run-browser` | runner | `pip install -e …/browser-use && playwright install chromium` |
| ApplyPilot | `/apply …` | runner | Python deps per integration README |
| job-scraper | `/score` | runner | See `integrations/job-scraper` |
| ai-resume-tailor | — | external Next | `npm install && npm run dev` in submodule |
| resume-lm | — | external Next | `pnpm install && pnpm dev` |
| job-ops / mr-jobs | — | Docker | `docker compose up` |
| career-ops | — | Node CLI | `npm install` |

**APIs:** `GET /api/ai-support/integrations`, `POST /api/ai-support/run` (NDJSON).

---

## Security before GitHub push · Bảo mật khi đẩy Git

**EN**
1. Never commit `.env`.
2. Run `npm run security:install-hooks` once per clone.
3. Run `npm run security:scan` before push.

**VI**
1. Không commit `.env`.
2. Cài hook security một lần mỗi clone.
3. Chạy `npm run security:scan` trước khi push.

---

*Developed and maintained by NgoMinhHai.*

**Note · Lưu ý:** `OmniSuite.exe` is **not** on GitHub — build with · **không có trên GitHub** — tự build bằng `npm run build:exe`.
