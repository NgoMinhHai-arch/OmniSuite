# AI Support Integrations

This folder contains external agent runtimes used by **AI Butler** (`/dashboard/ai-support`).

## Submodules

- `submodules/browser-use` → https://github.com/browser-use/browser-use  
- `submodules/open-manus` → https://github.com/FoundationAgents/OpenManus  

Neither ZIP nor a plain `git clone` includes these folders with code. Users fetch them via `npm run integrations:fetch` or first-time `/run` / `/run-browser`.

### Initialize submodules (full URLs in `.gitmodules`)

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

Or (recommended — same on Windows / macOS / Linux):

```bash
npm run integrations:sync:all
```

Quick check (exit code 1 if missing):

```bash
npm run integrations:verify
```

Update submodules to **latest remote HEAD** (may differ from OmniSuite’s pinned commit):

```bash
npm run integrations:sync:upstream
```

Legacy wrappers (same logic):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/clone-integrations.ps1
```

```bash
bash scripts/clone-integrations.sh
```

On-demand fetch (one package):

```bash
npm run integrations:fetch -- open_manus
npm run integrations:fetch -- browser_use
```

## Bootstrap (all Python runners — recommended)

From the **OmniSuite repo root** (not only `integrations/ai-support`):

```powershell
# Windows — OpenManus (/run), browser-use + Playwright, job-scraper deps, ApplyPilot
.\scripts\setup-runners-venv.ps1
```

```bash
# Linux/macOS
bash scripts/setup-runners-venv.sh
```

Creates `.venv-runners/`. In `.env` set `PYTHON_BIN` to that venv’s Python and `AI_SUPPORT_RUNNER_ENABLED=true`.

### browser-use only (legacy)

```bash
cd integrations/ai-support/submodules/browser-use
python -m venv .venv
# Windows PowerShell
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

## Security gates for runner mode

- `AI_SUPPORT_RUNNER_SECRET`: optional; UI sends `x-internal-token` when set.
- `AI_SUPPORT_RUNNER_ENABLED=false`: default off. Enable only on trusted machines.

## Canonical browser capability

AI Butler normalizes browser frameworks to one ID:

- `browser-use` → `browser_agent`
- `stagehand` → `browser_agent`
- `selenium` → `browser_agent`

Keeps slash commands and plan JSON consistent.
