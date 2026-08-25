# 🗄️ 데이터베이스 스키마

> **이 문서는 실제 운영 DB(Railway MySQL)에서 그대로 뽑아 정리한 것입니다.**
> 2026-08-26 기준. 예전 버전은 실제와 다른 설계안(username/password_hash/phone,
> `user_recipes` 단일 테이블 등)이 적혀 있어 전면 교체했습니다.
> 스키마를 바꾸면 이 문서도 함께 고쳐 주세요.

## 테이블 한눈에

| 테이블 | 행 수(2026-08-26) | 역할 |
|---|---|---|
| `recipes` | 44,509 | 크롤링한 레시피 본문·재료 |
| `users` | 6 | 계정 (소셜 + 일반) |
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
id           INT           PK
email        VARCHAR(255)  NOT NULL  INDEX
nickname     VARCHAR(255)  NOT NULL
provider     VARCHAR(50)   NOT NULL  INDEX   -- google / kakao / naver / local
provider_id  VARCHAR(255)  NOT NULL
password     VARCHAR(255)  NULL              -- provider='local' 일 때만 사용(해시)
deleted_at   DATETIME      NULL      INDEX   -- 소프트 삭제
created_at   DATETIME      NOT NULL
updated_at   DATETIME      NULL
UNIQUE KEY (email, provider)
```

- 탈퇴는 행 삭제가 아니라 `deleted_at` 을 채우는 **소프트 삭제**입니다.
  같은 이메일·제공자로 재가입하면 기존 행을 되살립니다.
- 네이버 로그인은 프로필 API 가 별명을 `9208****` 처럼 마스킹해서 주기 때문에,
  마스킹된 값이면 **이메일 로컬 파트**를 닉네임으로 씁니다.

---

## 3. `user_ingredients` — 내 냉장고

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

## 4. 레시피 액션 테이블 3종

`user_favorite_recipes` / `user_recorded_recipes` / `user_completed_recipes` 는
구조가 동일합니다. (예전 문서엔 `action_type` 을 가진 단일 테이블로 적혀 있었으나 실제는 3개 분리)

```sql
id          INT       PK
user_id     INT       NOT NULL  INDEX
recipe_id   INT       NOT NULL  INDEX
created_at  DATETIME  NOT NULL
```

---

## 5. `coupang_clicks` — 쿠팡 링크 클릭 로그

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

## 6. YouTube 캐시 2종

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
