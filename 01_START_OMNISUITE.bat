@echo off
:: ============================================================
:: OMNISUITE AI - SIMPLE LAUNCHER
::
:: - Node.js + Python: App execution environment.
:: - "Git for Windows" = Software on your machine ("git" command) to sync code.
::   NOT GitHub: GitHub = website that hosts the code online.
:: - If .git folder exists: launcher will auto-pull updates (requires Git for Windows).
::
:: Requirements: Windows 10/11 + Internet + winget (App Installer from Store) when Node/Python are missing.
:: ============================================================

cd /d "%~dp0"
set "OMNISUITE_ROOT=%~dp0"
if "%OMNISUITE_ROOT:~-1%"=="\" set "OMNISUITE_ROOT=%OMNISUITE_ROOT:~0,-1%"

if not exist "%~dp0.env" (
    echo [*] Tao file .env cho lan chay dau...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=(Get-Location).Path; $envPath=Join-Path $root '.env'; $example=Join-Path $root '.env.example'; if (Test-Path $example) { Copy-Item -LiteralPath $example -Destination $envPath -Force } else { Set-Content -LiteralPath $envPath -Value '' -Encoding UTF8 }"
)

echo.
echo ========================================
echo   OMNISUITE AI - KHOI DONG TU DONG
echo ========================================
echo   Lan dau co the mat 10-30 phut:
echo   - npm packages
echo   - torch/CLIP (~2GB) cho Tim hinh anh
echo   - Chromium Playwright cho Quet ban do
echo   May KHONG bi treo neu thay dong [*] Van dang chay...
echo ========================================
echo   BAO MAT: Khong chia se file .env (API keys / INTERNAL_TOKEN).
echo ========================================
echo.

:: Prepend local Python to PATH if it exists
if exist "%~dp0.omnisuite\python\python.exe" (
    set "PATH=%~dp0.omnisuite\python;%~dp0.omnisuite\python\Scripts;%PATH%"
)

:: Find the correct directory
if exist "package.json" (
    echo [OK] Found package.json
) else (
    if exist "tool-marketing-and-SEO-master\package.json" (
        cd "tool-marketing-and-SEO-master"
    ) else (
        echo [ERROR] package.json not found!
        echo Current folder: %CD%
        pause
        exit /b 1
    )
)

:: --- Install Node / Python / Git-for-Windows if missing (PowerShell + winget) ---
echo.
echo [*] Step 1/3: Checking Node.js, Python, Git-for-Windows...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-runtime.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to set up execution environment. See logs above.
    pause
    exit /b 1
)

:: Prepend local Python to PATH after installation if it was just downloaded
if exist "%~dp0.omnisuite\python\python.exe" (
    set "PATH=%~dp0.omnisuite\python;%~dp0.omnisuite\python\Scripts;%PATH%"
)

:: Apply new PATH if flag exists (for global winget installs in current CMD session)
if exist "%TEMP%\omnisuite_refresh_path.flag" (
    echo [*] Updating PATH for CMD session...
    set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs"
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python312\Scripts;%LocalAppData%\Programs\Python\Python312"
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python311\Scripts;%LocalAppData%\Programs\Python\Python311"
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python310\Scripts;%LocalAppData%\Programs\Python\Python310"
    set "PATH=%PATH%;%ProgramFiles%\Python312;%ProgramFiles%\Python311;%ProgramFiles%\Python310"
    del "%TEMP%\omnisuite_refresh_path.flag" 2>nul
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 'node' command not found. Please restart CMD and run 01_START_OMNISUITE.bat again.
    pause
    exit /b 1
)

:: Launcher auto-installs: npm, pip, playwright, git hooks - no manual npm install needed
echo [*] Step 2/3: Tu dong cai dat va sua loi (Node + Python + Playwright + CLIP)...
echo.

echo [*] Big Update: kiem tra khung xuong he thong...
node scripts\big-update.js
if errorlevel 1 (
    echo.
    echo [WARNING] Big Update check gap loi - dang tu sua...
    node scripts\big-update.js --repair
)

:: Run contract launcher: Git sync + full setup + verify/repair + start server
echo [*] Step 3/3: Khoi dong OmniSuite AI...
echo [*] Executing: node scripts\contract-go.js
echo.
node scripts\contract-go.js
if errorlevel 1 (
    echo.
    echo [WARNING] Khoi dong lan dau chua thanh cong - dang tu sua va thu lai...
    node scripts\big-update.js --repair
    node scripts\contract-go.js --repair
)

:: End
echo.
echo =========================================
echo      OmniSuite AI has stopped
echo =========================================
echo [*] Thank you for using OmniSuite AI!
pause
