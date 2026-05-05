@echo off
setlocal
title OMNISUITE AI - Dependency Setup

echo [+] Starting Python dependency setup...
cd /d "%~dp0.."

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

echo [+] Installing dependencies from python_engine/requirements.txt...
python -m pip install -r python_engine/requirements.txt

if %errorlevel% neq 0 (
    echo [!] ERROR: Failed to install some dependencies.
    pause
    exit /b 1
)

echo.
echo [+] Verifying critical imports...
python -c "import pydantic; print('  - pydantic: OK')"
python -c "import flask; print('  - flask: OK')"
python -c "from google import genai; print('  - google-genai: OK')"
python -c "import openai; print('  - openai: OK')"
python -c "import httpx; print('  - httpx: OK')"
python -c "import bs4; print('  - beautifulsoup4 (bs4): OK')"
python -c "import pytrends.request; print('  - pytrends: OK')"
python -c "import openpyxl; print('  - openpyxl: OK')"

echo.
echo [OK] Synchronization complete! 
echo [!] NOTE: If you still see red squiggles in Cursor/VS Code:
echo     1. Press Ctrl+Shift+P
echo     2. Type 'Python: Select Interpreter'
echo     3. Select the Python path that was used above.
echo     4. Restart the IDE if necessary.
echo.
pause
