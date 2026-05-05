#Requires -Version 5.1
<#
  OmniSuite - Tu dong cai neu thieu:
  - Node.js, Python (bat buoc cho app)
  - Git for Windows = PHAN MEM tren may (lenh "git"). Khong phai GitHub.
    GitHub = website luu ma nguon; can Git-for-Windows de tai ban moi ve may.

  Chi can winget NEU thieu Node hoac Python. Da du Node+Python thi khong bat buoc winget.
#>

param(
    [switch]$Quiet
)

function Write-Step([string]$msg) {
    if (-not $Quiet) { Write-Host "[*] $msg" -ForegroundColor Cyan }
}
function Write-Ok([string]$msg) {
    if (-not $Quiet) { Write-Host "[OK] $msg" -ForegroundColor Green }
}
function Write-Warn([string]$msg) {
    if (-not $Quiet) { Write-Host "[CANH BAO] $msg" -ForegroundColor Yellow }
}
function Write-Err([string]$msg) {
    Write-Host "[LOI] $msg" -ForegroundColor Red
}

function Refresh-PathEnv {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ([string]::IsNullOrEmpty($machine)) { $machine = '' }
    if ([string]::IsNullOrEmpty($user)) { $user = '' }
    $env:Path = "$machine;$user".Trim(';')
}

function Test-Cmd([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-Winget {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Invoke-WingetInstall([string]$Id, [string]$Label) {
    Write-Step "Dang cai $Label (winget): $Id ..."
    $wingetArgs = @(
        'install', '--id', $Id,
        '-e', '--source', 'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity'
    )
    $p = Start-Process -FilePath 'winget' -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow
    if ($null -ne $p.ExitCode -and $p.ExitCode -ne 0) {
        Write-Warn "winget ma $($p.ExitCode) cho $Id (co the da cai san / can quyen Admin)."
    }
}

Refresh-PathEnv

$missingNode = -not (Test-Cmd 'node')
$missingPython = -not (Test-Cmd 'python')
$missingGit = -not (Test-Cmd 'git')

# Chi bat buoc winget khi THIEU Node hoac Python
if (($missingNode -or $missingPython) -and -not (Test-Winget)) {
    Write-Err "Thieu Node hoac Python nhung khong tim thay winget."
    Write-Host "      Option A: Mo Microsoft Store -> 'App Installer' -> Cap nhat."
    Write-Host "      Option B: Cai tay Node https://nodejs.org va Python https://www.python.org/downloads/"
    Write-Host "               (danh dau 'Add python.exe to PATH' khi cai Python)"
    exit 1
}

$installedSomething = $false

if ($missingNode) {
    Write-Step "Chua co Node.js - dang cai bang winget..."
    foreach ($id in @('OpenJS.NodeJS.LTS', 'OpenJS.NodeJS')) {
        Invoke-WingetInstall -Id $id -Label 'Node.js'
        Refresh-PathEnv
        if (Test-Cmd 'node') { break }
    }
    $installedSomething = $true
}

Refresh-PathEnv

if (-not (Test-Cmd 'node')) {
    Write-Err "Van khong tim thay 'node'. Dong CMD va chay lai 01_BAT_DAU (hoac cai Node tay)."
    exit 1
}
Write-Ok "Node.js: OK ($(node -v 2>$null))"

if ($missingPython) {
    Write-Step "Chua co Python - dang cai (thu nhieu phien ban neu can)..."
    foreach ($id in @('Python.Python.3.12', 'Python.Python.3.11', 'Python.Python.3.10')) {
        Invoke-WingetInstall -Id $id -Label "Python"
        Refresh-PathEnv
        if (Test-Cmd 'python') { break }
    }
    $installedSomething = $true
}

Refresh-PathEnv

if (-not (Test-Cmd 'python')) {
    Write-Err "Van khong tim thay 'python'. Cai Python tay va tick 'Add to PATH', roi chay lai 01."
    exit 1
}
Write-Ok "Python: OK ($(python --version 2>$null))"

if ($missingGit -and (Test-Winget)) {
    Write-Step 'Chua co Git-for-Windows (phan mem lenh "git") — dang cai de launcher tai ban moi tu GitHub...'
    Invoke-WingetInstall -Id 'Git.Git' -Label 'Git-for-Windows'
    $installedSomething = $true
    Refresh-PathEnv
}

if (Test-Cmd 'git') {
    Write-Ok 'Git-for-Windows (lenh git): OK — khong phai website GitHub'
} elseif ($missingGit) {
    Write-Warn 'Khong co Git-for-Windows — van chay app OK; chi khong tu dong tai code moi tu GitHub.'
}

if ($installedSomething -and -not $Quiet) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Da cai/cap nhat phan mem. Tiep tuc..." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
}

# Bao cho CMD biet can bo sung PATH (tranh for/f lam vo PATH co ngoac dac biet)
if ($installedSomething) {
    $flag = Join-Path ([Environment]::GetEnvironmentVariable('TEMP')) 'omnisuite_refresh_path.flag'
    Set-Content -Path $flag -Value '1' -Encoding ascii
}

exit 0
