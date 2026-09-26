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
rem  컴퓨터 끄기는 평일 18:00 run_evening_sleep.bat(최대 절전)이 맡는다.
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

echo [%date% %time%] ===== 매일 배치 끝 ===== >> %CHAIN_LOG%

rem 끝나도 끄지 않는다 — 평일 저녁 6시 run_evening_sleep.bat 이 최대 절전으로 보낸다(2026-09-26 변경:
rem 아침 7시에 켜지고 저녁 6시에 꺼지게). 예전엔 여기서 평일에 5분 뒤 종료했다.
