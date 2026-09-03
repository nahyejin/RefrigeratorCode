@echo off
REM ============================================================
REM  어드민에서 승인한 사전 추가분을 저장소 CSV 로 옮기고 **푸시까지 한다.**
REM
REM  왜 필요한가:
REM   어드민 "사전" 탭에서 승인한 항목은 DB(ingredient_dictionary_additions)에
REM   쌓이고, 서버는 사전을 읽을 때 CSV + DB 를 합쳐 쓴다. 그래서 반영은 즉시
REM   되지만 **저장소의 CSV 는 그대로**라, 시간이 지나면 CSV 가 진짜가 아니게 된다.
REM   (배치 스크립트와 브라우저는 CSV 를 직접 읽는다)
REM
REM   서버가 도는 Railway 는 파일시스템이 임시라 거기서 CSV 를 못 고친다.
REM   이 컴퓨터는 매일 03:00 재료 추출을 돌리며 항상 켜져 있으므로, 여기서 옮긴다.
REM
REM  왜 커밋·푸시까지 하나:
REM   **승인은 이미 어드민에서 끝났다.** 관리자가 "반영" 을 누른 순간이 승인이고,
REM   그 뒤에 사람이 또 확인하라고 하면 같은 판단을 두 번 하게 된다. 실제로
REM   승인해 둔 항목이 며칠씩 저장소에 안 올라간 채 남아 있었다.
REM
REM   대신 **자동으로 올리는 것이 안전하도록** 앞에 검증을 둔다:
REM     - 사전이 정상으로 읽히는지 확인하고, 깨졌으면 되돌리고 푸시하지 않는다
REM     - 커밋 대상은 **사전 CSV 두 개뿐**이다. 작업하던 다른 파일이 딸려
REM       올라가지 않는다 (예전에 CSV 를 커밋하다 비밀번호 해시가 든 백업까지
REM       올릴 뻔한 적이 있다)
REM
REM  하는 일:
REM   1) DB 승인분을 CSV 에 반영
REM   2) 백엔드 사본(backend/...csv)까지 맞춤
REM   3) 바뀐 게 없으면 종료
REM   4) 사전이 정상으로 읽히는지 확인  <- 실패하면 되돌리고 멈춘다
REM   5) 사전 CSV 두 개만 커밋하고 푸시
REM
REM  주의: 이 파일은 반드시 CRLF 개행으로 저장할 것.
REM   LF 로 저장하면 cmd.exe 가 잘못 읽어 즉시 실패한다.
REM ============================================================
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

cd /d "%~dp0"

set LOG=dictionary_sync.log
set PY="C:\Users\user\venv310\Scripts\python.exe"
set CSVS=frontend/public/ingredient_profile_dict_with_substitutes.csv backend/ingredient_profile_dict_with_substitutes.csv

echo [%date% %time%] 사전 추가분 반영 시작 >> %LOG%

REM 1) DB -> CSV
%PY% -u scripts\apply_dictionary_additions.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 2) 백엔드 사본 맞추기
%PY% -u scripts\sync_ingredient_dict.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 3) 바뀐 게 없으면 여기서 끝 (매일 도는데 대부분은 바뀔 게 없다)
git diff --quiet -- %CSVS%
if not errorlevel 1 (
  echo [%date% %time%] 바뀐 내용 없음 >> %LOG%
  goto done
)

REM 4) 사전이 깨지지 않았는지 확인. 깨졌으면 되돌리고 **푸시하지 않는다.**
%PY% -u scripts\verify_ingredient_dict.py >> %LOG% 2>&1
if errorlevel 1 (
  echo [%date% %time%] 사전 검증 실패 - 변경을 되돌리고 푸시하지 않습니다 >> %LOG%
  git checkout -- %CSVS%
  goto failed
)

REM 5) 사전 CSV 두 개만 커밋하고 푸시.
REM    `git add -A` 를 쓰지 않는다 - 작업하던 다른 파일이 딸려 올라간다.
git diff --stat -- %CSVS% >> %LOG% 2>&1
git add %CSVS% >> %LOG% 2>&1
git commit -m "재료 사전 추가분 반영 (어드민 승인분 자동)" >> %LOG% 2>&1
if errorlevel 1 (
  echo [%date% %time%] 커밋할 것이 없거나 커밋 실패 >> %LOG%
  goto done
)
git push origin main >> %LOG% 2>&1
if errorlevel 1 (
  echo [%date% %time%] 푸시 실패 - 커밋은 남아 있습니다. 네트워크/인증을 확인하세요 >> %LOG%
  goto done
)
echo [%date% %time%] 커밋·푸시 완료 >> %LOG%
goto done

:failed
echo [%date% %time%] 실패 (exit=%ERRORLEVEL%) >> %LOG%

:done
REM 어드민 '운영' 탭이 읽을 상태를 기록한다. 파일 최종수정일·작업 스케줄러·
REM 로그 마지막 줄은 이 컴퓨터에만 있어서, 서버는 이 값을 읽기만 한다.
%PY% -u scripts\report_ops_status.py --write >> %LOG% 2>&1
echo. >> %LOG%
