#!/usr/bin/env bash
# Tao .venv-runners — tuong duong setup-runners-venv.ps1 (Linux/macOS)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
VENV="${ROOT}/.venv-runners"
BROWSER_USE="${ROOT}/integrations/ai-support/submodules/browser-use"
OPEN_MANUS="${ROOT}/integrations/ai-support/submodules/open-manus"
REQ_EXTRA="${ROOT}/scripts/requirements-runners.txt"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Can tim thay python3 tren PATH" >&2
  exit 1
fi
if [[ ! -d "${BROWSER_USE}" ]]; then
  echo "Thieu browser-use submodule: ${BROWSER_USE}" >&2
  exit 1
fi
if [[ ! -d "${OPEN_MANUS}/app" ]]; then
  echo "Thieu OpenManus submodule: ${OPEN_MANUS} — chay npm run integrations:sync" >&2
  exit 1
fi

echo "[step] OpenManus config.toml seed ([daytona] bat buoc khi import app.config)"
mkdir -p "${OPEN_MANUS}/config"
cp "${ROOT}/scripts/openmanus-config-seed.toml" "${OPEN_MANUS}/config/config.toml"

if [[ ! -d "${VENV}" ]]; then
  python3 -m venv "${VENV}"
fi

PY="${VENV}/bin/python"
PIP="${VENV}/bin/pip"
PQ=(install --disable-pip-version-check)

"${PIP}" "${PQ[@]}" --upgrade pip wheel setuptools

(cd "${BROWSER_USE}" && "${PIP}" "${PQ[@]}" -e .)
SITE_PACKAGES=$("${PY}" -c 'import site; print(site.getsitepackages()[0])')
export OMNI_BU_SETUP="${BROWSER_USE}"
B64_BROWSER_USE=$("${PY}" -c 'import base64, os, pathlib; p = pathlib.Path(os.environ["OMNI_BU_SETUP"]).resolve(); print(base64.standard_b64encode(str(p).encode("utf-8")).decode("ascii"))')
unset OMNI_BU_SETUP
FIX_LINE="$(printf "import base64, pathlib, sys; _pth=str(pathlib.Path(base64.standard_b64decode('%s').decode('utf-8'))); ((_pth not in sys.path) and sys.path.insert(0, _pth))" "${B64_BROWSER_USE}")"
printf '%s\n' "${FIX_LINE}" > "${SITE_PACKAGES}/zzz_omnisuite_browser_use_utf8.pth"

"${PIP}" "${PQ[@]}" playwright

TMPREQ="$(mktemp)"
trap 'rm -f "${TMPREQ}"' EXIT
grep -v '^[[:space:]]*#' "${OPEN_MANUS}/requirements.txt" \
  | grep -vi 'browser-use' \
  | grep -vi '^[[:space:]]*crawl4ai' \
  | grep -vi '^[[:space:]]*pillow' \
  | grep -vi '^[[:space:]]*playwright' \
  | grep -v '^[[:space:]]*$' > "${TMPREQ}"
"${PIP}" "${PQ[@]}" -r "${TMPREQ}"

"${PIP}" "${PQ[@]}" 'crawl4ai>=0.8.0' 'pillow~=11.1.0' structlog 'daytona==0.21.8'

LEGACY_BU="${ROOT}/integrations/ai-support/runners/.legacy-browser-use-deps"
echo "[step] browser-use==0.1.40 --target cho OpenManus (/run)"
mkdir -p "${LEGACY_BU}"
"${PIP}" "${PQ[@]}" browser-use==0.1.40 --target "${LEGACY_BU}"

(cd "${BROWSER_USE}" && "${PIP}" "${PQ[@]}" -e .)

"${PY}" -m playwright install chromium
if [[ -f "${REQ_EXTRA}" ]]; then
  "${PIP}" "${PQ[@]}" -r "${REQ_EXTRA}"
fi
if [[ "${SKIP_APPLYPILOT:-}" != "1" ]]; then
  "${PIP}" "${PQ[@]}" applypilot
  "${PIP}" "${PQ[@]}" --no-deps python-jobspy
  "${PIP}" "${PQ[@]}" 'pydantic>=2' tls-client requests markdownify regex
fi

export OMNI_REPO_ROOT="${ROOT}"
"${PY}" -c 'import os, sys; from pathlib import Path; repo=Path(os.environ["OMNI_REPO_ROOT"]); leg=repo/"integrations"/"ai-support"/"runners"/".legacy-browser-use-deps"; om=repo/"integrations"/"ai-support"/"submodules"/"open-manus"; sys.path.insert(0,str(om.resolve())); sys.path.insert(0,str(leg.resolve())); from app.agent.manus import Manus; import browser_use; import playwright; print("open_manus+browser_use+playwright OK")'
unset OMNI_REPO_ROOT

export PYTHONPATH="${ROOT}/integrations/job-scraper"
"${PY}" -c "import llm_client; print('job-scraper llm_client OK')"
unset PYTHONPATH

echo ""
echo "[OK] Dat trong .env:"
echo "  PYTHON_BIN=${PY}"
echo "  AI_SUPPORT_RUNNER_ENABLED=true"
