#!/bin/bash
# 개발 환경 실행 스크립트

echo "Starting development servers..."

echo ""
echo "Starting Backend Server..."
cd backend
python app.py &
BACKEND_PID=$!

echo ""
echo "Starting Frontend Server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Development servers are starting..."
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers..."

# 서버들을 백그라운드에서 실행하고 대기
wait 