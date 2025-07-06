@echo off
echo ========================================
echo   배포 상태 확인
echo ========================================
echo.

echo 🚀 배포된 사이트 확인 중...
start https://refrigerator-code.vercel.app/

echo.
echo 📊 Vercel 대시보드 확인 중...
start https://vercel.com/dashboard

echo.
echo 🔧 Railway 백엔드 확인 중...
start https://railway.app/dashboard

echo.
echo ========================================
echo   배포 확인 완료!
echo ========================================
echo.
echo 💡 배포 확인 방법:
echo    1. https://refrigerator-code.vercel.app/ 에서 기능 테스트
echo    2. Vercel 대시보드에서 빌드 상태 확인
echo    3. Railway 대시보드에서 백엔드 상태 확인
echo.
echo ⚠️  만약 변경사항이 반영되지 않았다면:
echo    - GitHub에 푸시했는지 확인
echo    - Vercel/Railway 빌드 로그 확인
echo    - 몇 분 기다린 후 새로고침
echo.
pause 