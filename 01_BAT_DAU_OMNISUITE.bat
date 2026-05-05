@echo off
:: ============================================================
:: OMNISUITE AI - KHOI DONG DON GIAN
:: Tu dong kiem tra va cai thu vien neu chua co
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

:: Kiem tra va cai thu vien neu chua co
if not exist "node_modules\" (
    echo.
    echo [*] Lan dau chay - Dang cai dat thu vien...
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

:: Chay launcher
echo [*] Dang khoi dong OmniSuite AI...
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
