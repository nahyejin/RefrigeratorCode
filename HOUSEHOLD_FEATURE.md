# 👨‍👩‍👧‍👦 식구 그룹 & 요리 캘린더

> 이 문서는 "식구 그룹"(다중 계정 냉장고/레시피 공유) 기능과 "요리 캘린더"
> 기능이 **지금 실제로 어떻게 동작하는지**를 정리한 것입니다. 여러 날에 걸쳐
> 점진적으로 만들어진 기능이라 `CHANGELOG.md`에는 변경 히스토리가 흩어져
> 있는데, 이 문서는 그 히스토리를 다시 읽지 않아도 "지금 이 기능이 왜 이렇게
> 동작하는지"를 한 번에 알 수 있게 하는 게 목적입니다. 기능을 바꾸면 이 문서도
> 함께 고쳐 주세요. DB 컬럼 자체의 정의는 [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)
> 참고.

## 한 줄 요약

여러 계정(가족/룸메이트 등, 혈연 아니어도 됨)이 **초대 코드**로 하나의
"그룹(household)"에 묶이면, 냉장고 재료를 공유하고, 원하면 즐겨찾기·기록·완료
활동도 서로 볼 수 있고, 요리 캘린더에서 그룹 전체의 완료 현황과 이번 달 목표
달성률·절약액 추정치를 함께 본다.

---

## 1. 그룹(household) 생성/참여/탈퇴

- **생성**: `POST /api/households` — 아무나 만들 수 있고, 이미 그룹에 속해
  있으면 에러. 생성 시 자신이 `storage_user_id`(재료가 실제 저장되는 계정)가
  된다.
- **참여**: `POST /api/households/join` — 8자리 초대 코드로 참여. 참여자는
  두 가지를 직접 고른다:
  - `merge_ingredients`(기본 true): 내 기존 재료를 그룹 재료에 합칠지. 그룹
    차원에서 `allow_ingredient_merge`가 꺼져 있으면 **무조건 false로
    강제**되고, 응답에 `merge_denied_by_policy: true`가 담겨 프론트가 안내
    문구를 정확히 보여준다.
  - `share_recipe_actions`(기본 true): 즐겨찾기·완료·기록을 그룹원에게 보여줄지.
- **탈퇴**: `POST /api/households/leave` — 나갈 때 내 재료를 어떻게 되찾을지는
  `ingredients_merged`(참여 시 실제로 합쳤었는지)에 따라 분기한다:
  - 합쳤었다면(`ingredients_merged=1`): 나가는 시점의 그룹 재료 스냅샷을
    복사해서 가져간다(그룹에는 그대로 남음).
  - 합친 적 없다면(`ingredients_merged=0`): 애초에 내 원래 재료는 건드려진
    적이 없으므로, 그냥 다시 "보이게" 될 뿐이다.
  - ⚠️ 예전엔 이 분기가 없어서 "합치지 않겠다"고 골랐던 사람도 나갈 때 그룹
    재료로 덮어써지는 버그가 있었다. 지금은 `ingredients_merged` 플래그로
    막혀 있다.
- **그룹은 특정 인물 소유가 아니다**: `created_by`(최초 생성자)가 나가도
  그룹은 그대로 유지되고, 남은 사람 누구나 모든 그룹 설정을 동등하게 바꿀 수
  있다("모두 동등" 원칙 — 재료 합치기 허용, 월 목표, 식구 수 전부 마찬가지).
- **코드 재발급**: `POST /api/households/regenerate-code` — 예전 코드는 즉시
  무효화된다.

## 2. 냉장고 재료 공유 — "리다이렉션" 방식

그룹의 재료 공유는 **재료 데이터를 복사하거나 합치는 별도 로직이 아니라**,
재료를 읽고 쓸 때 어느 계정의 `user_ingredients`를 볼지를 리다이렉션하는
방식으로 구현되어 있다.

```python
def resolve_ingredient_storage_user_id(cursor, user_id):
    household = get_household_by_user(cursor, user_id)
    return household['storage_user_id'] if household else user_id
```

이 함수 하나를 재료 조회/저장 엔드포인트 앞단에 끼워 넣는 것만으로 공유가
되기 때문에, **재료 관련 프론트 코드는 이 기능을 전혀 몰라도 된다** — 로그인한
계정이 그룹에 속해 있으면 서버가 알아서 그룹의 저장 계정으로 리다이렉트한다.

## 3. 즐겨찾기·완료·기록 공유 — `share_recipe_actions`

재료와 달리 즐겨찾기/완료/기록은 **계정별로 완전히 분리**돼 있다(합쳐지지
않음). 대신 "보여줄지 말지"만 `users.share_recipe_actions`로 제어한다.

- **마이페이지 피드**: `_get_household_action_recipes()`가 그룹원 중
  `share_recipe_actions=1`인 사람(+요청한 본인은 항상 포함) 전원의 활동을
  레시피 단위로 합쳐서(같은 레시피를 여러 명이 했으면 `acted_by` 배열로 묶어)
  하나의 목록으로 반환한다.
- **요리 캘린더**: 같은 필터를 쓰지만(`(share_recipe_actions = 1 OR id =
  %s)`), 레시피별로 합치지 않고 **날짜·사람 단위 그대로** 반환한다(달력엔
  "누가 언제 했는지"가 중요하므로).
- **내 것은 항상 보인다**: 이 필터는 `OR id = %s`(요청자 본인)를 항상 포함하므로,
  자기 자신의 `share_recipe_actions`가 꺼져 있어도 **본인 화면에서 자기
  활동이 안 보이는 일은 없다.** 안 보이는 건 항상 "다른 사람 화면에서 그
  사람 활동이 안 보이는" 경우다.

### ⚠️ 가장 흔한 오해 포인트

> "B 계정으로 레시피를 완료했는데 요리 캘린더에 안 보여요."

이건 거의 항상 **버그가 아니라 B의 `share_recipe_actions`가 꺼져 있는 것**이다.
실제로 2026-08-28에 프로덕션 DB를 직접 조회해서 이 패턴으로 재현된 사례를
확인했다(개발자 본인의 구글 로그인 테스트 계정 하나가 꺼져 있었음). 확인
순서:

1. 그룹 설정(마이페이지 → "그룹 설정" 펼치기) → 멤버 목록에서 그 계정이
   "공유 중"인지 "비공개"인지 확인.
2. 비공개라면: 본인 계정이면 그 행의 **[켜기]** 버튼을 눌러 바로 켤 수 있다
   (`POST /api/households/my-sharing`). 남의 계정이면 그 행을 눌러 "공유
   요청하기"를 보낼 수 있다 — 상대가 앱을 켜면 팝업으로 요청이 뜬다(푸시
   알림 아님).

### 자기 공유를 스스로 켜고 끄기 — `POST /api/households/my-sharing`

2026-08-28 이전에는 한번 `share_recipe_actions`를 끄면, **본인이 다시 켤
방법이 없었다** — 다른 그룹원이 "공유 요청"을 보내고 본인이 수락해야만
켜지는 경로만 있었다(`POST /api/households/share-requests/<id>/respond`).
위 오해가 반복 제기된 진짜 원인이 이 기능 공백이었을 가능성이 높아,
그룹 여부와 무관하게 자유롭게 켜고 끌 수 있는 `POST
/api/households/my-sharing`을 추가했다. `HouseholdSection.tsx`의 멤버
목록에서 본인 행에만 이 버튼이 보인다(상태 텍스트와 헷갈리지 않도록 별도
버튼 엘리먼트로 분리돼 있다).

## 4. 이번 달 요리 목표 — 그룹은 공동, 혼자는 개인

**그룹에 속해 있으면 목표는 그룹 전체가 공유하는 하나의 값이다.** 개인별로
따로 두지 않는다 — 그룹원 누가 바꾸든 모두에게 즉시 적용된다.

| 상황 | 저장 위치 | 변경 엔드포인트 |
|---|---|---|
| 그룹 있음 | `households.monthly_cooking_goal` | `POST /api/households/goal` (그룹원 누구나) |
| 혼자(그룹 없음) | `users.monthly_cooking_goal` | `POST /api/users/<id>/monthly-goal` (본인만) |

`GET /api/households/me/completed-calendar` 응답의 `group_goal` /
`my_personal_goal` 중 그룹 여부에 따라 프론트가 알맞은 값을 쓴다
(`isInHousehold ? groupGoal : personalGoal`).

## 5. 절약액 추정 — "한 끼 추정액" × "식구 수"

완료 횟수만으로는 실제 재료 가격을 알 수 없어 정확한 절약액 계산은
불가능하다. 대신 **대략적인 추정치**를 보여준다:

```
추정 절약액 = 이번 달 완료 횟수 × savings_per_meal × family_size
```

두 계수(`savings_per_meal`, `family_size`) 모두 **그룹(또는 혼자면 개인)이
직접 조정하는 값**이고, 저장/폴백/변경 방식이 완전히 같은 패턴이다:

- **`savings_per_meal`**(한 끼당 절약액, 기본 8,000원): 외식/배달 대비 집밥
  한 끼의 체감 절약액은 지역·식습관에 따라 다를 수 있어 직접 조정 가능.
- **`family_size`**(식구 수): **그룹에 연동된 계정 수와 다를 수 있다** —
  아이가 있는 집은 계정이 없어도 같이 먹기 때문이다. 그래서 계정 수와
  별개로 조정하는 값이다.

| 계수 | 상황 | 저장 위치 | 값이 없을 때(NULL) 기본값 | 변경 엔드포인트 |
|---|---|---|---|---|
| 한 끼 추정액 | 그룹 있음 | `households.savings_per_meal` | 8,000원 (`ESTIMATED_SAVINGS_PER_MEAL_DEFAULT`) | `POST /api/households/savings-per-meal` (그룹원 누구나) |
| 한 끼 추정액 | 혼자 | `users.savings_per_meal` | 8,000원 | `POST /api/users/<id>/savings-per-meal` (본인만) |
| 식구 수 | 그룹 있음 | `households.family_size` | 그룹 연동 계정 수 | `POST /api/households/family-size` (그룹원 누구나) |
| 식구 수 | 혼자 | `users.family_size` | 1 | `POST /api/users/<id>/family-size` (본인만) |

캘린더 응답의 `family_size_is_custom` / `savings_per_meal_is_custom` 필드로
각각 "직접 설정한 값인지, 기본값을 쓰고 있는지"를 구분할 수 있다.

## 6. 요리 캘린더 화면 구조 (`CookingCalendar.tsx`)

캘린더는 위에서부터 두 개의 카드로 나뉜다:

1. **목표 카드** (회색 배경): 이번 달 목표·달성률 게이지(그룹이면 완료 많은
   사람 순으로 색을 나눠 채움)·**인원별 색 범례**·절약액까지는 항상 보이고,
   안내 문구("매월 1일에 초기화..." 등)만 "자세히 보기" 버튼으로 접혀 있다
   (기본 접힘 — 카드가 길어져서 달력이 한 화면에 안 들어오는 문제가 있었음).
   ⚠️ 인원별 범례는 한때 "자세히 보기" 안에 넣었다가 "게이지 옆에 항상
   붙어 있어야지 숨기면 안 된다"는 지적으로 다시 밖으로 꺼냈다 — 누가 몇
   회 했는지는 게이지가 보여주는 핵심 정보의 일부라, 접어도 되는 부연
   설명(안내 문구)과는 무게가 다르다.
2. **캘린더 카드** (흰 배경 + 테두리): 일/주/월 전환, 이전/다음 탐색, 그룹
   요약, 실제 달력 그리드. 목표 카드와 시각적으로 분리돼 있다.

목표 수정("목표수정"), 한 끼 추정액 수정, 식구 수 수정 셋 다 같은 패턴이다:
버튼을 누르면 숫자 입력 박스 + **[적용]** 버튼이 나타나고, [적용]을
누르거나 입력창에서 Enter를 눌러야 저장된다(포커스를 잃는 것만으로는
저장되지 않는다 — 실수로 값이 바뀌는 걸 막기 위함). 한 끼 추정액·식구 수는
계산식 문장(읽기용, "외식·배달 대비 1인 한 끼 8,000원 추정 × 3회 × 식구
2명") 자체에는 수정 버튼을 넣지 않는다 — 문장 안에 버튼을 끼워 넣으면
이상한 지점에서 줄바꿈되고 어수선해 보인다는 지적을 받아, 문장은 순수
텍스트로 온전히 보여주고 그 아래 알약 모양 칩("1인 한 끼 8,000원 ✎",
"식구 2명 ✎")을 눌러서 고치게 분리했다.

이 화면과 마이페이지 둘 다 `PullToRefresh`(`components/PullToRefresh.tsx`)
로 감싸져 있어, 화면을 아래로 당기면 데이터를 다시 불러온다 — 다른
그룹원의 완료·즐겨찾기·기록으로 화면 내용이 바뀔 수 있는 화면이라 이
제스처가 특히 유용하다(자세한 동작은 파일 자체의 주석 참고. 브라우저
기본 당겨서 새로고침은 `index.css`에서 앱 전체에 꺼 뒀는데, 그건 페이지를
통째로 하드 리로드시켜 SPA 상태가 날아가기 때문이고, 이 컴포넌트는 터치
제스처만 감지해 지정된 콜백만 다시 실행한다).

## 7. 그룹 설정 카드 (`HouseholdSection.tsx`, 마이페이지)

- 그룹에 속해 있으면 기본으로 **접혀서** 제목("그룹 설정")과 한 줄 설명만
  보이고, 눈에 띄는 "펼치기" 알약 버튼으로 펼쳐야 초대 코드/멤버 목록/재료
  합치기 토글/코드 재발급·나가기 버튼이 보인다(내용이 길어 마이페이지
  전체를 차지하는 문제가 있었음).
- 멤버 목록에서:
  - 본인 행: 상태 텍스트("공유 중"/"비공개") + 별도 **[켜기]/[끄기]** 버튼.
  - 비공개인 다른 사람 행: 상태 텍스트 + 별도 **[공개 요청]** 버튼 — 누르면
    그 사람 활동 통계를 보고 "공유 요청하기"를 보낼 수 있는 팝업이 뜬다.
    (전에는 "비공개 · 요청하기 >"처럼 상태 텍스트 뒤에 글자로만 붙여 뒀는데,
    "비공개 요청하기"라는 하나의 버튼처럼(정반대 의미로) 읽힌다는 지적을
    받아, 본인 행의 [켜기]/[끄기]와 같은 방식으로 분리했다.)
  - 공유 중인 다른 사람 행: 그냥 표시만, 클릭 불가.
- 다른 그룹원이 "공유 요청" 팝업(`ShareRequestPopup`, 아래 9-1 참고)에서
  방금 수락했다면, 이 카드가 이미 화면에 떠 있어도 `household-share-updated`
  전역 이벤트를 받아 멤버 목록을 즉시 다시 불러온다.

## 8-1. 공유 요청 팝업은 앱 전역 (`ShareRequestPopup.tsx`)

다른 그룹원이 보낸 "즐겨찾기·완료·기록 공유해 달라" 요청 팝업은 특정 화면
전용이 아니라 `AppRouter.tsx`에 `<HomeInstallPrompt/>`/`<RecipeChatWidget/>`
와 같은 자리에 전역으로 하나만 마운트돼 있다. 전에는 이 확인을 마이페이지
안에서만 했었다 — 그래서 마이페이지에 들어가야만 뜨고, 다른 탭에 있는
동안은 요청이 와 있어도 몰랐다.

확인 시점: (1) 로그인 상태가 잡히는 순간, (2) 앱이 다시 화면에 보이게 될
때(`visibilitychange`/`focus`) — "앱에 다시 들어오는 순간 어느 탭에
있더라도"라는 요구를 이 두 시점으로 커버한다. 계속 켜져 있는 동안 실시간
폴링은 하지 않는다.

수락하면 `window.dispatchEvent(new CustomEvent('household-share-updated'))`
로 전역에 알린다. `MyPage.tsx`(그룹 활동 피드 재조회)와
`HouseholdSection.tsx`(멤버 목록 재조회) 둘 다 이 이벤트를 듣는다 — 팝업이
어느 화면 위에서 뜨든, 그 순간 다른 컴포넌트가 이미 떠 있어도 최신 상태로
따라간다. (이 이벤트 리스너를 만들 때 실제로 겪은 버그: `loadHouseholdRecipeFeeds`
가 `useCallback`으로 감싸지 않은 일반 함수라, `useEffect` 의존성 배열을
`[]`로 두면 "마운트 시점의"(아직 인증이 안 잡혔을 수 있는) `isLoggedIn`을
가둔 첫 렌더의 함수가 계속 쓰이는 stale closure가 생겨, 이벤트가 올 때마다
"로그인 안 됨" 분기로 빠져 `isInHousehold`를 엉뚱하게 `false`로 초기화해
버렸다 — 의존성 배열에 실제 의존값(`isLoggedIn`, `authUser?.id`)을 넣어야
매번 최신 함수로 다시 구독한다.)

## 8-2. 마이페이지 "전체보기"도 지금 보고 있던 목록을 그대로

마이페이지 인라인 미리보기에서 "우리 식구 모두 보기"로 보고 있다가
"전체보기 >"를 눌러 전체 목록 화면(`IngredientDetail.tsx`, 라우트
`/mypage/{favorite,recorded,completed}`)으로 넘어가면, 그 화면은 원래
**항상 내 localStorage만 읽어서** 그룹 combined 피드를 무시하고 "나의
것만"으로 되돌아가 버리는 문제가 있었다.

지금은 `navigate(to, { state: { recipes: displayXxxRecipes, isHouseholdView:
showAllHousehold } })`로 마이페이지가 지금 보여주고 있던 배열(개인 것만이든
그룹 combined든)을 라우터 state로 그대로 넘긴다. `IngredientDetail`은
`location.state?.recipes`가 있으면 그걸 쓰고, 없을 때만(직접 URL 진입/새로
고침 등) 예전처럼 localStorage를 읽는다. 그룹 combined일 때는 각 항목의
`acted_by`로 배지("OO·OO")도 그대로 붙고, 제목도 "우리 식구가 ..."로
바뀌고, "전체삭제"(내 localStorage만 지우는 동작이라 여러 명 항목이 섞인
목록에서는 화면과 결과가 어긋남)는 숨긴다.

## 9. 마이페이지 레이아웃 위계

```
[프로필]
[그룹 설정 카드]                         ← 계정/그룹 "설정"
─────────────────── (굵은 구분선) ───────────────────
[우리 식구 모두 보기 | 나의 것만 보기]     ← 이 토글이
[즐겨찾기 N · 기록 N · 완료 N]            ← 이 숫자와
[우리 식구가 즐겨찾는 레시피 목록]         ← 아래 세 목록
──────────── (얇은 선, subtle) ────────────  전체를 지배한다.
[우리 식구가 기록한 레시피 목록]           같은 이야기 안의 하위 구분이라
──────────── (얇은 선, subtle) ────────────  굵은 구분선을 쓰지 않는다.
[우리 식구가 완료한 레시피 목록]
```

토글 → 숫자 → 목록의 순서와, 구분선의 굵기 차이(설정↔활동 내역은 굵게,
활동 내역 안의 하위 목록끼리는 얇게)는 모두 "무엇이 무엇을 지배하는가"를
시각적으로 나타내려고 의도적으로 고른 것이다. `SectionBand` 컴포넌트의
`subtle` prop이 이 두 굵기를 구분한다.

## 10. 엔드포인트 요약

| 엔드포인트 | 용도 |
|---|---|
| `POST /api/households` | 그룹 생성 |
| `POST /api/households/join` | 초대 코드로 참여 |
| `POST /api/households/leave` | 그룹 나가기 |
| `GET /api/households/me` | 내 그룹 정보(멤버, 초대 코드, 정책) |
| `POST /api/households/regenerate-code` | 초대 코드 재발급 |
| `POST /api/households/settings` | `allow_ingredient_merge` 등 그룹 정책 변경 |
| `POST /api/households/goal` | 그룹 공동 월 목표 변경 |
| `POST /api/users/<id>/monthly-goal` | 개인(혼자) 월 목표 변경 |
| `POST /api/households/family-size` | 그룹 식구 수 변경 |
| `POST /api/users/<id>/family-size` | 개인(혼자) 식구 수 변경 |
| `POST /api/households/savings-per-meal` | 그룹의 한 끼당 절약액 추정치 변경 |
| `POST /api/users/<id>/savings-per-meal` | 개인(혼자)의 한 끼당 절약액 추정치 변경 |
| `POST /api/households/my-sharing` | 내 즐겨찾기·완료·기록 공유를 직접 켜고 끔 |
| `GET /api/households/members/<id>/stats` | 비공개 멤버의 활동 요약(요청 전 미리보기) |
| `POST /api/households/share-requests` | 다른 사람에게 공유 요청 보내기 |
| `GET /api/households/share-requests/pending` | 나에게 온 대기 중 요청 |
| `POST /api/households/share-requests/<id>/respond` | 요청 수락/거절(수락 시 내 공유 자동 켜짐) |
| `GET /api/households/me/{favorite,completed,recorded}-recipes` | 그룹 전체 활동 피드(레시피 단위로 합침) |
| `GET /api/households/me/completed-calendar` | 캘린더용 완료 내역(날짜·사람 단위, 안 합침) + 목표/식구수/한끼추정액 |

## 11. 테스트 시 주의사항

로컬 `.env`의 `DB_HOST`는 **프로덕션 Railway DB를 그대로 가리킨다** — 별도
로컬/테스트 DB가 없다. 이 기능을 테스트할 땐 반드시:

1. `@test.local` 이메일로 임시 계정을 만들어 테스트한다.
2. 테스트가 끝나면 `backend`에서 `from app import get_db`로 직접 DELETE해서
   프로덕션 DB에 테스트 흔적을 남기지 않는다(사용자 행, 완료/즐겨찾기 기록,
   빈 households 행 포함).
3. 실제 사용자 계정의 값을 바꿔야 할 때는(예: 잘못 설정된 `share_recipe_actions`
   를 고쳐주는 것) 직접 UPDATE하지 말고, 가능하면 해당 기능의 API/UI로
   본인이 직접 바꾸게 안내한다 — 자동화 도구가 실제 계정 데이터에 대한 직접
   쓰기를 막아 두기도 했고, 동의 없이 조용히 바꾸는 것도 바람직하지 않다.
