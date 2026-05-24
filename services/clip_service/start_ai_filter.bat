@echo off
color 0A
title Khoi dong Loi Loc Anh AI (CLIP Vision)
echo ===================================================
echo   OMMITOOL - HE THONG LOC ANH SEMANTIC AI
echo ===================================================
echo [1] Kiem tra moi truong Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] May nay chua cai Python. Vui long cai Python truoc!
    pause
    exit
)

echo [2] Kiem tra thu vien AI...
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo [3] Phat hien chua cai thu vien. Dang tu dong cai dat (Chi 1 lan duy nhat, mat vai phut)...
    pip install -r requirements.txt
)

echo [4] Dang khoi dong AI Model (Neu chay lan dau se mat 1-2 phut de tai Nao CLIP 600MB)...
uvicorn clip_service:app --host 0.0.0.0 --port 8000
pause
