@echo off
chcp 65001 >nul
cd /d "C:\Users\user\Desktop\RefrigeratorCode"
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
"C:\Users\user\venv310\Scripts\python.exe" -u run_all_crawlers.py >> "C:\Users\user\Desktop\RefrigeratorCode\scheduled_run.log" 2>&1
