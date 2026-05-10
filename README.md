# OmniSuite AI — All-in-One SEO & Marketing Intelligence Hub

---

## Project status

This reflects **what is in this repository today**. After cloning, run `git submodule update --init --recursive` where integrations are needed.

### Shipped in-repo

- Next.js 16 (App Router) dashboard and SEO tooling
- Multi-provider AI (Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama** local/tunnel)
- Python **FastAPI** engine (`python_engine/`) with keyword, content, and job-related routes
- **Launcher** (`node launcher.js` / `npm run app`) — starts the stack; optional browser open to localhost
- **AI support** UI (`/dashboard/ai-support`): chat, slash commands, planner
- **Runner API** `/api/ai-support/run` — OpenManus `/run`, browser-use `/run-browser`, optional ApplyPilot / job-scraper (**disabled by default**; optional shared secret)
- Git **submodules** under `integrations/` plus `npm run integrations:sync` / `integrations:verify`
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
- **Providers:** Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, **Ollama**
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
- `scripts/` — Submodule sync, security scans, runner venv helpers

---

## Getting started

### Requirements

Node.js 18+, Python 3.10+

### Option 1 — Launcher (recommended)

```bash
node launcher.js
# or
npm run app
```

Build a Windows executable:

```bash
npm run build:exe
```

Then run `OmniSuite.exe`.

### Option 2 — Manual

```bash
npm install
pip install -r requirements.txt
```

Copy `.env.example` to `.env`, configure secrets locally, then:

```bash
npm run dev
```

### Integrations (submodules)

After `git clone`, sync submodules:

```bash
npm run integrations:sync
```

Verify: `npm run integrations:verify`.  
Runner details: [`integrations/ai-support/README.md`](integrations/ai-support/README.md).

### Useful commands

| Command | Description |
| :--- | :--- |
| `npm run app` | Run via launcher |
| `npm run build:exe` | Build `OmniSuite.exe` |
| `npm run dev` | Dev mode (frontend + backends) |
| `npm run integrations:sync` | Fetch/update submodules |
| `npm run integrations:verify` | Fail if submodules are missing |
| `npm run integrations:sync:upstream` | Advance submodules toward remote HEAD |
| `npm run dev:next` | Next.js only |
| `npm run dev:engine` | Python engine only |
| `npm run security:scan` | Scan tracked files for obvious secrets |
| `npm run security:scan:staged` | Scan staged changes |
| `npm run security:install-hooks` | Install git hooks for security scans |

### System requirements

Node 18+, Python 3.10+, API keys in `.env` as needed, optional Ollama for local LLM inference.

---

## Ollama (local LLM, no cloud key)

1. Install from [ollama.com](https://ollama.com), run `ollama serve`, then `ollama pull <model>`.
2. In OmniSuite **Settings**, set the default provider to **Ollama**. Leave the URL blank to use `http://localhost:11434`.
3. For a remote tunnel, paste the **origin** only (no `/v1`). Optional bearer token goes in **Ollama API Key**.

**VRAM / RAM friendly defaults:** sequential inference queue, `keep_alive` tuning, idle unload, optional `num_ctx` cap — see `.env.example` (`OLLAMA_*`). The launcher attempts to unload loaded models on exit.

---

## AI support → browser agent (`/run`)

`browser-use` lives under `integrations/ai-support/submodules/browser-use`. **Disabled by default** — enable only on trusted machines.

1. **Install dependencies (first time)**

```bash
cd integrations/ai-support/submodules/browser-use
python -m venv .venv
# Windows PowerShell:
. .venv/Scripts/Activate.ps1
pip install -e .
python -m playwright install chromium
```

2. **Repository root `.env`**

```
AI_SUPPORT_RUNNER_ENABLED=true
AI_SUPPORT_RUNNER_SECRET=your_runner_secret_here   # optional; if set, the UI sends x-internal-token with the same value
```

3. Open **`/dashboard/ai-support`** and run **`/run <task>`** or **`/run-browser …`**.

Streaming NDJSON logs: `ready` → `step` → `done`. Preflight: `GET /api/ai-support/capabilities`.

### Integrations summary

Use **`/integrations`** in the AI support UI for the live registry.

| Feature | Slash | Type | Setup hint |
| :--- | :--- | :--- | :--- |
| browser-use | `/run`, `/run-browser` | runner | `pip install -e …/browser-use && playwright install chromium` |
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
Invisible Potential: The true power of this framework lies beneath the surface. To unlock 200% of its performance, you are encouraged to explore the internal logic of our integrations and runners.
