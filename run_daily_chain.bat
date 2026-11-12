@echo off
chcp 65001 >nul
rem ============================================================================
rem  쿡매치 매일 배치 — 아침 7시에(최대 절전 중이면 컴퓨터를 깨워서) 한 줄로 이어서 돌린다.
rem
rem  왜 한 줄로 묶나(2026-09-26 사용자 요청):
rem    사용자는 아침 7시에 출근하며 컴퓨터를 켜 두고 나간다. 예전에는 작업마다 시각이 따로였다
rem    (크롤러 22:00 · LLM 05:00 · 사전 06:30 · 알림 07:00). 밤·새벽에 컴퓨터가 꺼져 있으면 켜는 순간 전부
rem    한꺼번에 몰려 돌았고, 크롤러는 끄는 시각에 도중에 끊기곤 했다. 크롤러는 날마다 걸리는 시간이
rem    달라서(약 4시간) 정해진 시각에 끄면 또 끊긴다 → 차례로 돌리고 **마지막이 끝난 뒤** 끈다.
rem
rem  순서: 유통기한 알림(아침에 가야 해서 맨 앞) → 크롤러 → LLM 재료 추출 → 사전 반영
rem  끝나면 sleep_when_idle.ps1 이 10:00 이후·안 쓰고 있을 때 최대 절전(출근길 원격 접속 시간 확보).
rem  각 단계는 원래 배치 파일을 그대로 부른다 — 로그도 각자 원래 파일에 남는다. 이 파일 기록은 daily_chain.log.
rem  한 단계가 실패해도 다음 단계는 돈다. 변수 이름은 CHAIN_ 을 붙인다 — 불려 가는 배치들이 LOG·PY 를 덮어쓴다.
rem
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

echo [%date% %time%] 대체 재료 사전(레시피별, 2026-11-08 추가 단계 — 하루 1,500건씩 이어서) >> %CHAIN_LOG%
rem 43,933건을 하루 1,500건씩 약 30일. 이미 한 레시피는 건너뛰고, Gemini 한도(429)면 조용히 멈춰 다음 날 이어서 한다.
rem 끝나도(전부 처리) 그날 새로 바뀐 레시피만 다시 하므로 계속 둬도 된다. 최대 60분이 지나면 끊고 다음 단계로.
set PYTHONIOENCODING=utf-8
%CHAIN_PY% scripts\build_recipe_substitutes.py --commit --daily-limit 1500 --max-minutes 60 >> logs\recipe_substitutes_daily.log 2>&1
echo [%date% %time%] 대체 재료 사전 끝(종료 코드 %ERRORLEVEL%) >> %CHAIN_LOG%

echo [%date% %time%] 유튜브 조리 순서 구제(2026-11-12 추가 단계 — 자막으로 하루 일부씩 이어서) >> %CHAIN_LOG%
rem 조리 순서가 없는 유튜브 글(약 2,700건)을 한국어 자막+AI 로 채운다. 이미 한 글은 건너뛰고, 새로 올라온 글도 같은 단계가 계속 처리한다.
rem 유튜브가 요청을 막으면(IpBlocked) 그 자리에서 멈추고 다음 날 이어서 한다(우회하지 않는다). 최대 45분이 지나면 끊고 다음 단계로.
rem Gemini 무료 키를 재료 추출·대체 재료 사전과 나눠 쓰므로 하루 300건 이하. 한도(429)면 조용히 멈춘다. 로그: logs\youtube_rescue_daily.log
set PYTHONIOENCODING=utf-8
%CHAIN_PY% scripts\rescue_youtube_steps.py --commit --limit 300 --delay 15 --max-minutes 45 >> logs\youtube_rescue_daily.log 2>&1
echo [%date% %time%] 유튜브 조리 순서 구제 끝(종료 코드 %ERRORLEVEL%) >> %CHAIN_LOG%

echo [%date% %time%] DB 백업(2026-10-22 추가 단계) >> %CHAIN_LOG%
call run_db_backup_daily.bat

echo [%date% %time%] ===== 매일 배치 끝 ===== >> %CHAIN_LOG%

rem 끝나면 안 쓰고 있을 때 최대 절전(2026-09-29): 출근길(~10:00)엔 원격 접속을 위해 깨어 있다가 잠든다.
rem 자세한 규칙은 sleep_when_idle.ps1. 퇴근길은 평일 16:00 CookMatch-EveningWake 가 다시 깨운다.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sleep_when_idle.ps1" -NotBefore 10:00 -FromChain
