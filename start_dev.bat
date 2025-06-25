@echo off
REM Windows용 개발 환경 실행 스크립트

echo 🚀 개발 환경 시작...

REM 백엔드 서버 시작 (백그라운드)
echo 📡 백엔드 서버 시작...
cd backend
start /B python run_dev.py
cd ..

REM 잠시 대기
timeout /t 3 /nobreak > nul

REM 프론트엔드 서버 시작
echo 🌐 프론트엔드 서버 시작...
cd frontend
npm run dev

echo 🛑 개발 환경 종료... 