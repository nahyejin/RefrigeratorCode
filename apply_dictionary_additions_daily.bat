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
REM   2.5) 대체 재료 표를 다시 만듦 (새 재료의 "대체 가능" 이 여기서 생긴다)
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
set CSVS=frontend/public/ingredient_profile_dict_with_substitutes.csv backend/ingredient_profile_dict_with_substitutes.csv frontend/public/ingredient_substitute_table.csv backend/premium_ingredients_auto.json

echo [%date% %time%] 사전 추가분 반영 시작 >> %LOG%

REM 0) 사전에 없어 **버려진 이름** 을 자동으로 판정해 넣는다.
REM    LLM 이 본문에서 뽑은 재료 중 사전에 없는 이름은 그대로 버려졌다
REM    (2026-09-06 기준 14,328종 / 62,185회). 그만큼 카드의 재료가 적게 나오고
REM    매칭률도 낮게 잡혔다.
REM
REM    **6회 이상 나온 것만** 돌린다. 그 아래 꼬리에는 `코스트코 호래기`,
REM    `쿠킹 포일` 같은 것이 섞여 있고(2회 이하가 누적 37.7%), 사전은 모든
REM    사용자의 매칭 기준이라 한 번 들어가면 되돌리기 어렵다.
REM    나머지는 어드민 '사전' 탭에 그대로 남아 손으로 볼 수 있다.
REM
REM    아래 1) 보다 **먼저** 돈다 — 오늘 넣은 것이 오늘 CSV 까지 가야 한다.
REM    실패해도 멈추지 않는다 — 사전 반영 자체는 그것과 상관없이 돌아야 한다.
%PY% -u scripts\auto_curate_dictionary.py --write >> %LOG% 2>&1

REM 1) DB -> CSV
%PY% -u scripts\apply_dictionary_additions.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 2) 백엔드 사본 맞추기
%PY% -u scripts\sync_ingredient_dict.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 2.2) 새 재료의 **Feature(맛/식감/쓰임)** 를 채운다.
REM    승인·자동 큐레이션으로 들어온 재료는 Feature 가 비어 있다. 그런데 바로
REM    아래 대체표는 **Feature 60% + 분류 40%** 로 비슷한 재료를 고르므로,
REM    비어 있으면 "분류가 같다" 는 이유만으로 대체재가 붙는다.
REM    (2026-09-07 기준 재료 1,634개 중 274개가 그 상태였다)
REM    빈 것만 채우므로 대개 대상이 0개고, 그러면 LLM 을 부르지도 않는다.
%PY% -u scripts\fill_ingredient_features.py --write >> %LOG% 2>&1

REM 2.5) **대체 재료 표를 다시 만든다.**
REM    사전에 새 재료가 들어와도 대체표는 그대로였다. 대체표는 손으로
REM    돌리는 스크립트였고, 실제로 4개월(4/18~9/5) 동안 안 돌아서
REM    그 사이 승인한 재료 57개가 "대체 가능" 을 하나도 못 갖고 있었다.
REM    4초면 끝나므로 사전이 바뀌든 말든 매일 같이 돌린다.
%PY% -u ingredient_management\generate_substitutes.py >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 2.7) 새로 들어온 재료 중 **«특별한 날» 감**을 골라 프리미엄 목록에 넣는다.
REM    사전은 매일 자동으로 늘어나는데 프리미엄 목록은 손으로 적은 표라,
REM    새로 들어온 `성게알`·`부챗살` 같은 것을 「특별한 날」이 영영 못 본다.
REM    **빈도 상한 1%** · 최소 등장 5회 · LLM 판정 세 가지로 거른다.
REM    한 번 물어본 이름은 다시 안 묻는다 — 호출은 하루 10회까지다.
%PY% -u scripts\propose_premium_ingredients.py --write >> %LOG% 2>&1

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

REM 4.5) 「특별한 날」 프리미엄 목록이 사전과 어긋나지 않는지 본다.
REM    `used_ingredients` 에는 대표어만 남으므로, 프리미엄 이름이 대표어로
REM    없거나 동의어로 합쳐져 사라지면 그 재료는 **영영 안 걸린다.** 아무 오류도
REM    안 나는 종류라 따로 본다. 여기서 멈추지는 않는다 — 로그에만 남긴다.
%PY% -u scripts\check_premium_ingredients.py >> %LOG% 2>&1

REM 5) 사전 CSV 와 대체표만 커밋하고 푸시.
REM    `git add -A` 를 쓰지 않는다 - 작업하던 다른 파일이 딸려 올라간다.
git diff --stat -- %CSVS% >> %LOG% 2>&1
git add %CSVS% >> %LOG% 2>&1
git commit -m "재료 사전 추가분 + 대체 재료 표 반영 (어드민 승인분 자동)" >> %LOG% 2>&1
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
