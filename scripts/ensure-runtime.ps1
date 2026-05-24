#Requires -Version 5.1
<#
  OmniSuite - Automatic runtime setup:
  - Node.js, Python (required for the application)
  - Git for Windows (optional, required to sync with source control)

  If Node.js is missing, winget is used to install it.
  Python is downloaded and set up locally in the `.omnisuite/python` directory to ensure full isolation.
#>

param(
    [switch]$Quiet
)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LocalPythonDir = Join-Path $RepoRoot ".omnisuite\python"
$LocalPythonExe = Join-Path $LocalPythonDir "python.exe"

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

function Refresh-PathEnv {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ([string]::IsNullOrEmpty($machine)) { $machine = '' }
    if ([string]::IsNullOrEmpty($user)) { $user = '' }
    
    # Prepend local Python path if it exists to ensure process isolation
    $localPythonPath = ""
    if (Test-Path $LocalPythonExe) {
        $localPythonPath = "$LocalPythonDir;$(Join-Path $LocalPythonDir 'Scripts');"
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
        Write-Warn "winget exited with code $($p.ExitCode) for $Id (it might be already installed or requires admin rights)."
    }
}

Refresh-PathEnv

$missingNode = -not (Test-Cmd 'node')
$missingGit = -not (Test-Cmd 'git')
$installedSomething = $false

# 1. Node.js Check and Install
if ($missingNode) {
    if (-not (Test-Winget)) {
        Write-Err "Node.js is missing and 'winget' is not found."
        Write-Host "      Option A: Open Microsoft Store -> search for 'App Installer' -> Update it."
        Write-Host "      Option B: Install Node.js manually from https://nodejs.org/"
        exit 1
    }
    Write-Step "Node.js is missing - installing via winget..."
    foreach ($id in @('OpenJS.NodeJS.LTS', 'OpenJS.NodeJS')) {
        Invoke-WingetInstall -Id $id -Label 'Node.js'
        Refresh-PathEnv
        if (Test-Cmd 'node') { break }
    }
    $installedSomething = $true
}

Refresh-PathEnv

if (-not (Test-Cmd 'node')) {
    Write-Err "Could not verify 'node' installation. Please restart the terminal or install Node.js manually."
    exit 1
}
Write-Ok "Node.js: OK ($(node -v 2>$null))"

# 2. Local Self-Contained Python Setup
if (-not (Test-Path $LocalPythonExe)) {
    Write-Step "Setting up local self-contained Python in '.omnisuite/python' for isolation..."
    
    # Create directory
    New-Item -ItemType Directory -Path $LocalPythonDir -Force | Out-Null
    
    $ZipPath = Join-Path $LocalPythonDir "python-embed.zip"
    $Url = "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"
    
    Write-Step "Downloading Python 3.10.11 embeddable package..."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing
    } catch {
        Write-Err "Failed to download Python. Error: $_"
        exit 1
    }
    
    Write-Step "Extracting Python package..."
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $LocalPythonDir -Force
        Remove-Item $ZipPath -Force
    } catch {
        Write-Err "Failed to extract Python. Error: $_"
        exit 1
    }
    
    # Configure path by editing python310._pth to enable import site (needed for pip packages)
    $PthFile = Join-Path $LocalPythonDir "python310._pth"
    if (Test-Path $PthFile) {
        Write-Step "Enabling site-packages in local Python configuration..."
        $content = Get-Content $PthFile
        $content = $content -replace '#import site', 'import site'
        $content | Set-Content $PthFile
    }
    
    # Download and run get-pip.py to install pip locally
    Write-Step "Downloading and installing pip locally..."
    $PipScript = Join-Path $LocalPythonDir "get-pip.py"
    $PipUrl = "https://bootstrap.pypa.io/get-pip.py"
    try {
        Invoke-WebRequest -Uri $PipUrl -OutFile $PipScript -UseBasicParsing
        # Run with local python
        & $LocalPythonExe $PipScript --no-warn-script-location
        Remove-Item $PipScript -Force
    } catch {
        Write-Warn "Could not install pip. Python will run but installing packages might fail. Error: $_"
    }
    
    $installedSomething = $true
}

Refresh-PathEnv

if (-not (Test-Cmd 'python')) {
    Write-Err "Could not verify local 'python' execution. Please check folder permissions."
    exit 1
}
Write-Ok "Python (Local): OK ($(python --version 2>$null))"

# 3. Git Check and Install
if ($missingGit -and (Test-Winget)) {
    Write-Step "Git is missing - installing Git for Windows to sync updates..."
    Invoke-WingetInstall -Id 'Git.Git' -Label 'Git-for-Windows'
    $installedSomething = $true
    Refresh-PathEnv
}

if (Test-Cmd 'git') {
    Write-Ok "Git: OK"
} elseif ($missingGit) {
    Write-Warn "Git is missing - the app will still run fine, but automatic updates from GitHub will be skipped."
}

if ($installedSomething -and -not $Quiet) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Environment configured successfully!   " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
}

# Signal to batch script that PATH needs refreshing
if ($installedSomething) {
    $flag = Join-Path ([Environment]::GetEnvironmentVariable('TEMP')) 'omnisuite_refresh_path.flag'
    Set-Content -Path $flag -Value '1' -Encoding ascii
}

exit 0
