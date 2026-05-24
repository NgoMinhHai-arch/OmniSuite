# AI Support Integrations

This folder contains external agent runtimes used by AI Support.

## Submodules

- `submodules/browser-use` -> https://github.com/browser-use/browser-use
- `submodules/open-manus` -> https://github.com/FoundationAgents/OpenManus

Initialize submodules (đầy đủ URL trong `.gitmodules`):

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

Hoặc (khuyến nghị — dùng npm, giống nhau trên Windows / macOS / Linux):

```bash
npm run integrations:sync
```

Kiểm tra nhanh submodule đã init đủ chưa (thoát mã 1 nếu thiếu):

```bash
npm run integrations:verify
```

Cập nhật submodule lên **HEAD mới nhất trên remote** (có thể lệch khỏi commit pin của OmniSuite):

```bash
npm run integrations:sync:upstream
```

---

Script cũ bọc cùng logic:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/clone-integrations.ps1
```

```bash
bash scripts/clone-integrations.sh
```

`npm run integrations:sync` đồng bộ submodule (trong đó có OpenManus) và **shallow clone** `integrations/ai-support/submodules/open-manus` nếu chưa có (mirror khi clone tay không dùng submodule).

## Bootstrap (tất cả runner Python — khuyến nghị)

Từ **root repo** OmniSuite (không phải chỉ thư mục `integrations/ai-support`):

```powershell
# Windows — OpenManus (/run), browser-use + Playwright, job-scraper deps, ApplyPilot
.\scripts\setup-runners-venv.ps1
```

```bash
# Linux/macOS
bash scripts/setup-runners-venv.sh
```

Tạo `.venv-runners/`. Trong `.env` đặt `PYTHON_BIN` trỏ tới Python của venv đó và `AI_SUPPORT_RUNNER_ENABLED=true`.

### Chỉ browser-use (legacy)

```bash
cd integrations/ai-support/submodules/browser-use
python -m venv .venv
# Windows PowerShell
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

## Security gates for runner mode

- `INTERNAL_TOKEN`: required for any future route that can spawn shell/Python.
- `AI_SUPPORT_RUNNER_ENABLED=false`: default disabled. Enable only in trusted environments.

## Canonical browser capability

AI Support normalizes duplicate browser-control frameworks to one canonical ID:

- `browser-use` -> `browser_agent`
- `stagehand` -> `browser_agent`
- `selenium` -> `browser_agent`

This keeps user-facing slash commands and plan JSON consistent.
