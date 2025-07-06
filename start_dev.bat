@echo off
echo ========================================
echo   냉털이 개발 서버 시작
echo ========================================
echo.

echo [1/3] 백엔드 서버 시작 중...
cd backend
start "Backend Server" cmd /k "python app.py"
timeout /t 3 /nobreak > nul

echo [2/3] 프론트엔드 서버 시작 중...
cd ../frontend
start "Frontend Server" cmd /k "npm run dev"
timeout /t 3 /nobreak > nul

echo [3/3] 브라우저에서 개발 환경 열기...
start http://localhost:5173

echo.
echo ========================================
echo   개발 환경이 준비되었습니다!
echo ========================================
echo.
echo 📱 프론트엔드: http://localhost:5173
echo 🔧 백엔드 API: http://localhost:5000
echo.
echo 💡 개발 워크플로우:
echo    1. 코드 수정
echo    2. localhost:5173에서 즉시 확인
echo    3. 문제 해결
echo    4. 완벽하게 작동 확인
echo    5. 커밋 & 푸시
echo    6. https://refrigerator-code.vercel.app/ 에 자동 배포
echo.
echo 🚀 배포된 사이트: https://refrigerator-code.vercel.app/
echo.
echo 서버를 종료하려면 각 터미널 창을 닫으세요.
echo ========================================
pause 