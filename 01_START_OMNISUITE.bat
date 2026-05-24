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
echo [*] Step 2/3: Preparing automatic installation (Node + Python + Playwright)...
echo.

:: Run launcher: Git sync + full setup + start server
echo [*] Step 3/3: Launching OmniSuite AI...
echo [*] Executing: node launcher.js
echo.
node launcher.js

:: End
echo.
echo =========================================
echo      OmniSuite AI has stopped
echo =========================================
echo [*] Thank you for using OmniSuite AI!
pause
