@echo off
chcp 65001 >nul
rem ============================================================================
rem  쿡매치 매일 배치 — 아침 7시에 한 줄로 이어서 돌리고, 다 끝나면(평일만) 컴퓨터를 끈다.
rem
rem  왜 한 줄로 묶나(2026-09-26 사용자 요청):
rem    사용자는 아침 7시에 출근하며 컴퓨터를 켜 두고 나간다. 예전에는 작업마다 시각이 따로였다
rem    (크롤러 22:00 · LLM 05:00 · 사전 06:30 · 알림 07:00). 밤·새벽에 컴퓨터가 꺼져 있으면 켜는 순간 전부
rem    한꺼번에 몰려 돌았고, 크롤러는 끄는 시각에 도중에 끊기곤 했다. 크롤러는 날마다 걸리는 시간이
rem    달라서(약 4시간) 정해진 시각에 끄면 또 끊긴다 → 차례로 돌리고 **마지막이 끝난 뒤** 끈다.
rem
rem  순서: 유통기한 알림(아침에 가야 해서 맨 앞) → 크롤러 → LLM 재료 추출 → 사전 반영 → (평일) 종료
rem  각 단계는 원래 배치 파일을 그대로 부른다 — 로그도 각자 원래 파일에 남는다. 이 파일 기록은 daily_chain.log.
rem  한 단계가 실패해도 다음 단계는 돈다. 변수 이름은 CHAIN_ 을 붙인다 — 불려 가는 배치들이 LOG·PY 를 덮어쓴다.
rem
rem  종료 막기: 컴퓨터를 계속 쓰고 싶으면 예고 창이 뜬 5분 안에 명령 프롬프트에서  shutdown /a
rem            아예 끄지 않으려면 이 폴더에 no_shutdown.flag 파일을 만들어 둔다(지우면 다시 끈다).
rem ============================================================================
cd /d "C:\Users\user\Desktop\RefrigeratorCode"
set CHAIN_LOG=C:\Users\user\Desktop\RefrigeratorCode\daily_chain.log
set CHAIN_PY="C:\Users\user\venv310\Scripts\python.exe"

echo [%date% %time%] ===== 매일 배치 시작 ===== >> %CHAIN_LOG%

echo [%date% %time%] 1/4 유통기한 알림 >> %CHAIN_LOG%
call run_expiry_push_daily.bat

echo [%date% %time%] 2/4 크롤러 >> %CHAIN_LOG%
call run_crawlers_scheduled.bat

echo [%date% %time%] 3/4 LLM 재료 추출 >> %CHAIN_LOG%
call run_llm_ingredients_daily.bat

echo [%date% %time%] 4/4 사전 반영 >> %CHAIN_LOG%
call apply_dictionary_additions_daily.bat

echo [%date% %time%] ===== 매일 배치 끝 ===== >> %CHAIN_LOG%

rem 평일(월~금)에만 끈다 — 주말엔 집에서 컴퓨터를 쓰고 있을 수 있다.
%CHAIN_PY% -c "import datetime,sys; sys.exit(0 if datetime.date.today().weekday()<5 else 1)"
if errorlevel 1 (
  echo [%date% %time%] 주말이라 끄지 않음 >> %CHAIN_LOG%
  goto :eof
)
if exist no_shutdown.flag (
  echo [%date% %time%] no_shutdown.flag 가 있어 끄지 않음 >> %CHAIN_LOG%
  goto :eof
)
echo [%date% %time%] 5분 뒤 컴퓨터 종료 예약 >> %CHAIN_LOG%
shutdown /s /t 300 /c "쿡매치 매일 배치가 끝나 5분 뒤 컴퓨터를 끕니다. 계속 쓰려면 명령 프롬프트에서 shutdown /a 를 입력하세요."
