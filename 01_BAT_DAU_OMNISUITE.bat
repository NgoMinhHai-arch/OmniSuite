@echo off
:: ============================================================
:: OMNISUITE AI - KHOI DONG DON GIAN
::
:: - Node.js + Python: moi truong chay app.
:: - "Git for Windows" = PHAN MEM tren may (lenh "git"), de dong bo code.
::   KHONG phai GitHub: GitHub = website luu ma nguon tren mang.
:: - Neu co thu muc .git: launcher se tu tai ban moi tu GitHub (can Git for Windows).
::
:: Can: Windows 10/11 + Internet + winget (App Installer tu Store) khi thieu Node/Python.
:: ============================================================

cd /d "%~dp0"

:: Tim thu muc dung
if exist "package.json" (
    echo [OK] Da tim thay package.json
) else (
    if exist "tool-marketing-and-SEO-master\package.json" (
        cd "tool-marketing-and-SEO-master"
    ) else (
        echo [LOI] Khong tim thay package.json!
        echo Thu muc hien tai: %CD%
        pause
        exit /b 1
    )
)

:: --- Cai Node / Python / Git-for-Windows neu thieu (PowerShell + winget) ---
echo.
echo [*] Buoc 1/3: Node.js, Python, Git-for-Windows ^(phan mem lenh "git" tren may — khong phai trang GitHub^)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-runtime.ps1"
if errorlevel 1 (
    echo.
    echo [LOI] Khong chuan bi duoc moi truong. Xem huong dan o tren.
    pause
    exit /b 1
)

:: Chi sua PATH khi vua cai Node/Python/Git-for-Windows
if exist "%TEMP%\omnisuite_refresh_path.flag" (
    echo [*] Cap nhat PATH cho session CMD...
    set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs"
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python312\Scripts;%LocalAppData%\Programs\Python\Python312"
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python311\Scripts;%LocalAppData%\Programs\Python\Python311"
    set "PATH=%PATH%;%LocalAppData%\Programs\Python\Python310\Scripts;%LocalAppData%\Programs\Python\Python310"
    set "PATH=%PATH%;%ProgramFiles%\Python312;%ProgramFiles%\Python311;%ProgramFiles%\Python310"
    del "%TEMP%\omnisuite_refresh_path.flag" 2>nul
)

where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Van khong thay lenh node. Hay DONG het CMD va chay lai file 01_BAT_DAU_OMNISUITE.bat
    pause
    exit /b 1
)

:: Kiem tra va cai thu vien neu chua co
if not exist "node_modules\" (
    echo.
    echo [*] Buoc 2/3: Lan dau chay - Dang cai Node packages...
    echo [*] Vui long doi 2-3 phut...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [LOI] Cai dat that bai! Hay kiem tra:
        echo        1. Da cai Node.js chua? (https://nodejs.org)
        echo        2. Co ket noi internet khong?
        pause
        exit /b 1
    )
    echo.
    echo [OK] Cai dat thu vien xong!
    echo.
) else (
    echo [OK] Thu vien da san sang
)

:: Chay launcher: dong bo tu GitHub neu co .git + Git-for-Windows; pip; npm; khoi dong server
echo [*] Buoc 3/3: Khoi dong OmniSuite AI...
echo [*] Chay: node launcher.js
echo.
node launcher.js

:: Ket thuc
echo.
echo =========================================
echo      OmniSuite AI da dung
echo =========================================
echo [*] Cam on ban da su dung OmniSuite AI!
pause
