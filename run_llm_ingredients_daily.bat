@echo off
REM ============================================================
REM  누적 레시피의 재료를 LLM으로 재추출 (무료 티어 한도 내 매일 조금씩)
REM
REM  왜 크롤러와 분리했나:
REM   크롤러는 주 1회(월요일)만 도는데 이 작업은 매일 돌려야 하므로,
REM   크롤러에 딸려 있으면 주 1회밖에 처리되지 않는다.
REM
REM  한도 계산:
REM   무료 티어는 하루 500회 호출. 챗봇도 같은 키를 쓰므로 440회만 사용.
REM   12건씩 묶어 보내므로 하루 최대 440 x 12 = 5,280건.
REM
REM   2026-08-31: 예비분을 50 -> 60회로 늘림. 이날 챗봇이 58회를 써서
REM   배치 막판 7회 호출이 한도 밖으로 밀려나 84건이 429로 실패했다.
REM   (실패분은 llm_ingredients_done=0 으로 남아 다음날 자동 재시도됨)
REM
REM  왜 `--order recent` 인가 (기본값은 id 오름차순=오래된 것부터):
REM   기본값으로 돌리면 **사람 눈에 가장 잘 띄는 글이 맨 마지막에 처리된다.**
REM   앱은 최신순으로 보여 주는데, 2026-09-06 기준 처리된 것은 id 88,045 까지고
REM   가장 최근 글은 id 170,704 였다 — 최신 500건 중 조리 순서(cook_steps)가
REM   들어 있는 것이 **0건**이었다. 재료도 룰베이스 추출 그대로였다.
REM   밀린 것을 다 끝내려면 7일이 걸리는데, 그 7일 동안 첫 화면이 계속 틀린다.
REM   순서만 뒤집으면 모두 도는 데 걸리는 시간은 같고, **보이는 쪽부터** 맞추어진다.
REM   밀린 것을 다 따라잡은 뒤에는 매주 새로 크롤된 것이 다음날 바로 처리된다.
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

"C:\Users\user\venv310\Scripts\python.exe" -u ingredient_management\llm_ingredient_extraction.py --pending-only --order recent --commit --limit 5280 --batch-size 12 --rpm 12 --concurrency 2 >> llm_ingredients.log 2>&1

echo [%date% %time%] LLM 재료 추출 종료 (exit=%ERRORLEVEL%) >> llm_ingredients.log
