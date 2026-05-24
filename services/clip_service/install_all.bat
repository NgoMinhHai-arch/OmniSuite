@echo off
echo [*] Installing Python dependencies...
pip install -r requirements.txt
echo [*] Installing Playwright Chromium browser...
playwright install chromium
echo [!] All components installed successfully!
pause
