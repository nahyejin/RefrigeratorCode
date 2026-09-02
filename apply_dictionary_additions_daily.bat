@echo off
REM ============================================================
REM  어드민에서 승인한 사전 추가분을 저장소 CSV 로 옮겨 둔다.
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
REM  하는 일:
REM   1) DB 승인분을 CSV 에 반영
REM   2) 백엔드 사본(backend/...csv)까지 맞춤
REM   3) 사전이 정상으로 읽히는지 확인  <- 실패하면 변경을 되돌린다
REM   4) **여기서 멈춘다.** 커밋과 푸시는 사람이 한다.
REM
REM  ⚠️ 커밋/푸시를 여기서 하지 않는 이유:
REM   푸시는 곧 배포다. 사람이 안 보는 새벽에 스스로 출시까지 해 버리면,
REM   무엇이 언제 나갔는지 모른 채로 서비스가 바뀐다. 파일만 고쳐 두고
REM   변경 내용을 눈으로 본 뒤 내보내는 것이 맞다.
REM
REM   아침에 이렇게 확인하면 된다:
REM     git diff -- frontend/public/ingredient_profile_dict_with_substitutes.csv
REM     git add -A ^&^& git commit -m "재료 사전 추가분 반영" ^&^& git push
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

echo [%date% %time%] 사전 추가분 반영 시작 >> %LOG%

REM 1) DB -> CSV
%PY% -u scripts\apply_dictionary_additions.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 2) 백엔드 사본 맞추기
%PY% -u scripts\sync_ingredient_dict.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 3) 바뀐 게 없으면 여기서 끝 (매일 도는데 대부분은 바뀔 게 없다)
git diff --quiet -- frontend/public/ingredient_profile_dict_with_substitutes.csv backend/ingredient_profile_dict_with_substitutes.csv
if not errorlevel 1 (
  echo [%date% %time%] 바뀐 내용 없음 >> %LOG%
  goto done
)

REM 4) 사전이 깨지지 않았는지 확인. 깨졌으면 되돌린다.
%PY% -u scripts\verify_ingredient_dict.py >> %LOG% 2>&1
if errorlevel 1 (
  echo [%date% %time%] 사전 검증 실패 - 변경을 되돌립니다 >> %LOG%
  git checkout -- frontend/public/ingredient_profile_dict_with_substitutes.csv backend/ingredient_profile_dict_with_substitutes.csv
  goto failed
)

echo [%date% %time%] CSV 를 고쳐 두었습니다. 확인 후 직접 커밋/푸시하세요. >> %LOG%
git diff --stat -- frontend/public/ingredient_profile_dict_with_substitutes.csv >> %LOG% 2>&1
goto done

:failed
echo [%date% %time%] 실패 (exit=%ERRORLEVEL%) >> %LOG%

:done
REM 어드민 '운영' 탭이 읽을 상태를 기록한다. 파일 최종수정일·작업 스케줄러·
REM 로그 마지막 줄은 이 컴퓨터에만 있어서, 서버는 이 값을 읽기만 한다.
%PY% -u scriptseport_ops_status.py --write >> %LOG% 2>&1
echo. >> %LOG%
