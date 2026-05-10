#Requires -Version 5.1
<#
  Tao .venv-runners (Python RIENG cho Quan gia) - tranh xung dot voi FastAPI/global Python.

  Cai:
    - OpenManus (submodule) + requirements (/run)
    - browser-use (editable) + Playwright chromium  (/run-browser)
    - job-scraper requirements  (/score)
    - applypilot + phu tro ApplyPilot  (/apply)

  Sau khi chay: dat PYTHON_BIN trong .env toi python trong .venv-runners
  (xem cuoi script in duong dan).
#>

param(
    [switch]$SkipApplyPilot
)

$ErrorActionPreference = 'Stop'

# Repo path co ky tu Unicode (vi du Dữ Liệu): tranh pip/Rich UnicodeEncodeError tren console cp1252
try { chcp 65001 | Out-Null } catch {}
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$VenvDir = Join-Path $RepoRoot '.venv-runners'
$BrowserUse = Join-Path $RepoRoot 'integrations\ai-support\submodules\browser-use'
$OpenManus = Join-Path $RepoRoot 'integrations\ai-support\submodules\open-manus'
$ReqExtra = Join-Path $RepoRoot 'scripts\requirements-runners.txt'

function Write-Step([string]$m) { Write-Host "[*] $m" -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Warn([string]$m) { Write-Host "[!] $m" -ForegroundColor Yellow }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Khong tim thay python tren PATH. Cai Python 3.11+ hoac chay scripts/ensure-runtime.ps1" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $BrowserUse)) {
    Write-Host "Thieu browser-use submodule tai: $BrowserUse" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $OpenManus 'app'))) {
    Write-Host "Thieu OpenManus submodule tai: $OpenManus (npm run integrations:sync)" -ForegroundColor Red
    exit 1
}

Write-Step 'OpenManus config.toml seed ([daytona] bat buoc khi import app.config)'
$OmSeed = Join-Path $PSScriptRoot 'openmanus-config-seed.toml'
$OmCfgOut = Join-Path $OpenManus 'config\config.toml'
if (-not (Test-Path $OmSeed)) { throw "Thieu $OmSeed" }
New-Item -ItemType Directory -Path (Split-Path $OmCfgOut) -Force | Out-Null
Copy-Item -LiteralPath $OmSeed -Destination $OmCfgOut -Force

Write-Step "Tao venv: $VenvDir"
if (Test-Path $VenvDir) {
    Write-Warn "Da ton tai .venv-runners - dung lai (xoa thu muc neu muon cai sach)."
} else {
    python -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) { throw 'python -m venv failed' }
}

$Py = Join-Path $VenvDir 'Scripts\python.exe'
$Pip = Join-Path $VenvDir 'Scripts\pip.exe'
$PipQuiet = @('--disable-pip-version-check')

function Invoke-QuietPip {
    param([Parameter(Mandatory)] [string[]]$PipArguments)
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $pipOut = & $Pip @PipArguments 2>&1
        $pipOut | ForEach-Object { Write-Host $_ }
    }
    finally {
        $ErrorActionPreference = $oldEap
    }
    if ($LASTEXITCODE -ne 0) { throw "pip failed ($LASTEXITCODE): pip $($PipArguments -join ' ')" }
}

Write-Step 'pip upgrade + wheel + setuptools'
$a = @('install') + $PipQuiet + @('--upgrade', 'pip', 'wheel', 'setuptools'); Invoke-QuietPip $a

Write-Step 'browser-use editable (/run-browser); sau do OpenManus reqs — se cai lai editable'
Push-Location $BrowserUse
try {
    $b = @('install') + $PipQuiet + @('-e', '.'); Invoke-QuietPip $b
}
finally {
    Pop-Location
}

Write-Step 'browser-use .pth: them zzz..._utf8.pth (Python doc file .pth bang encoding locale; duong Unicode bi loi)'
$SitePkgs = Join-Path $VenvDir 'Lib\site-packages'
$BuResolved = (Resolve-Path $BrowserUse).Path
$env:OMNI_BU_SETUP = $BuResolved
try {
    $b64OneLine = & $Py -c "import base64, os, pathlib; p = pathlib.Path(os.environ['OMNI_BU_SETUP']).resolve(); print(base64.standard_b64encode(str(p).encode('utf-8')).decode('ascii'))"
    if ($LASTEXITCODE -ne 0) { throw 'base64 browser-use path failed' }
}
finally {
    Remove-Item Env:OMNI_BU_SETUP -ErrorAction SilentlyContinue
}
$FixPthName = Join-Path $SitePkgs 'zzz_omnisuite_browser_use_utf8.pth'
$FixLine = "import base64, pathlib, sys; _pth=str(pathlib.Path(base64.standard_b64decode('$b64OneLine').decode('utf-8'))); ((_pth not in sys.path) and sys.path.insert(0, _pth))"
[System.IO.File]::WriteAllText($FixPthName, $FixLine + "`n", [System.Text.Encoding]::ASCII)

Write-Step 'pip: playwright (browser-use khong kem package)'
Invoke-QuietPip (@('install') + $PipQuiet + @('playwright'))

Write-Step 'OpenManus requirements (/run) — bo dong browser-use (giu browser-use editable OmniSuite)'
$OmReq = Join-Path $OpenManus 'requirements.txt'
if (-not (Test-Path $OmReq)) { throw "Thieu $OmReq" }
$TmpOmReq = Join-Path ([System.IO.Path]::GetTempPath()) ("omni-openmanus-req-{0}.txt" -f [System.Guid]::NewGuid().ToString('n'))
try {
    Get-Content -LiteralPath $OmReq | Where-Object {
            $_ -notmatch '^\s*#' -and $_.Trim() -ne '' -and
            $_ -notmatch '^\s*browser-use\b' -and
            $_ -notmatch '^\s*crawl4ai\b' -and
            $_ -notmatch '^\s*pillow\b' -and
            $_ -notmatch '^\s*playwright\b'
        } | Set-Content -LiteralPath $TmpOmReq -Encoding utf8
    Invoke-QuietPip (@('install') + $PipQuiet + @('-r', $TmpOmReq))
}
finally {
    Remove-Item -LiteralPath $TmpOmReq -Force -ErrorAction SilentlyContinue
}

Write-Step 'crawl4ai + pillow + structlog + daytona (OpenManus — mot so package khong khai bao day du trong requirements.txt)'
Invoke-QuietPip (@('install') + $PipQuiet + @('crawl4ai>=0.8.0', 'pillow~=11.1.0', 'structlog', 'daytona==0.21.8'))

$LegacyBu = Join-Path $RepoRoot 'integrations\ai-support\runners\.legacy-browser-use-deps'
Write-Step 'browser-use==0.1.40 --target cho OpenManus (/run); submodule editable giu cho /run-browser'
New-Item -ItemType Directory -Force -Path $LegacyBu | Out-Null
Invoke-QuietPip (@('install') + $PipQuiet + @('browser-use==0.1.40', '--target', $LegacyBu))

Write-Step 'browser-use editable (ghi de pin browser-use trong requirements OpenManus)'
Push-Location $BrowserUse
try {
    Invoke-QuietPip (@('install') + $PipQuiet + @('-e', '.'))
}
finally {
    Pop-Location
}

Write-Step 'Playwright Chromium'
$p = & $Py -m playwright install chromium 2>&1
$p | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { throw 'playwright install chromium failed' }

if (-not (Test-Path $ReqExtra)) {
    Write-Warn "Khong thay $ReqExtra - bo qua job-scraper deps."
} else {
    Write-Step 'job-scraper requirements (/score)'
    Invoke-QuietPip (@('install') + $PipQuiet + @('-r', $ReqExtra))
}

if (-not $SkipApplyPilot) {
    Write-Step 'ApplyPilot (/apply)'
    Invoke-QuietPip (@('install') + $PipQuiet + @('applypilot'))
    Invoke-QuietPip (@('install') + $PipQuiet + @('--no-deps', 'python-jobspy'))
    Invoke-QuietPip (@('install') + $PipQuiet + @('pydantic>=2', 'tls-client', 'requests', 'markdownify', 'regex'))
    Write-Warn 'Lan dau co the can chay: applypilot init   (trong .venv-runners\Scripts)'
} else {
    Write-Warn 'Bo qua ApplyPilot (-SkipApplyPilot).'
}

Write-Step 'Kiem tra import nhanh...'
$chkPy = Join-Path ([System.IO.Path]::GetTempPath()) ("omni_runner_import_check_{0}.py" -f [Guid]::NewGuid().ToString('n'))
Set-Content -LiteralPath $chkPy -Encoding utf8 @'
import os, sys
from pathlib import Path
repo = Path(os.environ["OMNI_REPO_ROOT"])
leg = repo / "integrations" / "ai-support" / "runners" / ".legacy-browser-use-deps"
om = repo / "integrations" / "ai-support" / "submodules" / "open-manus"
sys.path.insert(0, str(om.resolve()))
sys.path.insert(0, str(leg.resolve()))
from app.agent.manus import Manus  # noqa: F401
import browser_use
import playwright
print("ok_runners_import")
'@
$env:OMNI_REPO_ROOT = $RepoRoot
try {
    & $Py $chkPy
    if ($LASTEXITCODE -ne 0) { throw 'import open_manus/browser_use/playwright failed' }
}
finally {
    Remove-Item Env:OMNI_REPO_ROOT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $chkPy -Force -ErrorAction SilentlyContinue
}
$PrevPyPath = $env:PYTHONPATH
$env:PYTHONPATH = (Join-Path $RepoRoot 'integrations\job-scraper')
try {
    # Tranh quoting Windows/python -c neu chuoi co dau nhay kep
    & $Py -c 'import llm_client; print(42)'
    if ($LASTEXITCODE -ne 0) { throw 'import job_scraper llm_client failed' }
} finally {
    if ($null -eq $PrevPyPath) { Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue } else { $env:PYTHONPATH = $PrevPyPath }
}

Write-Host ""
Write-Ok 'Xong. Them vao .env (hoac Cursor env):'
Write-Host ""
Write-Host ('  PYTHON_BIN=' + $Py)
Write-Host '  AI_SUPPORT_RUNNER_ENABLED=true'
Write-Host ""
Write-Warn 'Cac app Node/Docker (resume-lm, job-ops, mr-jobs, career-ops, ai-resume-tailor) van phai npm/docker rieng - xem tung README trong integrations/.'
exit 0
