@echo off
title OmniInterpreter Service (Port 8081)
echo.
echo [OmniSuite] Dang khoi dong AI Interpreter Service...
echo [Local] URL: http://localhost:8081
echo.
echo [OmniSuite] dang khoi dong AI Interpreter Service...
echo [Local] URL: http://localhost:8080
echo.

:: Kiem tra Python da duoc cai dat chua
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Khong tim thay Python. Vui long cai dat Python de su dung tinh nang nay.
    pause
    exit /b
)

:: Chay Flask service
python interpreter_service.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Co loi xay ra khi chay service. 
    echo Hay dam bao ban da cai dat cac thu vien: pip install flask flask-cors litellm google-generativeai openai
    pause
)
