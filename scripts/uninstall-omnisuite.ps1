#Requires -Version 5.1
<#
  OMNISUITE — CLEAN UNINSTALL (removes everything)
  Deletes: node_modules, pip packages, cache, .env, .omnisuite (including local Python), and (by default) the project folder.

  Run: powershell -ExecutionPolicy Bypass -File scripts\uninstall-omnisuite.ps1
  Keep source folder:   ... -KeepSource
  Keep .env settings:  ... -KeepEnv
#>
param(
    [switch]$Quiet,
    [switch]$KeepEnv,
    [switch]$KeepSource
)

$ErrorActionPreference = 'Continue'
try { chcp 65001 | Out-Null } catch {}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$deleteEnv = -not $KeepEnv.IsPresent
$removeProjectFolder = -not $KeepSource.IsPresent

function Write-Step([string]$m) { if (-not $Quiet) { Write-Host "[*] $m" -ForegroundColor Cyan } }
function Write-Ok([string]$m) { if (-not $Quiet) { Write-Host "[OK] $m" -ForegroundColor Green } }
function Write-Warn([string]$m) { Write-Host "[!] $m" -ForegroundColor Yellow }

function Remove-PathSafe([string]$p, [string]$label) {
    if (-not (Test-Path -LiteralPath $p)) { return }
    try {
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
        Write-Ok "Deleted: $label"
    } catch {
        Write-Warn "Could not delete $label : $($_.Exception.Message)"
    }
}

function Stop-OmniProcesses {
    Write-Step 'Stopping running Node / Python / uvicorn processes...'
    foreach ($img in @('node', 'python', 'pythonw', 'uvicorn')) {
        Get-Process -Name $img -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    foreach ($port in 3000, 8081, 8082, 8000) {
        try {
            Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
                ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        } catch { }
    }
    Start-Sleep -Seconds 1
    Write-Ok 'Stopped processes and released ports'
}

function Invoke-PipUninstall([string]$reqFile) {
    $full = Join-Path $RepoRoot $reqFile
    if (-not (Test-Path -LiteralPath $full)) { return }
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Warn 'No python command found — skipping pip uninstall'
        return
    }
    Write-Step "Uninstalling pip packages listed in $reqFile ..."
    & python -m pip uninstall -r $full -y 2>&1 | Out-Null
    Write-Ok "pip uninstall -r $reqFile completed"
}

function Remove-DirPattern([string]$root, [string]$pattern) {
    Get-ChildItem -Path $root -Directory -Recurse -Filter $pattern -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-PathSafe $_.FullName $_.FullName.Replace($RepoRoot, '.') }
}

if (-not $Quiet) {
    Write-Host ''
    Write-Host '==========================================' -ForegroundColor Red
    Write-Host '   OMNISUITE — CLEAN UNINSTALL' -ForegroundColor Red
    Write-Host '==========================================' -ForegroundColor Red
    Write-Host 'Will DELETE:' -ForegroundColor Yellow
    Write-Host '  - node_modules, .next, pip packages, cache Playwright/Puppeteer/HuggingFace' -ForegroundColor Yellow
    Write-Host '  - .env, .omnisuite (local Python environment), venv, logs, keyword cache' -ForegroundColor Yellow
    if ($removeProjectFolder) {
        Write-Host '  - ALL PROJECT FILES (entire folder and everything inside it)' -ForegroundColor Red
    }
    if ($KeepSource) { Write-Host '  (keeping project source files: -KeepSource)' -ForegroundColor Gray }
    if ($KeepEnv) { Write-Host '  (keeping .env file: -KeepEnv)' -ForegroundColor Gray }
    Write-Host ''
    $confirm = Read-Host 'Type YES to confirm clean uninstall'
    if ($confirm -ne 'YES') {
        Write-Host 'Cancelled.' -ForegroundColor Gray
        exit 0
    }
}

Set-Location -LiteralPath $RepoRoot

$logDir = Join-Path $RepoRoot 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir 'uninstall-last.log'
@(
    "=== OmniSuite FULL uninstall $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
    "RepoRoot: $RepoRoot"
    "deleteEnv: $deleteEnv"
    "removeProjectFolder: $removeProjectFolder"
) | Set-Content -LiteralPath $logFile -Encoding UTF8

Stop-OmniProcesses

$pipFiles = @(
    'services/clip_service/requirements.txt',
    'requirements.txt',
    'python_engine/requirements.txt'
)
foreach ($f in $pipFiles) { Invoke-PipUninstall $f }

Write-Step 'Deleting all downloaded OmniSuite directories...'
$dirs = @(
    'node_modules',
    '.next',
    'out',
    'build',
    '.venv-runners',
    'venv',
    '.venv',
    '.omnisuite',
    'integrations/ai-support/runners/.legacy-browser-use-deps'
)
foreach ($d in $dirs) { Remove-PathSafe (Join-Path $RepoRoot $d) $d }

Remove-DirPattern $RepoRoot '__pycache__'
Remove-DirPattern $RepoRoot '.pytest_cache'
Remove-DirPattern $RepoRoot '.ruff_cache'

foreach ($sub in @('tmp', 'scratch', 'data')) {
    Remove-PathSafe (Join-Path $RepoRoot $sub) $sub
}

@(
    'keyword_cache.json',
    'keyword_cache_demo.json',
    'OmniSuite.exe',
    '.env',
    '.env.local',
    '.env.development.local',
    '.env.production.local'
) | ForEach-Object {
    if ($deleteEnv -or $_ -notlike '.env*') {
        Remove-PathSafe (Join-Path $RepoRoot $_) $_
    }
}

if (Test-Path -LiteralPath (Join-Path $RepoRoot 'db')) {
    Remove-PathSafe (Join-Path $RepoRoot 'db') 'db'
}

Get-ChildItem -LiteralPath $RepoRoot -Filter '.env*' -File -ErrorAction SilentlyContinue |
    ForEach-Object {
        if ($deleteEnv) { Remove-PathSafe $_.FullName $_.Name }
    }

Write-Step 'Deleting system cache files (Playwright, Puppeteer, HuggingFace, PyTorch)...'

if (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m playwright uninstall --all 2>&1 | Out-Null
}
if (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx playwright uninstall --all 2>&1 | Out-Null
}

Remove-PathSafe (Join-Path $env:LOCALAPPDATA 'ms-playwright') 'Playwright (%LOCALAPPDATA%\ms-playwright)'
Remove-PathSafe (Join-Path $env:USERPROFILE '.cache\puppeteer') 'Puppeteer cache'
Remove-PathSafe (Join-Path $env:USERPROFILE '.cache\huggingface') 'HuggingFace cache'
Remove-PathSafe (Join-Path $env:USERPROFILE '.cache\torch') 'PyTorch cache'
Remove-PathSafe (Join-Path $RepoRoot '.npm-cache') '.npm-cache'

Add-Content -LiteralPath $logFile -Value "Artifacts cleared: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Remove-PathSafe (Join-Path $RepoRoot 'logs') 'logs'

if ($removeProjectFolder) {
    Write-Step 'Deleting the ENTIRE project folder...'
    $parent = Split-Path $RepoRoot -Parent
    $folderName = Split-Path $RepoRoot -Leaf
    Set-Location -LiteralPath $parent
    Start-Sleep -Seconds 2
    Remove-PathSafe (Join-Path $parent $folderName) "project directory ($folderName)"
    if (-not (Test-Path -LiteralPath $RepoRoot)) {
        Write-Ok 'Project directory deleted completely.'
    } else {
        Write-Warn 'Directory still exists (is a terminal open inside it?). Please close it and delete manually:'
        Write-Warn $RepoRoot
    }
} else {
    Write-Ok 'UNINSTALL COMPLETED — packages, cache, and env configs deleted (project source code kept due to -KeepSource).'
    Write-Host 'To reinstall later, run 01_START_OMNISUITE.bat' -ForegroundColor Gray
}

Write-Host ''
Write-Host 'Global Node.js / Python installed via winget were NOT uninstalled - only OmniSuite local folders were removed.' -ForegroundColor Gray

if (-not $Quiet) {
    Write-Host ''
    Read-Host 'Press Enter to close'
}
