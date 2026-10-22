@echo off
chcp 65001 >nul
REM ============================================================
REM  운영 DB(Railway MySQL) 날짜별 백업 — 매일 배치(run_daily_chain.bat)의 한 단계.
REM
REM  왜: 서버·DB 가 Railway 한 곳에 있어, 그쪽이 장애가 나면 데이터를 꺼낼 길이 없다(2026-10-22 사용자 요청).
REM  하는 일: scripts\backup_db.py 를 돌려 프로젝트 밖(C:\Users\user\CookMatchBackups\db_날짜)에 .sql 로 저장하고,
REM          최근 7개만 남긴다. 읽기 전용이라 서비스에 영향이 없다(약 2분).
REM  백업에는 회원 이메일 같은 개인정보가 들어 있다 — 프로젝트(공개 저장소)·클라우드 동기화 폴더 밖에 둔다.
REM
REM  주의: 이 파일은 반드시 CRLF 개행으로 저장할 것.
REM ============================================================
cd /d "C:\Users\user\Desktop\RefrigeratorCode"
set BK_LOG=C:\Users\user\Desktop\RefrigeratorCode\db_backup.log
set BK_PY="C:\Users\user\venv310\Scripts\python.exe"
set PYTHONIOENCODING=utf-8

echo [%date% %time%] ===== DB 백업 시작 ===== >> %BK_LOG%
%BK_PY% scripts\backup_db.py --keep 7 >> %BK_LOG% 2>&1
echo [%date% %time%] ===== DB 백업 끝 (종료 코드 %ERRORLEVEL%) ===== >> %BK_LOG%
