# OmniSuite AI — All-in-One SEO & Marketing Intelligence Hub

---

## Project status

This reflects **what is in this repository today**. **ZIP and `git clone` both ship only the OmniSuite app** — OpenManus, JobOps, browser-use, Crawl4AI, and other integrations are **not bundled**; users download each package when needed (`npm run integrations:fetch`, first `/run` in AI Butler, or manual `git clone` into `integrations/…`). Prefer **`git clone`** over ZIP (empty integration folders in archives). Dev-only: `npm run integrations:sync:all`.

### Shipped in-repo

- Next.js 16 (App Router) dashboard and SEO tooling
- Multi-provider AI (Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama** local/tunnel, **[9Router](https://github.com/decolua/9router)** proxy)
- Python **FastAPI** engine (`python_engine/`) with keyword, content, and job-related routes
- **One-click launcher** (`01_START_OMNISUITE.bat`) — smart setup, Big Update checks, `.env` repair, dependency caching, and browser auto-open
- **Developer fallback launcher** — older full setup path kept internally
- **AI support** UI (`/dashboard/ai-support`): chat, slash commands, planner
- **Runner API** `/api/ai-support/run` — OpenManus `/run`, browser-use `/run-browser`, optional ApplyPilot / job-scraper (**disabled by default**; optional shared secret)
- Integrations under `integrations/` (manifest + on-demand `integrations:fetch`; optional `integrations:sync:all` for devs)
- Security tooling: `npm run security:scan`, `security:scan:staged`, `security:install-hooks`
- `.env.example` and `.gitignore` excluding `.env`, `.venv-runners/`, and nested **`open-interpreter/`** (not tracked)

### Partial / depends on your machine

- **Browser agent:** requires Playwright Chromium and Python deps in the submodule path; enable runner env flags in `.env`
- **Integrations** (ApplyPilot, job-scraper, Docker apps): submodule paths exist; **you** install dependencies and run services
- API routes assume a **trusted or local network** — no global auth middleware on every `/api/*`
- **`OmniSuite.exe`** is **not** on GitHub; build locally with `npm run build:exe`

### Not included / out of scope

- Hosted SaaS hardening (rate limits, org RBAC, audit logs) — **not** promised here
- **`open-interpreter`** — intentionally **not** tracked (nested clone); add locally only if you need it
- A single unified E2E suite across all SEO modules — coverage **varies by module**

---

**What OmniSuite is:** An ecosystem for SEO/marketing workflows: keyword intelligence, scraping, dashboards, and AI-assisted automation — including optional **local** LLMs via [Ollama](https://ollama.com).

---

## Key features

### SEO intelligence

- **Page analyzer:** On-page SEO, headings, keyword density
- **Bulk metrics:** Volume, CPC, difficulty at scale
- **Competitor gap:** Keyword opportunities vs competitors

### AI-driven insights

- **Intent engine:** Search-intent classification with multimodal models
- **Providers:** Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama**, **9Router**
- **Local-first:** Offline-capable with Ollama (no cloud API key required)

### Advanced scraping

- Stealth-oriented flows (Puppeteer Stealth and Playwright)
- Python core for heavier processing
- Parse PDF, DOCX, and XLSX

### Dashboard

- Interactive UI, charts, keyword hub with caching

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

## Project structure

- `src/app/api/` — Route handlers (AI, SEO, runners)
- `src/components/features/` — Feature modules
- `python_engine/` — FastAPI services
- `integrations/` — Git submodules (AI support stacks, benchmarks)
- `scripts/` — One-click launcher, setup/repair, submodule sync, security scans, runner venv helpers

---

## Getting started

### Requirements

Node.js 18+, Python 3.10+, Git recommended.

### Recommended - Start mode

Use this when you just want OmniSuite to start.

#### Windows

Double-click:

```powershell
01_START_OMNISUITE.bat
```

The only user-facing Windows buttons are:

- `01_START_OMNISUITE.bat`
- `02_STOP_OMNISUITE.bat`
- `03_UNINSTALL_OMNISUITE.bat`

### What Start mode does

The new Start launcher is designed for one-click startup:

- uses the System Spine contract in `config/omnisuite.system.json` as the shared skeleton;
- runs a doctor check before startup so file/service/dependency drift is caught early;
- creates/repairs `.env` when missing;
- generates `INTERNAL_TOKEN`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` automatically;
- sets a safe local default for `PYTHON_ENGINE_URL`;
- uses `DATABASE_URL=skip` by default so PostgreSQL is not required for local use;
- keeps Python packages and large caches under `.omnisuite/` in the project folder;
- checks Node.js and Python;
- pulls new Git commits only when the working tree is clean;
- runs full setup only on first run or when dependency files change;
- skips `npm install`, `pip install`, and Playwright download on normal runs;
- starts only the services that are not already running;
- opens `http://localhost:3000` automatically.

### Big Update mode

Use this when you want to refresh the system skeleton, re-check file links, rewrite the runtime snapshot, and repair important runtime dependencies without manually typing setup commands.

For normal Windows users, Big Update runs inside `01_START_OMNISUITE.bat`.

Developer equivalent:

```bash
npm run big:update
```

### Repair mode

Use repair mode when dependencies are broken, Playwright is missing, or the app behaves strangely after an update.

For normal Windows users, double-click `01_START_OMNISUITE.bat` again. It self-repairs and retries.

Developer equivalent:

```bash
npm run repair
```

### Legacy launcher (developer fallback)

The old launcher is still available as a fallback:

```bash
npm run legacy:app
```

Build a Windows executable:

```bash
npm run build:exe
```

Then run `OmniSuite.exe`.

### Manual development mode

Manual mode is for development, not for normal users.

```bash
npm install
python -m pip install --upgrade --target .omnisuite/python-packages -r requirements.txt
```

Start mode creates `.env` automatically. In manual mode, copy `.env.example` to `.env`, configure secrets locally, then:

```bash
npm run dev
```

Note: `npm run dev` does not perform the same smart `.env` and dependency repair as Start mode. For normal use, prefer `01_START_OMNISUITE.bat`.

### Integrations (not bundled — ZIP or clone)

**Neither ZIP nor `git clone` includes** OpenManus, JobOps, browser-use, or other integration code. After clone:

```bash
npm install
# AI Butler (/dashboard/ai-support): /tai-bang shows downloaded vs missing
# First /run or /run-browser can auto-fetch one package (requires Git)
npm run integrations:fetch -- open_manus
npm run integrations:fetch -- browser_use
```

Dev (fetch everything): `npm run integrations:sync:all`  
Verify: `npm run integrations:verify`  
Docs: [`integrations/README.md`](integrations/README.md) · [`integrations/ai-support/README.md`](integrations/ai-support/README.md) · [README_Simple.md](README_Simple.md)

### User-facing Windows buttons

| Command | Description |
| :--- | :--- |
| `01_START_OMNISUITE.bat` | One-click start, self-check, Big Update, repair, and retry |
| `02_STOP_OMNISUITE.bat` | Stop running OmniSuite services |
| `03_UNINSTALL_OMNISUITE.bat` | Clean uninstall |

### Developer commands

| Command | Description |
| :--- | :--- |
| `npm run go` | Internal smart launcher |
| `npm run app` | Same as `npm run go` |
| `npm run repair` | Internal repair mode |
| `npm run big:update` | Big Update from terminal |
| `npm run legacy:app` | Old launcher fallback |
| `npm run build:exe` | Build `OmniSuite.exe` |
| `npm run dev` | Manual dev mode (frontend + Python engine only) |
| `npm run integrations:fetch -- <id>` | Fetch one integration (on demand) |
| `npm run integrations:sync:all` | Fetch all submodules (dev) |
| `npm run integrations:verify` | Warn/fail if paths or runners are missing |
| `npm run integrations:sync:upstream` | Advance submodules toward remote HEAD |
| `npm run dev:next` | Next.js only |
| `npm run dev:engine` | Python engine only |
| `npm run security:scan` | Scan tracked files for obvious secrets |
| `npm run security:scan:staged` | Scan staged changes |
| `npm run security:install-hooks` | Install git hooks for security scans |

### System requirements

Node 18+, Python 3.10+, API keys in `.env` or Dashboard Settings as needed, optional Ollama for local LLM inference.

### API keys (Gemini / OpenAI / …)

- Enter keys in **Dashboard → Settings** (saved in `localStorage`, not committed to git).
- If logs/console show `API key expired` or `List Models Critical Error`: generate a new key at [Google AI Studio](https://aistudio.google.com/apikey) (Gemini) or the respective provider's console, and update Settings.
- If a key is exposed in logs/URLs, you should **revoke** it on the provider's console and generate a new one.

 [SECURITY.md](SECURITY.md)

---

## Ollama (local LLM, no cloud key)

1. Install from [ollama.com](https://ollama.com), run `ollama serve`, then `ollama pull <model>`.
2. In OmniSuite **Settings**, set the default provider to **Ollama**. Leave the URL blank to use `http://localhost:11434`.
3. For a remote tunnel, paste the **origin** only (no `/v1`). Optional bearer token goes in **Ollama API Key**.

**VRAM / RAM friendly defaults:** sequential inference queue, `keep_alive` tuning, idle unload, optional `num_ctx` cap — see `.env.example` (`OLLAMA_*`). The launcher attempts to unload loaded models on exit.

---

## 9Router (free AI proxy, OpenAI-compatible)

[9Router](https://github.com/decolua/9router) routes CLI tools and OpenAI-compatible clients to 40+ providers (subscription, cheap, and free tiers) with optional RTK token savings and auto-fallback.

1. Install and start: `npm i -g 9router` then `9router` (dashboard at `http://127.0.0.1:20128`).
2. In the 9Router dashboard, connect providers (e.g. Kiro AI, OpenCode Free) and copy an **API key**.
3. In OmniSuite **Settings**, set the default provider to **9Router**, paste the API key, and leave the URL blank to use `http://127.0.0.1:20128`.
4. Pick a model from the list (e.g. `cc/claude-sonnet-4-5`, `kr/claude-sonnet-4.5`) — names match 9Router combos.

**Python engine only (all providers via 9Router):** set `LITELLM_BASE_URL=http://127.0.0.1:20128` in `.env` (origin without `/v1`). See `.env.example`.

---

## AI support → browser agent (`/run`)

`browser-use` lives under `integrations/ai-support/submodules/browser-use`. **Disabled by default** — enable only on trusted machines.

### Fast setup

From the repository root:

```powershell
.\scripts\setup-runners-venv.ps1
```

Linux/macOS:

```bash
bash scripts/setup-runners-venv.sh
```

This creates `.venv-runners`, installs OpenManus/browser-use dependencies, and installs Playwright Chromium/headless shell with fallback repair.

### Repository root `.env`

```
AI_SUPPORT_RUNNER_ENABLED=true
PYTHON_BIN=.venv-runners\Scripts\python.exe
AI_SUPPORT_RUNNER_SECRET=your_runner_secret_here   # optional; if set, the UI sends x-internal-token with the same value
```

Linux/macOS `PYTHON_BIN` example:

```
PYTHON_BIN=.venv-runners/bin/python
```

Then open **`/dashboard/ai-support`** and run **`/run <task>`** or **`/run-browser …`**.

Streaming NDJSON logs: `ready` → `step` → `done`. Preflight: `GET /api/ai-support/capabilities`.

### Integrations summary

Use **`/integrations`** in the AI support UI for the live registry.

| Feature | Slash | Type | Setup hint |
| :--- | :--- | :--- | :--- |
| browser-use | `/run`, `/run-browser` | runner | `scripts/setup-runners-venv.ps1` or `scripts/setup-runners-venv.sh` |
| ApplyPilot | `/apply …` | runner | Python deps per integration docs |
| job-scraper | `/score` | runner | See `integrations/job-scraper` |
| ai-resume-tailor | — | external Next | `npm install && npm run dev` in submodule |
| resume-lm | — | external Next | `pnpm install && pnpm dev` |
| job-ops / mr-jobs | — | Docker | `docker compose up` |
| career-ops | — | Node CLI | `npm install` |

**APIs:** `GET /api/ai-support/integrations`, `POST /api/ai-support/run` (NDJSON).

---

## Security before pushing to GitHub

1. Never commit `.env` (already gitignored).
2. Run `npm run security:install-hooks` once per clone.
3. Run `npm run security:scan` before each push.

---

*Developed and maintained by NgoMinhHai.*

**Note:** `OmniSuite.exe` is not included in the repository; run `npm run build:exe` after cloning.


