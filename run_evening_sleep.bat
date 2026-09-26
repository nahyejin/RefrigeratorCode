@echo off
chcp 65001 >nul
rem ============================================================================
rem  평일 저녁 6시 — 컴퓨터를 최대 절전으로 보낸다(2026-09-26 사용자 요청: 아침 7시에 켜지고 저녁 6시쯤 꺼지게).
rem
rem  왜 「종료」가 아니라 「최대 절전」인가:
rem    완전히 끈 컴퓨터는 윈도우가 다시 켤 수 없다(메인보드 BIOS 의 예약 켜기가 따로 필요).
rem    최대 절전은 전원이 꺼진 것과 거의 같지만(전기 거의 안 씀), 예약 작업이 깨울 수 있다 →
rem    아침 7시 CookMatch-DailyChain 이 컴퓨터를 깨워 배치를 돌린다.
rem
rem  - 5분 전에 알림 창을 띄운다. 계속 쓰려면 이 폴더에 no_shutdown.flag 를 만들면 그날(과 이후) 건너뛴다.
rem  - 아침 배치가 아직 돌고 있으면(크롤러가 늦게 끝난 날) 끝날 때까지 10분씩 기다린다(최대 3시간).
rem  기록: daily_chain.log
rem ============================================================================
cd /d "C:\Users\user\Desktop\RefrigeratorCode"
set SLEEP_LOG=C:\Users\user\Desktop\RefrigeratorCode\daily_chain.log

set /a WAITED=0
:wait_chain
schtasks /query /tn "CookMatch-DailyChain" /fo list | findstr /c:"Running" /c:"실행 중" >nul
if not errorlevel 1 (
  if %WAITED% GEQ 18 (
    echo [%date% %time%] 아침 배치가 3시간 넘게 안 끝나 최대 절전을 건너뜀 >> %SLEEP_LOG%
    goto :eof
  )
  echo [%date% %time%] 아침 배치가 아직 도는 중 — 10분 뒤 다시 확인 >> %SLEEP_LOG%
  set /a WAITED+=1
  timeout /t 600 /nobreak >nul
  goto wait_chain
)

msg * /time:300 "쿡매치: 5분 뒤 컴퓨터가 최대 절전으로 들어갑니다. 계속 쓰려면 프로젝트 폴더에 no_shutdown.flag 파일을 만드세요."
timeout /t 300 /nobreak >nul

if exist no_shutdown.flag (
  echo [%date% %time%] no_shutdown.flag 가 있어 최대 절전을 건너뜀 >> %SLEEP_LOG%
  goto :eof
)
echo [%date% %time%] 최대 절전으로 들어감(내일 07:00 에 배치 작업이 깨운다) >> %SLEEP_LOG%
shutdown /h
