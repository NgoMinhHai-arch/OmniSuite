@echo off
setlocal
cd /d "%~dp0"
title OmniSuite GO
node scripts\quick-launcher.js %*
if errorlevel 1 (
  echo.
  echo [LOI] OmniSuite chua khoi dong duoc. Thu chay: GO.cmd --repair
  echo.
  pause
)
