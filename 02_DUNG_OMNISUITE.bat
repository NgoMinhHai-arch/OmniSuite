@echo off
setlocal enabledelayedexpansion
title OMNISUITE - DUNG HE THONG
color 0C
cd /d "%~dp0"

echo ==========================================
echo    OMNISUITE AI - DANG DONG HE THONG...
echo ==========================================
echo.

:: ---- BUOC 1: TAT CAC TIEN TRINH ----
echo [1/3] Dang tat tat ca tien trinh...

taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM pythonw.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1

echo [OK] Da tat cac tien trinh Node va Python.

:: ---- BUOC 2: CUONG CHE GIAI PHONG CONG (PORT) ----
echo [2/3] Dang giai phong Port 3000, 8081, 8082...

powershell -NoProfile -Command "3000,8081,8082 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }" >nul 2>&1

echo [OK] Da giai phong tat ca cong ket noi.

:: ---- BUOC 3: DON DEP CACHE ----
echo [3/3] Dang don dep cache...

for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" >nul 2>&1
if exist ".next\cache" rd /s /q ".next\cache" >nul 2>&1
if exist "logs\debug_log.txt" type nul > "logs\debug_log.txt" >nul 2>&1

echo [OK] Da don dep cache.

echo.
echo ==========================================
echo   OMNISUITE DA DUNG HOAN TOAN.
echo ==========================================
echo.
timeout /t 3
exit
