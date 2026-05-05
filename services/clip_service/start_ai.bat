@echo off
echo [*] Starting OMMITOOL AI Image Pipeline Server (Port 8000)...
uvicorn pipeline_engine:app --host 0.0.0.0 --port 8000
pause
