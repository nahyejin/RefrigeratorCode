# 🍳 쿡매치 (CookMatch) 프로젝트 개요

## 📌 프로젝트 소개

**쿡매치(CookMatch)**는 사용자의 냉장고 재료를 기반으로 맞춤형 레시피를 추천하는 웹/모바일 애플리케이션입니다. 사용자가 보유한 재료를 입력하면, 해당 재료로 만들 수 있는 레시피를 자동으로 매칭하여 추천합니다.

---

## 🏗️ 시스템 아키텍처

### 전체 구조
```
┌─────────────────┐
│   Frontend      │  React + TypeScript + Vite
│   (Vercel)      │  PWA 지원
└────────┬────────┘
         │ REST API
┌────────▼────────┐
│   Backend       │  Flask (Python)
│   (Railway)     │  RESTful API
└────────┬────────┘
         │
┌────────▼────────┐
│   Database      │  MySQL (Railway)
│   (Railway)     │  레시피, 사용자 데이터
└─────────────────┘
```

### 기술 스택

#### Frontend
- **프레임워크**: React 19.1.0 + TypeScript
- **빌드 도구**: Vite 6.3.1
- **스타일링**: Tailwind CSS
- **라우팅**: React Router DOM 7.6.3
- **상태 관리**: React Context API
- **가상화**: react-window (대량 데이터 렌더링 최적화)
- **PWA**: Workbox (오프라인 지원)

#### Backend
- **프레임워크**: Flask (Python)
- **데이터베이스**: MySQL (PyMySQL)
- **인증**: JWT (PyJWT)
- **CORS**: flask-cors
- **배포**: Railway

#### 데이터 수집
- **크롤러**: Selenium, BeautifulSoup4
- **YouTube API**: Google API Python Client
- **데이터 소스**: 네이버 블로그, 네이버 인플루언서, YouTube

---

## 📁 프로젝트 구조

```
RefrigeratorCode/
├── frontend/                    # React 프론트엔드
│   ├── src/
│   │   ├── components/          # 재사용 가능한 UI 컴포넌트
│   │   │   ├── RecipeCard.tsx
│   │   │   ├── RecipeSortBar.tsx
│   │   │   ├── FilterModal.tsx
│   │   │   ├── IngredientPillGroup.tsx
│   │   │   └── ...
│   │   ├── pages/               # 페이지 컴포넌트
│   │   │   ├── RecipeList.tsx      # 냉장고 요리 메인
│   │   │   ├── MyFridge.tsx        # 내 냉장고 관리
│   │   │   ├── Popular.tsx         # 요즘 인기
│   │   │   ├── MyPage.tsx          # 마이페이지
│   │   │   └── ...
│   │   ├── utils/               # 유틸리티 함수
│   │   │   ├── recipeUtils.ts      # 레시피 매칭, 정렬
│   │   │   ├── recipeFilters.ts    # 필터링 로직
│   │   │   └── ingredientPillUtils.ts
│   │   ├── context/             # Context API
│   │   │   └── AuthContext.tsx     # 인증 상태 관리
│   │   └── routes/               # 라우팅
│   │       └── AppRouter.tsx
│   └── public/                  # 정적 파일
│       ├── Filter_Keywords.csv      # 필터 키워드 사전
│       ├── ingredient_profile_dict_with_substitutes.csv
│       └── ingredient_substitute_table.csv
│
├── backend/                     # Flask 백엔드
│   ├── app.py                   # 메인 Flask 애플리케이션
│   ├── run_dev.py               # 개발 서버 실행
│   └── run_prod.py              # 운영 서버 실행
│
├── crawler/                     # 데이터 수집 크롤러
│   ├── naver_blog_crawler.py       # 네이버 블로그 크롤러
│   ├── naver_influencer_crawler.py # 네이버 인플루언서 크롤러
│   ├── youtube_crawler.py          # YouTube 크롤러
│   └── database.py                 # DB 연결 관리
│
└── database/                    # 데이터베이스 스키마
    └── create_user_tables.sql
```

---

## 🎯 핵심 기능

### 1. 재료 기반 레시피 매칭
- **재료 입력**: 사용자가 보유한 재료를 냉동/냉장/실온으로 분류하여 입력
- **매칭률 계산**: 레시피에 필요한 재료와 보유 재료를 비교하여 매칭률(%) 계산
- **스마트 필터링**: 
  - 매칭률 범위 설정 (예: 30~100%)
  - 부족 재료 개수 제한 (최대 1~5개 부족)
  - 임박 재료 우선 활용 (유통기한/구매일 기준)

### 2. 고급 필터링 시스템
- **재료 매칭도 필터**: 매칭률 범위, 부족 재료 개수
- **임박 재료 필터**: 유통기한 임박 재료 우선 활용
- **키워드 필터**: 제목/본문에서 키워드 검색
- **카테고리 필터**: 효능, 영양분, 대상, TPO, 스타일
- **채널 필터**: 유튜브, 네이버 블로그, 네이버 인플루언서
- **포함/제외 재료**: 꼭 포함할 재료, 제외할 재료

### 3. 정렬 기능
- **재료 매칭률순**: 내 냉장고 재료와의 매칭률 높은 순
- **최신순**: 게시일 기준 최신순
- **좋아요순**: 좋아요 수 기준
- **댓글순**: 댓글 수 기준
- **조회수순**: 조회수 기준 (유튜브)
- **임박 재료 활용순**: 임박 재료가 많이 포함된 순

### 4. 사용자 인증 및 데이터 관리
- **소셜 로그인**: Google, Kakao, Naver
- **일반 회원가입/로그인**: 이메일 기반
- **재료 저장**: 
  - 로그인 사용자: MySQL DB 저장
  - 비로그인 사용자: localStorage 저장
  - 로그인 시 자동 동기화
- **레시피 기록**: 기록한 레시피, 완료한 레시피 저장

### 5. 재료 동의어 처리
- **동의어 사전**: `ingredient_profile_dict_with_substitutes.csv` 기반
- **자동 변환**: '계란' → '달걀' 등 동의어를 표준 키워드로 변환
- **통일된 표시**: 레시피 카드, 재료 pill에서 일관된 재료명 표시

### 6. 재료 대체 추천
- **대체 사전**: `ingredient_substitute_table.csv` 기반
- **스마트 추천**: 레시피에 필요한 재료가 없을 때 대체 가능한 재료 추천
- **유사도 점수**: 재료 간 유사도를 기반으로 추천

---

## 🗄️ 데이터베이스 구조

### 주요 테이블

> 전체 스키마는 `DATABASE_SCHEMA.md` 참고 (실제 DB에서 뽑아 정리).

#### 1. `recipes` - 레시피 데이터
- **수집 소스**: 네이버 블로그, 네이버 인플루언서, YouTube
- **주요 필드**:
  - `title`, `content`, `link`, `thumbnail`
  - `used_ingredients`: 레시피에 필요한 재료 목록 — **화면의 재료 pill 이 읽는 유일한 열**
  - `used_ingredients_block`, `block_reason`: 본문에서 잘라낸 재료 블록과 실패 사유
  - `llm_ingredients_done`: LLM 재료 추출 완료 깃발(0/1)
  - `platform`: 수집 출처
  - `likes`, `comments`, `hits`: 인기도 지표
  - `post_time`: 게시일

⚠️ **재료 열은 하나뿐입니다.** 룰베이스와 LLM 이 같은 `used_ingredients` 에 쓰므로,
두 작업 모두 `llm_ingredients_done = 0` 인 행만 대상으로 삼아야 합니다.
(이 조건이 빠지면 룰베이스가 LLM 결과를 덮어씁니다 — 실제로 있었던 버그)

#### 2. `users` - 사용자 정보
- **인증 방식**: 소셜 로그인, 일반 로그인
- **주요 필드**: `id`, `email`, `nickname`, `provider`

#### 3. `user_ingredients` - 사용자별 재료
- **보관 공간**: frozen(냉동), fridge(냉장), room(실온)
- **주요 필드**: `user_id`, `name`, `storage_box`, `expiry_date`, `purchase_date`, `saved_at`

#### 4. 레시피 액션 테이블 3종
- `user_favorite_recipes` (즐겨찾기) / `user_recorded_recipes` (기록) /
  `user_completed_recipes` (완료) — 구조 동일 (`user_id`, `recipe_id`, `created_at`)

#### 5. `coupang_clicks` - 쿠팡 링크 클릭 로그
- 광고 배치를 감이 아니라 숫자로 판단하기 위한 측정 테이블
- 기록 항목: 경로(`pill` / `card_cta`), 재료명, 부족 재료 개수, 레시피 id, 화면 경로

#### 6. YouTube 캐시 (`youtube_channel_cache`, `youtube_channel_meta`)
- YouTube Data API 쿼터(하루 10,000 units) 절약용 캐시

---

## 🔄 데이터 수집 시스템

### 크롤러 종류

#### 1. 네이버 블로그 크롤러
- **대상**: 네이버 블로그 > 주제별보기 > 요리/레시피
- **필터**: 본문에 재료 정보가 있는 포스트만 수집
- **재료 추출**: 본문에서 재료 정보 자동 추출

#### 2. 네이버 인플루언서 크롤러
- **대상**: 네이버 인플루언서 > 푸드 > 지금 핫한 토픽
- **필터**: 블로그 원문 제목에 레시피 키워드 포함
- **재료 추출**: 본문에서 재료 정보 자동 추출

#### 3. YouTube 크롤러
- **대상**: `YouTube_Cooking_influencer.csv`에 등록된 채널
- **필터**: 영상 설명에 재료 정보가 있는 영상만 수집
- **메타데이터**: 조회수, 좋아요, 댓글수 자동 업데이트
- **API 최적화**: 채널 ID 캐싱, 할당량 모니터링

### 재료 추출 파이프라인 (중요)

재료 추출은 **두 단계**이고, 서로 다른 주기로 돕니다.

| 단계 | 스크립트 | 주기 | 대상 |
|---|---|---|---|
| 룰베이스 | `ingredient_management/update_used_ingredients_batch.py` | 주간 크롤러에 포함 | `llm_ingredients_done = 0` |
| LLM | `ingredient_management/llm_ingredient_extraction.py` | **매일 새벽 3시 (별도 작업)** | `llm_ingredients_done = 0` |

- 룰베이스는 **신규 수집분의 임시 채움** 역할입니다. LLM 이 나중에 더 정확한 값으로 대체합니다.
- LLM 은 무료 티어 한도(하루 500회 호출) 안에서 **12건씩 묶어** 하루 약 5,400건 처리합니다.
  (기본값은 450회 — 챗봇과 키를 공유할 때를 대비해 여유를 둔 값)

> **⚠️ 한도는 API 키 단위입니다.**
> 재료 추출 배치와 챗봇이 같은 키를 쓰면 하루 500회를 나눠 쓰게 되고,
> 배치가 450회를 쓰면 챗봇 몫은 50회뿐입니다. 실제로 이게 소진돼
> 챗봇이 하루 종일 429(할당량 초과)로 응답하지 못한 일이 있었습니다.
> → `GEMINI_API_KEY_CHAT` 에 **별도 키**를 넣으면 챗봇만 그 키를 씁니다.
> 자세한 내용은 아래 "요리 챗봇" 절을 참고하세요.
- 처리 결과에 따른 분기
  - 정상 추출 → 값 덮어쓰기 + `done = 1`
  - 일시적 오류 → `done` 을 건드리지 않음 → 다음 실행에서 자동 재시도
  - LLM 결과만 비고 기존 값은 있음 → **기존 값 보존** + `done = 1`
  - 룰베이스도 LLM 도 둘 다 비어 있음 → **행 삭제** (레시피가 아닌 홍보성 본문으로 판단)

### 자동 실행 (Windows 작업 스케줄러)

| 작업 이름 | 주기 | 내용 |
|---|---|---|
| `CookMatch-WeeklyCrawler` | 매주 월요일 07:00 | 크롤링 + 룰베이스 재료 추출 |
| `CookMatch-DailyLLMIngredients` | 매일 03:00 | LLM 재료 추출 |

절전 상태면 깨워서 실행되지만(`WakeToRun`), **PC 가 완전히 꺼져 있으면 실행되지 않습니다.**

### 크롤러 실행
```bash
# 통합 실행 (권장)
python run_all_crawlers.py

# 개별 실행
python -m crawler.naver_blog_crawler
python -m crawler.naver_influencer_crawler
python -m crawler.youtube_crawler
```

---

## 🚀 배포 환경

### 현재 배포 상태
- **Frontend**: Vercel (`https://refrigerator-code.vercel.app`)
- **Backend**: Railway (`https://refrigeratorcode-production.up.railway.app`)
- **Database**: Railway MySQL

### 환경 분리
- **개발 환경**: `env.development` (localhost)
- **운영 환경**: `env.production` (실제 도메인)

---

## 📱 주요 페이지 및 기능

### 1. 내 냉장고 (`/my-fridge`)
- 재료 추가/삭제/수정
- 보관 공간별 분류 (냉동/냉장/실온)
- 유통기한/구매일 관리
- 저장 버튼 (로그인 사용자만)

### 2. 냉장고 요리 (`/recipe-list`)
- 재료 기반 레시피 추천
- 고급 필터링 (매칭률, 키워드, 카테고리 등)
- 다양한 정렬 옵션
- 가상화된 리스트 (성능 최적화)

### 3. 요즘 인기 (`/popular`)
- 인기 급상승 재료 TOP 10
- 인기 급상승 테마 TOP 10
- 재료/테마별 상세 페이지

### 4. 마이페이지 (`/my-page`)
- 내가 기록한 레시피
- 내가 완료한 레시피
- 프로필 관리

### 5. 레시피 상세 (`/recipe-detail/:id`)
- 레시피 상세 정보
- 재료 pill 표시 (보유/부족/대체 가능)
- 기록/완료 기능
- 공유 기능

---

## 💬 요리 챗봇 (`/api/chat`)

화면 우측 하단 노란 버튼으로 여는 대화형 추천 기능입니다.
구현은 `backend/chat_service.py` + `frontend/src/components/RecipeChatWidget.tsx`.

### 동작 순서

```
① 프론트 → 서버   : 최근 대화 10개 + 냉장고 재료 목록
② 서버 → Gemini   : "검색은 서버가 한다. 너는 검색에 쓸 낱말만 골라라"
③ Gemini → 서버   : { reply, keywords[], include/exclude_ingredients, ignore_fridge }
④ 서버 → MySQL    : 낱말 + 냉장고 재료로 검색 → 상위 8건
⑤ 서버 → 프론트   : ③의 답변 + ④의 레시피 카드
```

**LLM 은 레시피 본문을 읽지 않습니다.** 대화를 읽고 검색어만 고르고,
실제 검색은 서버가 MySQL 에서 합니다. 그래서 답변(reply)은 검색 결과가 나오기 전에
만들어지며, "이 레시피는 이래서 추천해요" 같은 말은 할 수 없습니다.

### 검색 규칙

| | 내용 |
|---|---|
| 관련도 | 낱말이 **제목**에 있으면 3점, **재료**에 있으면 2점, **본문**에 있으면 1점 |
| 걸러내기 | 낱말이 있으면 **관련도 0인 글은 제외** (필수 조건) |
| 정렬 | `관련도 × 10 + 냉장고 매칭률` 내림차순 |
| 본문 검색 | **첫 번째 낱말만** 본문까지 봄 (비용 문제, 아래 참고) |

- 예전에는 낱말이 `HAVING (매칭률 >= 25 OR 낱말일치)` 의 **OR 조건**이었고 정렬에는
  들어가지 않았습니다. 매칭률 25% 이상이 13,869건이라 사실상 전부 통과했고,
  결과적으로 **"매운 거" 라고 말하든 말든 결과가 거의 같았습니다.**
  (실측: 상위 8건 중 매운 것과 관련된 글이 1건)
- 지금은 관련도가 필수 조건이고 정렬에도 반영됩니다. (실측: 상위 8건 중 8건)

### 낱말 확장

LLM 이 낱말을 **1~5개** 뽑습니다. 사용자가 쓴 말 하나만으로는 같은 뜻의 다른 표현이
쓰인 글을 놓치기 때문입니다.

```
"매운 거 먹고 싶어" → ["매운", "매콤", "얼큰", "칼칼", "청양고추"]
```

`매운` 하나만 쓰면 `얼큰`(1,606건) `칼칼`(3,317건) `청양`(9,710건) 이 쓰인 글을
통째로 놓칩니다. **LLM 호출 수는 늘지 않습니다** — 한 번의 응답에서 배열로 받습니다.

### 속도

본문(`content`)은 평균 2,000자라 `LIKE` 비용이 큽니다.

| 방식 | 소요 |
|---|---|
| 낱말 5개를 전부 본문까지 | 4.93초 |
| 제목·재료만 (본문 제외) | 0.32초 |
| **현재: 첫 낱말만 본문까지** | **1.75~2.42초** |

> `ft_title_content` FULLTEXT 인덱스가 존재하지만 **ngram 파서 없이** 만들어져 있어
> 한국어에서는 쓸 수 없습니다. `MATCH ... AGAINST('매운')` 은 3건만 반환합니다
> (`LIKE` 는 5,207건). 인덱스를 ngram 으로 다시 만들면 0.09초까지 줄어들지만,
> 운영 DB 의 스키마 변경과 재색인이 필요해 아직 하지 않았습니다.

### 호출 한도

- 무료 티어: **하루 500회 / 분당 15회** (API 키 단위)
- 앱 자체 한도: `LLM_DAILY_LIMIT`(기본 250) — 서버 프로세스 안에서 세는 별도 카운터
- **키 분리 권장**: `GEMINI_API_KEY_CHAT` 을 설정하면 챗봇만 그 키를 씁니다.
  설정하지 않으면 `GEMINI_API_KEY` 를 재료 추출 배치와 함께 씁니다

## 🔧 핵심 알고리즘

### 재료 매칭률 계산
```typescript
매칭률 = (보유 재료 수 / 레시피 필요 재료 수) × 100
```

### 정렬 로직
1. **매칭률순**: 매칭률 높은 순 → 같으면 최신순
2. **임박 재료순**: 임박 재료 포함 개수 → 매칭률 → 최신순
3. **기타 정렬**: 각 지표 기준 내림차순

### 필터링 로직
- 모든 필터 조건은 **AND**로 결합
- 매칭률 범위와 부족 재료 개수는 **OR** 조건
- 임박 재료는 **AND/OR** 선택 가능

---

## 📊 데이터 사전

### 1. `Filter_Keywords.csv`
- 레시피 카테고리 키워드
- 효능, 영양분, 대상, TPO, 스타일 분류
- 키워드와 동의어 매핑

### 2. `ingredient_profile_dict_with_substitutes.csv`
- 재료 프로필 정보
- 동의어 매핑 (예: '계란' → '달걀')
- 대체재 정보

### 3. `ingredient_substitute_table.csv`
- 재료 대체 가능성 사전
- 유사도 점수
- 대체 사유

### 4. `YouTube_Cooking_influencer.csv`
- YouTube 요리 인플루언서 채널 목록
- 크롤러가 이 목록을 기반으로 영상 수집

---

## 🎨 UI/UX 특징

### 반응형 디자인
- 모바일 우선 설계
- 데스크톱 최적화
- PWA 지원 (오프라인 사용 가능)

### 성능 최적화
- **가상화**: `react-window`로 대량 데이터 렌더링 최적화
- **캐싱**: localStorage, sessionStorage 활용
- **지연 로딩**: React.lazy로 코드 스플리팅
- **이미지 최적화**: 프록시 서버 활용 (네이버 이미지)

### 사용자 가이드
- 초기 진입 시 가이드 오버레이
- 로그인 여부에 따라 다른 가이드 제공
- 단계별 안내

---

## 🔐 보안 및 인증

### 인증 방식
- **JWT 토큰**: 로그인 상태 유지
- **소셜 로그인**: OAuth 2.0 (Google, Kakao, Naver)
- **비밀번호 해싱**: werkzeug.security

### 데이터 보안
- **CORS 설정**: 명시적 도메인만 허용
- **환경변수**: 민감 정보는 환경변수로 관리
- **SQL Injection 방지**: 파라미터화된 쿼리

---

## 📈 성능 및 확장성

### 최적화 전략
- **백엔드 필터링**: 대량 데이터에서도 빠른 검색
- **DB 인덱스**: title, content 필드 인덱스
- **페이징**: 페이지별 데이터 로드
- **캐싱**: 동의어 사전, 재료 사전 캐싱

### 확장 가능성
- **크롤러 확장**: 새로운 데이터 소스 추가 용이
- **필터 확장**: 새로운 필터 조건 추가 가능
- **앱 출시**: PWA → React Native 전환 계획

---

## 🛠️ 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- Python 3.10+
- MySQL 8.0+

### 실행 방법
```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run_dev.py
```

---

## 📝 주요 문서

- `README.md`: 프로젝트 전체 가이드
- `DATABASE_SCHEMA.md`: 데이터베이스 스키마
- `DEVELOPMENT_GUIDE.md`: 개발 가이드
- `HOUSEHOLD_FEATURE.md`: 식구 그룹(다중 계정 공유) + 요리 캘린더 기능 동작 방식
- `CHATBOT_FEATURE.md`: AI 요리 챗봇 동작 방식 (프롬프트 설계, 검색 로직, 팔로우업 질문 처리, 재료 언급 우선순위)
- `MOBILE_APP_GUIDE.md`: 모바일 앱 출시 가이드
- `PERFORMANCE_OPTIMIZATION.md`: 성능 최적화 가이드

---

## 🎯 향후 계획

### 단기 (1-2개월)
- PWA 완성도 향상
- 사용자 피드백 수집
- 버그 수정 및 성능 개선

### 중기 (3-6개월)
- React Native 앱 개발
- 앱스토어 출시
- 마케팅 시작

### 장기 (6개월+)
- AI 기반 레시피 추천 강화
- 커뮤니티 기능 추가
- 수익 모델 구축

---

## 📞 기술 지원

프로젝트 관련 문의나 이슈는 GitHub Issues를 통해 제출해주세요.

---

**최종 업데이트**: 2025년 1월


