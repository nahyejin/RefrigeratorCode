# 🗄️ 데이터베이스 스키마

> **이 문서는 실제 운영 DB(Railway MySQL)에서 그대로 뽑아 정리한 것입니다.**
> 2026-08-26 기준, `households`/`household_share_requests`와 `users`의 그룹
> 관련 컬럼은 2026-08-28 추가분까지 반영. 예전 버전은 실제와 다른 설계안
> (username/password_hash/phone, `user_recipes` 단일 테이블 등)이 적혀 있어
> 전면 교체했습니다. 스키마를 바꾸면 이 문서도 함께 고쳐 주세요.
> 식구 그룹/요리 캘린더 기능의 **동작 방식**(공유 판정, 목표·식구수가 개인값과
> 그룹값 중 어느 쪽을 쓰는지 등)은 스키마가 아니라 동작 설명이라 여기 대신
> [`HOUSEHOLD_FEATURE.md`](HOUSEHOLD_FEATURE.md)에 정리했습니다.

## 테이블 한눈에

| 테이블 | 행 수(2026-08-26) | 역할 |
|---|---|---|
| `recipes` | 44,509 | 크롤링한 레시피 본문·재료 |
| `users` | 6 | 계정 (소셜 + 일반) |
| `households` | — | 식구 그룹 (2026-08-27 신설) |
| `household_share_requests` | — | 즐겨찾기·완료·기록 공유 요청 (2026-08-27 신설) |
| `user_ingredients` | 172 | 내 냉장고 재료 |
| `user_favorite_recipes` | 2 | 즐겨찾기 |
| `user_recorded_recipes` | 16 | 기록한 레시피 |
| `user_completed_recipes` | 20 | 완료한 레시피 |
| `coupang_clicks` | — | 쿠팡 링크 클릭 로그 |
| `youtube_channel_cache` | 48 | 채널 URL → 채널 ID 캐시 (API 쿼터 절약) |
| `youtube_channel_meta` | 15 | 채널별 업로드 재생목록 ID 캐시 |
| `recipes_backup_20260418` | 0 | 과거 백업 (비어 있음 — 정리 대상) |

---

## 1. `recipes` — 레시피

```sql
id                      INT           PK
title                   TEXT          INDEX
link                    VARCHAR(255)  UNIQUE     -- 중복 수집 방지 키
content                 MEDIUMTEXT               -- 본문 원문 (재료 추출의 입력)
used_ingredients        TEXT                     -- ★ 화면의 재료 pill 이 읽는 열
used_ingredients_block  TEXT                     -- 본문에서 잘라낸 재료 블록 원문
block_reason            VARCHAR(255)             -- 블록을 못 찾았을 때의 사유
author                  VARCHAR(255)
thumbnail               TEXT
platform                VARCHAR(50)              -- naver / youtube 등
hits, likes, comments   INT
post_time               DATE
collected_at            DATETIME
llm_ingredients_done    TINYINT(1)    NOT NULL   -- ★ LLM 처리 여부 깃발 (0/1)
```

### `used_ingredients` 와 `llm_ingredients_done` 의 관계 (중요)

- **재료 열은 하나뿐입니다.** 룰베이스 추출과 LLM 추출이 **같은 `used_ingredients` 열**에
  씁니다. 별도 열을 두지 않으므로 LLM 처리 결과는 화면에 즉시 반영됩니다.
- `llm_ingredients_done` 은 재료 값이 아니라 **"이 행을 LLM 으로 처리했는지"** 표시입니다.
- 두 작업이 같은 열을 쓰기 때문에 **역할 분담이 정해져 있습니다.**
  - 룰베이스 배치 → `llm_ingredients_done = 0` 인 행만 (신규 수집분 임시 채움)
  - LLM 배치 → `llm_ingredients_done = 0` 인 행만 (처리 후 1 로 표시)
  - ⚠️ 룰베이스에서 이 조건을 빼면 **LLM 결과를 덮어써 버립니다.** (실제로 발생했던 버그)

### `author` 열 주의

네이버 인플루언서 크롤러가 작성자 대신 **다른 글의 제목**을 넣는 문제가 있습니다.
`strong.ell` 선택자가 "이 블로그 인기글" 같은 추천 글 제목에도 붙기 때문입니다.
화면에서는 이 열을 쓰지 않아 사용자 영향은 없지만, 값은 신뢰할 수 없습니다.

---

## 2. `users` — 계정

```sql
id                      INT           PK
email                   VARCHAR(255)  NOT NULL  INDEX
nickname                VARCHAR(255)  NOT NULL
provider                VARCHAR(50)   NOT NULL  INDEX   -- google / kakao / naver / local
provider_id             VARCHAR(255)  NOT NULL
password                VARCHAR(255)  NULL              -- provider='local' 일 때만 사용(해시)
deleted_at              DATETIME      NULL      INDEX   -- 소프트 삭제
created_at              DATETIME      NOT NULL
updated_at              DATETIME      NULL
household_id            INT           NULL      -- 속한 그룹(households.id). NULL이면 혼자
share_recipe_actions    TINYINT(1)    NOT NULL DEFAULT 1  -- 내 즐겨찾기·완료·기록을 그룹원에게 보여줄지
ingredients_merged      TINYINT(1)    NOT NULL DEFAULT 0  -- 그룹 참여 시 내 재료를 그룹에 합쳤는지(나갈 때 분기용)
monthly_cooking_goal    INT           NOT NULL DEFAULT 20 -- 혼자일 때만 쓰는 개인 목표(그룹이면 households 쪽 값 사용)
family_size             INT           NULL              -- 혼자일 때 절약액 계산용 식구 수. NULL이면 1
UNIQUE KEY (email, provider)
```

- 탈퇴는 행 삭제가 아니라 `deleted_at` 을 채우는 **소프트 삭제**입니다.
  같은 이메일·제공자로 재가입하면 기존 행을 되살립니다.
- 네이버 로그인은 프로필 API 가 별명을 `9208****` 처럼 마스킹해서 주기 때문에,
  마스킹된 값이면 **이메일 로컬 파트**를 닉네임으로 씁니다.
- `household_id`~`family_size` 는 2026-08-27~28에 걸쳐 추가된 "식구 그룹"
  기능용 컬럼입니다. 자세한 동작(공유 판정, 목표/식구수가 개인값과 그룹값 중
  어느 쪽을 쓰는지 등)은 [`HOUSEHOLD_FEATURE.md`](HOUSEHOLD_FEATURE.md) 참고.

---

## 3. `households` — 식구 그룹

```sql
id                     INT           PK
invite_code            VARCHAR(12)   UNIQUE  NOT NULL   -- 참여 코드(8자리 영숫자)
storage_user_id        INT           NOT NULL           -- 그룹의 냉장고 재료가 실제로 저장되는 계정(보통 창설자)
created_by             INT           NOT NULL           -- 최초 생성자 user_id (나가도 그룹은 유지됨)
allow_ingredient_merge TINYINT(1)    NOT NULL DEFAULT 1  -- 새로 참여하는 사람의 재료 합치기를 그룹 차원에서 허용할지
monthly_cooking_goal   INT           NOT NULL DEFAULT 20 -- 그룹 전체가 공유하는 이번 달 목표(개인별 아님)
family_size            INT           NULL               -- 그룹의 식구 수(절약액 계산용). NULL이면 연동 계정 수를 대신 씀
created_at             DATETIME      NOT NULL
```

- 그룹원 전체가 **동등한 권한**을 가진다 — `created_by`만 특별한 권한을 갖지
  않으며, `allow_ingredient_merge`/`monthly_cooking_goal`/`family_size` 모두
  그룹원 누구나 바꿀 수 있다.
- 재료 공유는 이 테이블에 재료를 직접 넣는 게 아니라, 그룹원 전체의
  `user_ingredients` 조회/저장을 `storage_user_id` 계정으로 **리다이렉션**하는
  방식이다(`resolve_ingredient_storage_user_id()`).

---

## 4. `household_share_requests` — 즐겨찾기·완료·기록 공유 요청

```sql
id            INT       PK
requester_id  INT       NOT NULL   -- 요청 보낸 사람
target_id     INT       NOT NULL   -- 요청 받은 사람(비공개인 그룹원)
status        VARCHAR(20)  NOT NULL DEFAULT 'pending'  -- pending | accepted | declined
created_at    DATETIME  NOT NULL
responded_at  DATETIME  NULL
```

- 다른 그룹원의 `share_recipe_actions`가 꺼져 있을 때, "공유해 달라"고
  요청하는 용도. 앱을 켰을 때 팝업으로 표시된다(푸시 알림 아님).
- 본인이 직접 자기 공유를 켜고 싶을 땐 이 요청 없이 `POST
  /api/households/my-sharing`으로 바로 켤 수 있다 — 자세한 내용은
  [`HOUSEHOLD_FEATURE.md`](HOUSEHOLD_FEATURE.md) 참고.

---

## 5. `user_ingredients` — 내 냉장고

```sql
id             INT                                  PK
user_id        INT           NOT NULL               INDEX
name           VARCHAR(255)  NOT NULL
storage_box    ENUM('frozen','fridge','room')  NOT NULL  INDEX
expiry_date    DATE          NULL                   -- 유통기한
purchase_date  DATE          NULL                   -- 구매 시점
created_at     DATETIME      NOT NULL
updated_at     DATETIME      NULL
saved_at       DATETIME      NULL
```

비로그인 사용자는 DB 가 아니라 **localStorage(`myfridge_ingredients`)** 에 보관합니다.
로그인하면 서버로 옮겨집니다.

---

## 6. 레시피 액션 테이블 3종

`user_favorite_recipes` / `user_recorded_recipes` / `user_completed_recipes` 는
구조가 동일합니다. (예전 문서엔 `action_type` 을 가진 단일 테이블로 적혀 있었으나 실제는 3개 분리)

```sql
id          INT       PK
user_id     INT       NOT NULL  INDEX
recipe_id   INT       NOT NULL  INDEX
created_at  DATETIME  NOT NULL
```

---

## 7. `coupang_clicks` — 쿠팡 링크 클릭 로그

```sql
id             BIGINT        PK
source         VARCHAR(20)   NOT NULL  INDEX   -- 'pill' | 'card_cta'
ingredient     VARCHAR(100)  NULL      INDEX   -- 어떤 재료를 눌렀는지
lacking_count  INT           NULL              -- 그 카드의 부족 재료 개수
recipe_id      INT           NULL
page           VARCHAR(120)  NULL              -- 어느 화면에서 눌렀는지
created_at     DATETIME      NOT NULL  INDEX
```

광고 배치를 감이 아니라 숫자로 판단하려고 추가했습니다.
`POST /api/track/coupang-click` 이 기록하며, 테이블이 없으면 자동 생성됩니다.
측정 실패가 구매 동선을 막지 않도록 어떤 예외에도 200 을 반환합니다.

---

## 8. YouTube 캐시 2종

```sql
-- youtube_channel_cache : 채널 URL -> 채널 ID
id           INT           PK
channel_url  VARCHAR(255)  UNIQUE
channel_id   VARCHAR(50)   NOT NULL
created_at   TIMESTAMP

-- youtube_channel_meta : 채널 ID -> 업로드 재생목록 ID
channel_id           VARCHAR(50)  PK
uploads_playlist_id  VARCHAR(50)
created_at           TIMESTAMP
```

둘 다 **YouTube Data API 쿼터(하루 10,000 units)를 아끼기 위한 캐시**입니다.
검색 API 는 호출당 100 units 라 매번 조회하면 금방 소진됩니다.
