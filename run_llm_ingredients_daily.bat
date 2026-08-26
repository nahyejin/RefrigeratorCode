@echo off
REM ============================================================
REM  누적 레시피의 재료를 LLM으로 재추출 (무료 티어 한도 내 매일 조금씩)
REM
REM  왜 크롤러와 분리했나:
REM   크롤러는 주 1회(월요일)만 도는데 이 작업은 매일 돌려야 하므로,
REM   크롤러에 딸려 있으면 주 1회밖에 처리되지 않는다.
REM
REM  한도 계산:
REM   무료 티어는 하루 500회 호출. 챗봇도 같은 키를 쓰므로 450회만 사용.
REM   12건씩 묶어 보내므로 하루 최대 450 x 12 = 5,400건.
REM
REM  주의: 이 파일은 반드시 CRLF 개행으로 저장할 것.
REM   LF 로 저장하면 cmd.exe 가 캐럿(^) 줄바꿈을 잘못 읽어
REM   "'ng-only'은(는) 내부 또는 외부 명령이 아닙니다" 같은 오류로 즉시 실패한다.
REM   그래서 인자도 캐럿으로 나누지 않고 한 줄에 둔다.
REM ============================================================
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

cd /d "%~dp0"

echo [%date% %time%] LLM 재료 추출 시작 >> llm_ingredients.log

"C:\Users\user\venv310\Scripts\python.exe" -u ingredient_management\llm_ingredient_extraction.py --pending-only --commit --limit 5400 --batch-size 12 --rpm 12 --concurrency 2 >> llm_ingredients.log 2>&1

echo [%date% %time%] LLM 재료 추출 종료 (exit=%ERRORLEVEL%) >> llm_ingredients.log
