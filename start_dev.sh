#!/bin/bash
# 개발 환경 실행 스크립트

echo "🚀 개발 환경 시작..."

# 백엔드 서버 시작 (백그라운드)
echo "📡 백엔드 서버 시작..."
cd backend
python run_dev.py &
BACKEND_PID=$!
cd ..

# 잠시 대기
sleep 3

# 프론트엔드 서버 시작
echo "🌐 프론트엔드 서버 시작..."
cd frontend
npm run dev

# 백엔드 프로세스 종료
echo "🛑 백엔드 서버 종료..."
kill $BACKEND_PID 