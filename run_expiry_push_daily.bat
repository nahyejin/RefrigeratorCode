@echo off
REM ============================================================
REM  유통기한 임박 재료를 구독자에게 웹 푸시로 알린다.
REM
REM  마이페이지에서 알림을 켠 사람만 대상이다(로그인 필수 — 비회원 냉장고는
REM  브라우저에만 있어 서버가 못 본다). 계산 기준은 프론트(shelfLife.ts/
REM  expiry.ts)와 반드시 같아야 해서 그 로직을 그대로 옮겼다 — 자세한 내용은
REM  scripts/send_expiry_push_notifications.py 머리말 참고.
REM
REM  05:00 재료 추출·06:30 사전 동기화가 끝난 뒤, 사람들이 아침에 냉장고를
REM  확인할 만한 시간에 돈다.
REM
REM  주의: 이 파일은 반드시 CRLF 개행으로 저장할 것.
REM ============================================================
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

cd /d "%~dp0"

set LOG=expiry_push.log
set PY="C:\Users\user\venv310\Scripts\python.exe"

echo [%date% %time%] 유통기한 임박 알림 발송 시작 >> %LOG%
%PY% -u scripts\send_expiry_push_notifications.py --write >> %LOG% 2>&1
echo [%date% %time%] 종료 (exit=%ERRORLEVEL%) >> %LOG%
echo. >> %LOG%
