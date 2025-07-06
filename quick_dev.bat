@echo off
echo ========================================
echo   빠른 개발 모드
echo ========================================
echo.

echo 🚀 프론트엔드만 시작 (백엔드는 이미 실행 중이어야 함)
cd frontend
npm run dev

echo.
echo 💡 사용법:
echo    - 백엔드가 이미 실행 중인지 확인
echo    - 코드 수정 후 자동으로 반영됨
echo    - http://localhost:5173 에서 확인
echo.
pause 