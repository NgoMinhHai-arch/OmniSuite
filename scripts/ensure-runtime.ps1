#Requires -Version 5.1
<#
  OmniSuite - Automatic runtime setup (Node, Python embed, Git, optional full Python via winget).
#>

param(
    [switch]$Quiet,
    [switch]$InstallFullPython
)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LocalPythonDir = Join-Path $RepoRoot '.omnisuite\python'
$LocalPythonExe = Join-Path $LocalPythonDir 'python.exe'
$RuntimeJsonPath = Join-Path $RepoRoot '.omnisuite\runtime.json'
$NeedsFullFlag = Join-Path $RepoRoot '.omnisuite\needs-full-python'

function Write-Step([string]$msg) {
    if (-not $Quiet) { Write-Host "[*] $msg" -ForegroundColor Cyan }
}
function Write-Ok([string]$msg) {
    if (-not $Quiet) { Write-Host "[OK] $msg" -ForegroundColor Green }
}
function Write-Warn([string]$msg) {
    if (-not $Quiet) { Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
}
function Write-Err([string]$msg) {
    Write-Host "[ERROR] $msg" -ForegroundColor Red
}

function Write-RuntimeJson {
    param(
        [string]$Bundled = $LocalPythonExe,
        [string]$Full,
        [string]$Prefer = 'bundled'
    )
    $dir = Split-Path $RuntimeJsonPath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bundledVal = $null
    if (Test-Path $Bundled) { $bundledVal = $Bundled }
    $obj = @{
        bundledPython = $bundledVal
        fullPython    = $Full
        prefer        = $Prefer
        updatedAt     = (Get-Date).ToString('o')
    }
    $obj | ConvertTo-Json | Set-Content -Path $RuntimeJsonPath -Encoding UTF8
}

function Refresh-PathEnv {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ([string]::IsNullOrEmpty($machine)) { $machine = '' }
    if ([string]::IsNullOrEmpty($user)) { $user = '' }
    $localPythonPath = ''
    if (Test-Path $LocalPythonExe) {
        $scriptsDir = Join-Path $LocalPythonDir 'Scripts'
        $localPythonPath = "$LocalPythonDir;$scriptsDir;"
    }
    $env:Path = "$localPythonPath$machine;$user".Trim(';')
}

function Test-Cmd([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-Winget {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Invoke-WingetInstall([string]$Id, [string]$Label) {
    Write-Step "Installing $Label (winget): $Id ..."
    $wingetArgs = @(
        'install', '--id', $Id,
        '-e', '--source', 'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity'
    )
    $p = Start-Process -FilePath 'winget' -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow
    if ($null -ne $p.ExitCode -and $p.ExitCode -ne 0) {
        Write-Warn "winget exited with code $($p.ExitCode) for $Id (may already be installed or need admin)."
    }
}

function Find-FullPythonExe {
    $candidates = @(
        "$env:LocalAppData\Programs\Python\Python312\python.exe",
        "$env:LocalAppData\Programs\Python\Python311\python.exe",
        "$env:LocalAppData\Programs\Python\Python310\python.exe",
        "$env:ProgramFiles\Python312\python.exe",
        "$env:ProgramFiles\Python311\python.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $pyCmd -and $pyCmd.Source -notmatch 'WindowsApps') {
        return $pyCmd.Source
    }
    return $null
}

function Ensure-FullPythonFallback {
    if (-not (Test-Winget)) {
        Write-Warn 'winget khong co - khong the cai Python day du tu dong.'
        return $null
    }
    Write-Step 'Cai Python 3.12 day du (winget) - phuong an du phong cho torch/CLIP...'
    Invoke-WingetInstall -Id 'Python.Python.3.12' -Label 'Python 3.12'
    Refresh-PathEnv
    $full = Find-FullPythonExe
    if ($null -ne $full -and $full -ne '') {
        Write-Ok "Python day du: $full"
        Write-RuntimeJson -Full $full -Prefer 'full'
        if (Test-Path $NeedsFullFlag) {
            Remove-Item $NeedsFullFlag -Force -ErrorAction SilentlyContinue
        }
        return $full
    }
    Write-Warn 'Da goi winget nhung chua tim thay python.exe - thu khoi dong lai CMD.'
    return $null
}

function Test-PythonSmoke {
    param([string]$Exe)
    if (-not (Test-Path $Exe)) { return $false }
    try {
        $out = & $Exe -c 'import sys; print(sys.executable)' 2>&1
        return ($LASTEXITCODE -eq 0 -and $out)
    }
    catch {
        return $false
    }
}

function Warn-StorePythonStub {
    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $pyCmd -and $pyCmd.Source -match 'WindowsApps') {
        Write-Warn 'PATH van tro vao Windows Store python stub.'
        Write-Warn 'Neu loi: Settings -> Apps -> Advanced -> App execution aliases -> tat python.exe / python3.exe'
    }
}

Refresh-PathEnv

$missingNode = -not (Test-Cmd 'node')
$missingGit = -not (Test-Cmd 'git')
$installedSomething = $false

if ($InstallFullPython -or (Test-Path $NeedsFullFlag)) {
    Ensure-FullPythonFallback | Out-Null
    Refresh-PathEnv
}

if ($missingNode) {
    if (-not (Test-Winget)) {
        Write-Err "Node.js is missing and 'winget' is not found."
        Write-Host '      Install Node.js from https://nodejs.org/'
        exit 1
    }
    Write-Step 'Node.js is missing - installing via winget...'
    foreach ($id in @('OpenJS.NodeJS.LTS', 'OpenJS.NodeJS')) {
        Invoke-WingetInstall -Id $id -Label 'Node.js'
        Refresh-PathEnv
        if (Test-Cmd 'node') { break }
    }
    $installedSomething = $true
}

Refresh-PathEnv

if (-not (Test-Cmd 'node')) {
    Write-Err "Could not verify 'node'. Restart CMD or install Node.js manually."
    exit 1
}
Write-Ok "Node.js: OK ($(node -v 2>$null))"

if (-not (Test-Path $LocalPythonExe)) {
    Write-Step "Setting up local Python in '.omnisuite/python'..."
    New-Item -ItemType Directory -Path $LocalPythonDir -Force | Out-Null

    $ZipPath = Join-Path $LocalPythonDir 'python-embed.zip'
    $Url = 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip'

    Write-Step 'Downloading Python 3.10.11 embeddable package...'
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing
    }
    catch {
        Write-Err "Failed to download Python. Error: $_"
        exit 1
    }

    Write-Step 'Extracting Python package...'
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $LocalPythonDir -Force
        Remove-Item $ZipPath -Force
    }
    catch {
        Write-Err "Failed to extract Python. Error: $_"
        exit 1
    }

    $PthFile = Join-Path $LocalPythonDir 'python310._pth'
    if (Test-Path $PthFile) {
        Write-Step 'Enabling site-packages...'
        $content = Get-Content $PthFile
        $content = $content -replace '#import site', 'import site'
        $content | Set-Content $PthFile
    }

    Write-Step 'Installing pip locally...'
    $PipScript = Join-Path $LocalPythonDir 'get-pip.py'
    try {
        Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $PipScript -UseBasicParsing
        & $LocalPythonExe $PipScript --no-warn-script-location
        Remove-Item $PipScript -Force
    }
    catch {
        Write-Warn "Could not install pip: $_"
    }

    $installedSomething = $true
}

Refresh-PathEnv

if (-not (Test-PythonSmoke -Exe $LocalPythonExe)) {
    Write-Err "Local Python smoke test failed at $LocalPythonExe"
    exit 1
}
$pyVer = & $LocalPythonExe --version 2>&1
Write-Ok "Python (Local): OK ($pyVer)"

Warn-StorePythonStub

$fullPy = Find-FullPythonExe
$preferMode = 'bundled'
if ($InstallFullPython -and $null -ne $fullPy) { $preferMode = 'full' }
Write-RuntimeJson -Full $fullPy -Prefer $preferMode

if ($missingGit -and (Test-Winget)) {
    Write-Step 'Git is missing - installing Git for Windows...'
    Invoke-WingetInstall -Id 'Git.Git' -Label 'Git-for-Windows'
    $installedSomething = $true
    Refresh-PathEnv
}

if (Test-Cmd 'git') {
    Write-Ok 'Git: OK'
}
elseif ($missingGit) {
    Write-Warn 'Git missing - app still runs; GitHub sync skipped.'
}

if ($installedSomething -and -not $Quiet) {
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host '  Environment configured successfully!   ' -ForegroundColor Green
    Write-Host '========================================' -ForegroundColor Green
    Write-Host ''
}

if ($installedSomething) {
    $flag = Join-Path ([Environment]::GetEnvironmentVariable('TEMP')) 'omnisuite_refresh_path.flag'
    Set-Content -Path $flag -Value '1' -Encoding ascii
}

exit 0
