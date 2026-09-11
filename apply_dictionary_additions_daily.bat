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
REM   이 컴퓨터는 매일 05:00 재료 추출을 돌리며 항상 켜져 있으므로, 여기서 옮긴다.
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
REM   1.5) 띄어쓰기만 다른 사전 중복 줄 병합
REM   2) 백엔드 사본(backend/...csv)까지 맞춤
REM   2.3) 새 재료 보관 일수(냉동/냉장/실온) 채움
REM   2.5) 대체 재료 표를 다시 만듦 (새 재료의 "대체 가능" 이 여기서 생긴다)
REM   2.9) 재료 역색인 갱신 (냉장고요리 매칭률이 이걸 보고 돈다)
REM   2.95) 쿠팡 광고 후보 건수·순위 재계산
REM   3) 바뀐 게 없으면 종료
REM   4) 사전이 정상으로 읽히는지 확인  <- 실패하면 되돌리고 멈춘다
REM   4.6) 사전 보강분을 이미 처리된 레시피/사용자 재료에도 소급 적용
REM   5) 사전 CSV·대체표·쿠팡 광고 후보를 커밋하고 푸시
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
set CSVS=frontend/public/ingredient_profile_dict_with_substitutes.csv backend/ingredient_profile_dict_with_substitutes.csv frontend/public/ingredient_substitute_table.csv backend/premium_ingredients_auto.json frontend/public/coupang_ads.csv

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
%PY% -u scripts\auto_curate_dictionary.py --write --max-minutes 40 >> %LOG% 2>&1

REM 1) DB -> CSV
%PY% -u scripts\apply_dictionary_additions.py --write >> %LOG% 2>&1
if errorlevel 1 goto failed

REM 1.5) **띄어쓰기만 다른 이름**을 한 줄로 합친다.
REM    사전이 승인·자동 큐레이션으로 매일 늘어나는데, 그 중 띄어쓰기만 다른
REM    중복 줄("나박 김치"/"나박김치")을 합쳐 주는 사람이 없었다. 검색 결과가
REM    중복으로 뜨는 것은 그렇다 치고, 더 나쁜 건 둘의 값(상위어·보관일수)이
REM    다를 때 **CSV 줄 순서가 우연히 뜻을 정하는 것**이었다. 백엔드 사본을
REM    맞추기(2번) 전에 돌려야 두 사본이 같은 내용을 받는다.
%PY% -u scripts\merge_spacing_variants.py --write >> %LOG% 2>&1

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

REM 2.3) 새 재료의 **보관 일수**(냉동/냉장/실온)를 채운다.
REM    바로 위 2.2)와 같은 이유 -- 새로 들어온 재료는 이 칸이 비어 있고, 비어
REM    있으면 **분류 단위 추정**으로 내려가는데 그게 실제로 상한 음식을 먹게
REM    만든 적이 있다(두부·콩나물이 마른 콩과 같은 칸이라 냉장 180일로 잡힘).
REM    LLM 이 낸 값은 분류 기준과 크게 어긋나면 스스로 버리는 안전장치가 있다.
REM    빈 것만 채우므로 대개 대상이 적어 LLM 호출도 그만큼 적다.
%PY% -u scripts\fill_shelf_life.py --write >> %LOG% 2>&1

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

REM 2.9) **재료 역색인**을 갱신한다.
REM    냉장고요리의 매칭률은 `recipe_ingredient(재료, 레시피, 가중치)` 를 보고
REM    구한다 — 재료 하나가 한 줄이라 "이 재료가 든 레시피" 를 인덱스로 바로
REM    찾는다. 이게 없으면 서버는 레시피 42,000건 하나하나에 REGEXP + REPLACE
REM    사슬을 돌리는 예전 방식으로 되돌아간다 (실측 2.0초 -> 0.6초).
REM
REM    새로 들어온 레시피는 색인에 없으므로 **매일** 붙여 줘야 한다. 앞의
REM    05:00 재료 추출이 끝난 뒤라 그날 것까지 들어온다. 대개 몇 초면 끝난다.
REM
REM    일요일에는 처음부터 다시 만든다. 사전이 바뀌어 이미 색인된 레시피의
REM    재료 이름이 달라지는 경우가 있는데, 증분으로는 그걸 못 잡는다.
REM    (요일 판정을 %date% 로 하면 지역 설정에 따라 글자가 달라져 파이썬에 맡긴다)
%PY% -c "import datetime,sys; sys.exit(0 if datetime.date.today().weekday()==6 else 1)"
if errorlevel 1 (
  %PY% -u scripts\build_ingredient_index.py --write --new >> %LOG% 2>&1
) else (
  %PY% -u scripts\build_ingredient_index.py --write >> %LOG% 2>&1
)

REM 2.95) **쿠팡 광고 후보 목록의 건수·순위를 지금 데이터로 다시 센다.**
REM    한 번 만들어 두고 그대로였는데, 사전이 바뀌면 재료 대표어가 갈리고
REM    ("파"->"대파") 레시피도 매일 늘어나 순위가 실제와 크게 달라진다
REM    (실측: 파 11,540->0건, 황다랑어 4,633->0건). 순위대로 링크를 채우는데
REM    순위가 틀리면 아무 글에도 안 걸리는 재료에 시간을 쓰게 된다. 사람이
REM    이미 채워 둔 링크는 그대로 두고 건수·순위만 다시 매긴다. 사전이 바뀌든
REM    말든(레시피가 매일 느니까) 매일 같이 돌린다 -- DB 읽기 + CSV 쓰기뿐이라
REM    LLM 호출은 없다.
%PY% -u scripts\refresh_coupang_ads.py --write >> %LOG% 2>&1

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

REM 4.6) 사전 보강분을 **이미 처리된 레시피 / 사용자 재료**에도 소급 적용한다.
REM    사전에 동의어가 새로 생겨도, 이미 처리된 레시피의 used_ingredients 나 사용자가
REM    이미 등록해 둔 재료 이름은 저절로 안 바뀐다 - 이 간극을 그동안 아무도 자동으로
REM    메워주지 않아서, 사전엔 있는 동의어가 옛 레시피엔 반영 안 된 채 쌓이고 있었다
REM    (실사용자 신고로 발견: "반숙란=달걀" 이 사전에 늦게 들어와, 그 전에 처리된
REM    레시피에서 계란이 통째로 빠진 채 남아 있던 사고, 2026-09-11).
REM    LLM 을 다시 부르지 않는 결정론적 재정규화라 빠르다. 오늘 사전이 안 바뀌었으면
REM    (이 지점은 3) 에서 이미 걸러졌으므로) 여기 온 날은 항상 뭔가 바뀐 날이다.
REM    실패해도 사전 자체는 이미 검증을 통과했으므로 CSV 커밋·푸시는 막지 않는다.
%PY% -u ingredient_management\renormalize_used_ingredients.py --commit >> %LOG% 2>&1
%PY% -u ingredient_management\migrate_user_ingredients.py --commit >> %LOG% 2>&1

REM 4.5) 「특별한 날」 프리미엄 목록이 사전과 어긋나지 않는지 본다.
REM    `used_ingredients` 에는 대표어만 남으므로, 프리미엄 이름이 대표어로
REM    없거나 동의어로 합쳐져 사라지면 그 재료는 **영영 안 걸린다.** 아무 오류도
REM    안 나는 종류라 따로 본다. 여기서 멈추지는 않는다 — 로그에만 남긴다.
%PY% -u scripts\check_premium_ingredients.py >> %LOG% 2>&1

REM 5) 사전 CSV·대체표·쿠팡 광고 후보만 커밋하고 푸시.
REM    `git add -A` 를 쓰지 않는다 - 작업하던 다른 파일이 딸려 올라간다.
git diff --stat -- %CSVS% >> %LOG% 2>&1
git add %CSVS% >> %LOG% 2>&1
git commit -m "재료 사전/대체 재료 표/쿠팡 광고 후보 자동 반영" >> %LOG% 2>&1
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
