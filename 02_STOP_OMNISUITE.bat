@echo off
setlocal enabledelayedexpansion
title OMNISUITE - STOP SYSTEM
color 0C
cd /d "%~dp0"

echo ==========================================
echo    OMNISUITE AI - STOPPING SYSTEM...
echo ==========================================
echo.

:: ---- STEP 1: TERMINATING PROCESSES ----
echo [1/3] Terminating all processes...

taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM pythonw.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1

echo [OK] Node and Python processes terminated.

:: ---- STEP 2: RELEASING PORTS ----
echo [2/3] Releasing ports 3000, 8081, 8082, 8000...

powershell -NoProfile -Command "3000,8081,8082,8000 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }" >nul 2>&1

echo [OK] All network ports released.

:: ---- STEP 3: CLEANING CACHE ----
echo [3/3] Cleaning cache...

for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" >nul 2>&1
if exist ".next\cache" rd /s /q ".next\cache" >nul 2>&1
if exist "logs\debug_log.txt" type nul > "logs\debug_log.txt" >nul 2>&1

echo [OK] Cache cleaned.

echo.
echo ==========================================
echo   OMNISUITE STOPPED SUCCESSFULLY.
echo ==========================================
echo.
timeout /t 3
exit
