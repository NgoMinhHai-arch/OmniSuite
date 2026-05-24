@echo off
setlocal
title OMNISUITE - UNINSTALL (CLEAN UNINSTALL - KEEP NOTHING)
color 0C
cd /d "%~dp0"

if exist "package.json" (
    rem ok
) else (
    if exist "tool-marketing-and-SEO-master\package.json" (
        cd "tool-marketing-and-SEO-master"
    ) else (
        echo [ERROR] package.json not found!
        pause
        exit /b 1
    )
)

echo.
echo ==========================================
echo    OMNISUITE — UNINSTALL (KEEP NOTHING)
echo ==========================================
echo.
echo Will delete completely:
echo   - node_modules, pip packages, Playwright, Puppeteer, HuggingFace
echo   - .env, cache, .omnisuite (including local Python environment)
echo   - ENTIRE project folder (by default)
echo.
echo To keep source or env settings, use PowerShell arguments:
echo   -KeepSource  = keep the source directory
echo   -KeepEnv      = keep the .env file
echo.
echo Type YES when prompted to proceed.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall-omnisuite.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% neq 0 (
    echo [WARNING] Some uninstall steps failed — see log output above.
) else (
    echo [OK] Clean uninstall complete — everything has been removed.
)
pause
exit /b %EXITCODE%
