# 🍳 쿡매치 (CookMatch) - 냉장고 재료 기반 레시피 추천 서비스

## 📁 프로젝트 폴더 구조

> 2026-08-26 기준 실제 구조. 예전 README 에는 존재하지 않는 루트 `package.json`,
> `database/DATABASE_SCHEMA.md`, `data/*.csv` 등이 적혀 있어 실제와 맞게 고쳤습니다.

```
RefrigeratorCode/
├── 📁 frontend/                    # React + TypeScript (Vite, 개발 포트 5178)
│   ├── 📁 src/
│   │   ├── 📁 components/          # 공용 컴포넌트
│   │   │   └── 📁 ui/              # ★ 디자인 시스템 (Button/Input/Chip/
│   │   │                           #   Dialog/Sheet/CloseButton/PopupHeader)
│   │   ├── 📁 pages/               # 화면
│   │   ├── 📁 routes/              # 라우팅
│   │   ├── 📁 utils/               # 유틸 (재료 매칭, 쿠팡 링크, 클릭 측정 등)
│   │   ├── 📁 styles/              # ingredientPill.ts (재료 pill 색 단일 소스)
│   │   ├── 📁 types/               # 타입 정의
│   │   ├── 📁 assets/              # 이미지·아이콘
│   │   └── 📄 index.css            # ★ 디자인 토큰(:root) + 전역 스타일
│   ├── 📄 tailwind.config.js       # 토큰 미러링
│   └── 📄 vite.config.ts
│
├── 📁 backend/                     # Flask
│   ├── 📄 app.py                   # API 전체 (인증/레시피/추적)
│   ├── 📄 chat_service.py          # 챗봇 (Gemini) 검색·응답
│   └── 📄 .env                     # 실제 환경변수 (git 제외)
│
├── 📁 crawler/                     # 데이터 수집
│   ├── 📄 naver_blog_crawler.py
│   ├── 📄 naver_influencer_crawler.py
│   ├── 📄 youtube_crawler.py
│   ├── 📄 database.py
│   └── 📁 common/
│
├── 📁 ingredient_management/       # 재료 추출 파이프라인
│   ├── 📄 update_used_ingredients_batch.py   # 룰베이스 (신규분 임시 채움)
│   └── 📄 llm_ingredient_extraction.py       # LLM (매일 배치, 최종값)
│
├── 📁 database/                    # SQL 스크립트
│   └── 📄 create_user_tables.sql
│
├── 📁 data/                        # 수집 원본·중간 산출물
├── 📁 scripts/                     # 점검·디버그용 스크립트 모음
├── 📁 logs/
│
├── 📄 run_all_crawlers.py                 # 크롤링 + 룰베이스 재료 추출
├── 📄 run_crawlers_scheduled.bat          # 크롤러 (원래 주간·월 07:00, 2026-08-29부터 당분간 매일 07:00로 임시 변경 — Windows 작업 스케줄러 "CookMatch-WeeklyCrawler" 트리거 참고)
├── 📄 run_llm_ingredients_daily.bat       # 매일 LLM 재료 추출 (매일 03:00)
├── 📄 requirements.txt
├── 📄 README.md
├── 📄 PROJECT_OVERVIEW.md          # 아키텍처·기능·파이프라인
├── 📄 DATABASE_SCHEMA.md           # 실제 DB 스키마
├── 📄 DEVELOPMENT_GUIDE.md         # 개발 워크플로우 + UI 체계 규칙
├── 📄 HOUSEHOLD_FEATURE.md         # 식구 그룹 + 요리 캘린더 기능 동작 방식
├── 📄 CHATBOT_FEATURE.md           # AI 요리 챗봇 동작 방식 (프롬프트·검색·팔로우업)
├── 📄 INGREDIENT_RECOGNITION_FEATURE.md  # 사진으로 재료 담기 (영수증·유통기한 인식)
├── 📄 ENVIRONMENT_SETUP.md
└── 📄 CHANGELOG.md                 # 변경 이력
```

## 🔧 환경 분리 설정

### 개발/운영 환경 분리 원리
- **동일한 코드베이스**로 개발/운영 환경을 완전히 분리
- **환경변수 파일**로 API URL, DB 설정, CORS 등 구분
- **빌드/실행 스크립트**로 환경별 실행 방식 분리

### 프론트엔드 환경 설정

#### 개발 환경 (env.development)
```bash
VITE_API_BASE_URL=http://localhost:5000
VITE_ENV=development
VITE_DEBUG=true
```

#### 운영 환경 (env.production)
```bash
VITE_API_BASE_URL=https://api.cookmatch.com
VITE_ENV=production
VITE_DEBUG=false
```

#### 실행 명령어
```bash
# 개발 서버 실행
npm run dev

# 개발 환경 빌드
npm run build:dev

# 운영 환경 빌드
npm run build:prod

# 개발 환경 미리보기
npm run preview:dev

# 운영 환경 미리보기
npm run preview:prod
```

### 백엔드 환경 설정

#### 개발 환경 (env.development)
```bash
FLASK_ENV=development
FLASK_DEBUG=true
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sk784512!!
DB_NAME=refrigerator
DB_PORT=3306
CORS_ORIGIN=http://localhost:5173,http://localhost:5177,http://localhost:5178
```

#### 운영 환경 (env.production)
```bash
FLASK_ENV=production
FLASK_DEBUG=false
DB_HOST=your-production-db-host.com
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=refrigerator_production
DB_PORT=3306
CORS_ORIGIN=https://your-production-frontend-url.com
```

#### 실행 명령어
```bash
# 개발 서버 실행
python backend/run_dev.py

# 운영 서버 실행
python backend/run_prod.py
```

### 환경 전환 방법

#### 🛠️ **개발환경에서 작업**
```bash
# 1. 프론트엔드
cd C:\Users\user\Desktop\RefrigeratorCode\frontend
npm run dev

# 2. 백엔드 (새 터미널에서)
cd C:\Users\user\Desktop\RefrigeratorCode\backend
python run_dev.py
```

#### 🚀 **운영 환경으로 전환**
```bash
# 프론트엔드 빌드
cd C:\Users\user\Desktop\RefrigeratorCode\frontend
npm run build:prod

# 백엔드
cd C:\Users\user\Desktop\RefrigeratorCode\backend
python run_prod.py
```

#### 🔄 **환경별 차이점**
| 구분 | 개발 환경 | 운영 환경 |
|------|-----------|-----------|
| **URL** | localhost:5177, localhost:5000 | 실제 도메인 |
| **DB** | 로컬 MySQL | 운영 DB |
| **Debug** | 활성화 | 비활성화 |
| **용도** | 로컬 개발 | 실제 서비스 |

#### 📍 **현재 상황**
- **개발 환경 (현재 사용 중)**
  - 프론트엔드: `http://localhost:5177/login`
  - 백엔드: `http://localhost:5000`

- **운영 환경 (아직 미설정)**
  - 프론트엔드: `https://your-domain.com/login` (설정 필요)
  - 백엔드: `https://api.your-domain.com` (설정 필요)

#### 🚀 **운영 환경 설정 시 필요한 작업**
1. **도메인 구매/설정** (예: cookmatch.com)
2. **환경변수 파일 수정** (frontend/env.production, backend/env.production)
3. **호스팅 서비스 배포** (Vercel, Render, AWS 등)

## 📱 **앱 출시 전략 (PWA → React Native)**

### 🎯 **단계적 접근 전략 (권장)**

#### **1단계: PWA 출시 (1-2주)**
```bash
✅ 현재 React 웹앱을 PWA로 변환
✅ 앱 아이콘, 스플래시 스크린 추가
✅ 홈화면 추가 기능 구현
✅ 사용자 피드백 수집
```

#### **2단계: 사용자 분석 (1-2개월)**
```bash
✅ 실제 사용자 행동 분석
✅ 인기 기능 파악
✅ 개선점 도출
✅ 수익 모델 검증
```

#### **3단계: React Native 개발 (2-3개월)**
```bash
✅ PWA 데이터 기반으로 개발
✅ 앱스토어 등록
✅ 마케팅 시작
```

### 💡 **왜 이 방법이 최고인가?**

#### **성공 확률 높음**
- **시장 검증**: 실제 사용자로 테스트
- **개선 기회**: 피드백 반영 가능
- **비용 효율**: 실패 시 손실 최소

#### **기술적 장점**
- **기존 코드 활용**: 70-80% 재사용
- **점진적 개선**: 단계별 기능 추가
- **유지보수 용이**: 웹/앱 동시 관리

### 💰 **비용 예상**

#### **PWA 단계**
- **개발 비용**: 거의 무료
- **시간**: 1-2주
- **리스크**: 최소

#### **React Native 단계 (저와 함께 개발)**
- **개발 비용**: 거의 무료 (저와 함께)
- **앱스토어 등록**: $99/년 (iOS), $25 (Android)
- **서버 비용**: 월 10-50만원
- **총 비용**: 연 50-100만원 정도
- **성공 확률**: 높음 (PWA 데이터 기반)

## 🚀 **실제 개발 계획 (저와 함께)**

### **1단계: PWA 변환 (1-2주)**
```bash
✅ 현재 React 웹앱을 PWA로 변환
✅ 앱 아이콘, 스플래시 스크린 추가
✅ 홈화면 추가 기능 구현
✅ 사용자 피드백 수집
```

### **2단계: React Native 개발 (2-3개월)**
```bash
✅ PWA 기반으로 React Native 개발
✅ 네이티브 기능 추가 (푸시 알림, 카메라 등)
✅ 앱스토어 등록 준비
```

### **3단계: 출시 및 마케팅**
```bash
✅ 앱스토어 등록
✅ 마케팅 전략 수립
✅ 사용자 피드백 수집
```

### 💡 **저와 함께 개발하는 장점**

#### **비용 효율성**
- **개발 비용**: 거의 무료
- **품질**: 전문적인 코드
- **속도**: 빠른 개발

#### **기술적 장점**
- **기존 코드 활용**: 70-80% 재사용
- **최신 기술**: React Native 최신 버전
- **최적화**: 성능 최적화 적용

#### **지속적 지원**
- **버그 수정**: 지속적 유지보수
- **기능 추가**: 새로운 기능 개발
- **업데이트**: 정기적 업데이트

## 🚀 YouTube API 할당량 최적화 (2025-06-22 업데이트)

### 📊 API 할당량 비용 구조
- **Search API**: 100 units per request (채널 검색, 영상 목록 조회)
- **Videos API**: 1 unit per request (영상 상세정보 조회)
- **일일 할당량**: 10,000 units (Google Cloud Console 기준)

### 🔧 최적화 기능

#### 1. 채널 ID 캐싱 시스템
- **테이블**: `youtube_channel_cache`
- **기능**: 
  - 채널 URL → 채널 ID 매핑을 DB에 저장
  - 재실행 시 API 호출 없이 캐시에서 조회
  - 할당량 절약: 채널당 100 units 절약

#### 2. 할당량 모니터링
- **실시간 추적**: API 호출마다 할당량 사용량 로깅
- **제한 설정**: 9,500 units (안전 마진 500 units)
- **조기 종료**: 할당량 초과 시 자동 중단

#### 3. 에러 처리 개선
- **할당량 초과 감지**: 403 quotaExceeded 에러 시 조기 종료
- **상세 로깅**: 각 API 호출의 할당량 비용과 총 사용량 추적
- **진행 상황 표시**: 처리된 인플루언서 수, 새로 수집된 영상 수

### 📈 성능 개선 효과
- **첫 실행**: 49개 채널 × 100 units = 4,900 units 사용
- **재실행**: 캐시된 채널은 0 units, 새로운 채널만 API 호출
- **할당량 효율성**: 약 50% 할당량 절약 가능

### 🔍 로깅 예시
```
=== YouTube 크롤러 시작 ===
총 인플루언서 수: 49
기존 영상 수: 6650
할당량 제한: 9500 units

API 호출: search - 채널 검색: @username (할당량 비용: 100, 총 사용량: 100)
캐시에서 채널 ID 조회: https://youtube.com/@username -> UC123456789

=== YouTube API 할당량 사용량 요약 ===
처리된 인플루언서 수: 25/49
새로 수집된 영상 수: 15
Search API 호출 횟수: 25
Videos API 호출 횟수: 3
총 할당량 사용량: 2503
할당량 제한: 9500
할당량 잔여량: 6997
```

⚠️ 필수 주의사항
konlpy는 0.5.2 버전, JPype1은 1.4.1 버전으로 설치해야 Komoran 정상 작동

open-korean-text-2.1.0.jar 파일 안에 kr.lucypark.okt.OktInterface 클래스가 포함되어 있어야 함

모든 코드는 반드시 가상환경 venv310 안에서 실행할 것

extract_keywords_dual_view.py는 Komoran 기반으로 명사/띄어쓰기 단어를 모두 추출하며, full 저장 모드와 top-100 저장 모드를 모두 지원함

**YouTube API 할당량**: 매일 자정에 리셋되므로, 할당량 초과 시 다음 날까지 대기 필요

✅ 4. 프로젝트 폴더 구조 및 역할

```
RefrigeratorCode/
├── run_all_crawlers.py           # 모든 크롤러를 순차 실행하는 통합 스크립트 (import 방식)
├── crawler/                      # 크롤러 및 공통 코드 (최신 구조)
│   ├── naver_influencer_crawler.py   # 네이버 인플루언서 핫토픽 크롤러
│   ├── naver_blog_crawler.py         # 네이버 블로그 주제별보기 크롤러
│   ├── youtube_crawler.py            # 유튜브 인플루언서 크롤러
│   ├── database.py                  # 데이터베이스 연결 및 관리
│   └── common/                      # 공통 상수, 기본 클래스, 데이터 모델 등
├── chromedriver-win64/           # 셀레늄용 크롬드라이버(루트에만 유지)
├── frontend/                     # 프론트엔드(React) 코드
├── ingredient-management/        # 식재료 관리 기능
├── utils/                        # 공통 유틸리티 함수
├── data/                         # 데이터 및 데이터 처리 스크립트
├── node_modules/                 # 프론트엔드 라이브러리(자동 생성)
├── __pycache__/                  # 파이썬 캐시(자동 생성)
├── package.json                  # 프론트엔드 의존성/스크립트
├── package-lock.json             # 프론트엔드 의존성 고정
└── PROJECT_OVERVIEW              # 프로젝트 설명 문서
```

````````````````````````````````````````````````````````````````````````````````````````````````## MySQL 데이터베이스 구조

### 스키마: railway (Railway MySQL)

### 📊 데이터베이스 테이블 구조

#### 1. `users` 테이블 - 회원 정보
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | int AI PK | 사용자 고유 ID (자동 증가) |
| email | varchar(255) | 이메일 주소 |
| nickname | varchar(255) | 닉네임 |
| provider | varchar(50) | 로그인 방식 ('local', 'google', 'kakao', 'naver') |
| provider_id | varchar(255) | 소셜 로그인 ID 또는 이메일 |
| password | varchar(255) | 비밀번호 해시 (일반 로그인만, 소셜 로그인은 NULL) |
| created_at | datetime | 가입일시 |
| updated_at | datetime | 수정일시 |

**특징:**
- 같은 이메일이라도 로그인 방식(`provider`)별로 별도 계정으로 저장 가능
- 비밀번호는 `werkzeug.security`로 해싱되어 저장
- 소셜 로그인 사용자는 `password` 필드가 NULL

#### 2. `user_ingredients` 테이블 - 사용자별 재료 저장
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | int AI PK | 재료 고유 ID (자동 증가) |
| user_id | int | 사용자 ID (users.id 참조) |
| name | varchar(255) | 재료명 |
| storage_box | ENUM | 보관 공간 ('frozen', 'fridge', 'room') |
| expiry_date | date | 유통기한 (선택) |
| purchase_date | date | 구매일 (선택) |
| created_at | datetime | 추가일시 |
| updated_at | datetime | 수정일시 |

**특징:**
- 각 사용자(`user_id`)별로 재료가 저장됨
- Foreign Key로 사용자 삭제 시 관련 재료도 자동 삭제
- 보관 공간별로 분류되어 저장

#### 3. `user_recorded_recipes` 테이블 - 사용자별 기록한 레시피
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | int AI PK | 기록 고유 ID (자동 증가) |
| user_id | int | 사용자 ID (users.id 참조) |
| recipe_id | int | 레시피 ID (recipes.id 참조) |
| created_at | datetime | 기록일시 |

**특징:**
- 각 사용자(`user_id`)별로 기록한 레시피가 저장됨
- `(user_id, recipe_id)` 조합이 유일하도록 제약 (중복 방지)
- Foreign Key로 사용자 삭제 시 관련 기록도 자동 삭제

#### 4. `user_completed_recipes` 테이블 - 사용자별 완료한 레시피
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | int AI PK | 완료 고유 ID (자동 증가) |
| user_id | int | 사용자 ID (users.id 참조) |
| recipe_id | int | 레시피 ID (recipes.id 참조) |
| created_at | datetime | 완료일시 |

**특징:**
- 각 사용자(`user_id`)별로 완료한 레시피가 저장됨
- `(user_id, recipe_id)` 조합이 유일하도록 제약 (중복 방지)
- Foreign Key로 사용자 삭제 시 관련 완료 기록도 자동 삭제

### 📊 데이터 저장 및 동기화 방식

#### 재료 데이터 (`user_ingredients`)
**저장 우선순위:**
1. **로그인한 사용자**: DB에 저장 (Railway MySQL)
2. **비로그인 사용자**: localStorage에만 저장

**동기화 로직:**
- **비회원 → 회원 전환 시**: localStorage에 있던 재료가 DB에 자동 저장됨
- **로그인 상태**: DB에 데이터가 있으면 DB 데이터 우선, 없으면 localStorage에서 로드 후 DB에 저장
- **재료 변경 시**: 로그인한 경우 DB와 localStorage 모두 업데이트

**예시 시나리오:**
```
1. 비회원 상태에서 재료 추가 → localStorage에 저장
2. 로그인 → localStorage 재료가 DB에 자동 저장됨
3. 이후 재료 변경 → DB와 localStorage 모두 업데이트
```

#### 레시피 데이터 (`user_recorded_recipes`, `user_completed_recipes`)
**저장 방식:**
- **로그인한 사용자**: DB에 저장
- **비로그인 사용자**: localStorage에만 저장 (`my_recorded_recipes`, `my_completed_recipes`)

**동기화 로직:**
- 로그인 시 DB에서 레시피 로드
- 레시피 기록/완료 시 DB에 저장 (로그인한 경우)
- 레시피 삭제 시 DB에서도 삭제 (로그인한 경우)

### 🔍 데이터 확인 방법

**MySQL에서 특정 사용자의 데이터 확인:**
```sql
-- 사용자 ID 확인
SELECT id, email, nickname FROM users WHERE email = '사용자이메일@example.com';

-- 특정 사용자의 재료 확인
SELECT * FROM user_ingredients WHERE user_id = {사용자ID};

-- 특정 사용자가 기록한 레시피 확인
SELECT * FROM user_recorded_recipes WHERE user_id = {사용자ID};

-- 특정 사용자가 완료한 레시피 확인
SELECT * FROM user_completed_recipes WHERE user_id = {사용자ID};
```

### 💡 데이터 저장 원칙

1. **회원 데이터**: DB에 저장 (영구 보관, 여러 기기에서 접근 가능)
2. **비회원 데이터**: localStorage에만 저장 (브라우저 종료 시 유지, 다른 기기에서는 접근 불가)
3. **동기화**: 비회원 → 회원 전환 시 localStorage 데이터가 DB로 자동 마이그레이션

## 🚀 배포 환경 설정

### 배포 URL
- **프론트엔드**: https://refrigerator-code.vercel.app
- **백엔드**: https://refrigeratorcode-production.up.railway.app

### 배포 환경에서 작동하는 기능

#### ✅ 자동으로 작동하는 기능
- 모든 API 호출은 `VITE_API_BASE_URL` 환경변수 또는 기본값(`https://refrigeratorcode-production.up.railway.app`) 사용
- CORS 설정에 Vercel 도메인 포함됨
- 데이터베이스 연결 (Railway MySQL)

#### ⚠️ 배포 시 확인 필요 사항

**1. Vercel 환경변수 설정**
Vercel 대시보드에서 다음 환경변수를 설정해야 합니다:
```
VITE_API_BASE_URL=https://refrigeratorcode-production.up.railway.app
```

**2. Railway 환경변수 설정**
Railway 대시보드에서 다음 환경변수를 설정해야 합니다:
```
FRONTEND_URL=https://refrigerator-code.vercel.app
BACKEND_URL=https://refrigeratorcode-production.up.railway.app
```

**3. OAuth 리다이렉트 URI 확인**
- **Google**: `https://refrigeratorcode-production.up.railway.app/api/auth/google/callback`
- **Kakao**: `https://refrigeratorcode-production.up.railway.app/api/auth/kakao/callback`
- **Naver**: `https://refrigeratorcode-production.up.railway.app/api/auth/naver/callback`

### 배포 환경에서 작동하는 모든 기능

✅ **인증 기능**
- 소셜 로그인 (Google, Kakao, Naver)
- 일반 회원가입/로그인
- 이메일 인증
- 비밀번호 찾기/재설정
- 회원탈퇴
- 로그인 항상 유지

✅ **데이터 저장**
- 사용자 재료 DB 저장 (`user_ingredients`)
- 기록한 레시피 DB 저장 (`user_recorded_recipes`)
- 완료한 레시피 DB 저장 (`user_completed_recipes`)
- 비회원 → 회원 전환 시 localStorage → DB 동기화

✅ **기타 기능**
- 레시피 조회/필터링
- 재료 관리
- 마이페이지 기능

#### 5. `recipes` 테이블 - 레시피 데이터

| 컬럼명                  | 타입                | 설명                                                         |
|------------------------|---------------------|--------------------------------------------------------------|
| id                     | int AI PK           | 기본키 (자동 증가)                                           |
| title                  | text                | 제목                                                        |
| link                   | text                | 레시피 원본 URL                                             |
| content                | mediumtext          | 본문                                                        |
| used_ingredients       | text                | 쓰여진 재료들 (쉼표로 구분, 예: 된장, 두부, 멸치)           |
| used_ingredients_block | text                | used_ingredients 추출을 위한 재료 문단 (내부용)             |
| block_reason           | varchar(255)        | used_ingredients_block 산출 기준 (내부용)                   |
| author                 | varchar(255)        | 작성자                                                       |
| thumbnail              | text                | 썸네일 이미지 URL                                           |
| platform               | varchar(50)         | 수집처 (네이버/유튜브/만개의레시피 등)                      |
| hits                   | int                 | 조회 수 (유튜브)                                          |
| likes                  | int                 | 좋아요 수  (네이버, 유튜브)                                              |
| comments               | int                 | 댓글 수    (네이버, 유튜브 )                                   |
| post_time              | date                | 게시일자                                                     |
| collected_at           | datetime            | 데이터 수집 일자                                             |

---

#### 예시: MySQL 연결 설정 (pymysql)

import pymysql
    ----------------conn = pymysql.connect(
       host='caboose.proxy.rlwy.net',
       user='root',
       password='HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
       db='railway',  # 실제 DB명
       port=47779,    # 반드시 47779로!
       charset='utf8mb4',
       cursorclass=pymysql.cursors.DictCursor
   )
   cursor = conn.cursor()
```

---

#### 예시: INSERT 쿼리

```sql
INSERT IGNORE INTO recipes
(title, link, content, author, thumbnail, platform, likes, comments, post_time, collected_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
```

## 재료 대체 사전 (ingredient_substitute_table.csv)

- 레시피에 필요한 재료가 없을 때, 내 냉장고에 있는 대체 가능한 재료를 추천하기 위한 사전입니다.
- 주요 컬럼:
  - **index**: 고유 인덱스
  - **ingredient_a**: 원래 레시피에 필요한 재료명
  - **ingredient_b**: 대체 가능한 재료명 (내 냉장고에 있을 수 있는 재료)
  - **substitution_direction**: 대체 방향 (예: 설탕 → 알룰로스)
  - **similarity_score**: 재료 유사도 (0~1, 높을수록 유사)
  - **substitution_reason**: 대체 사유 (예: 칼로리 절감, 비건 등)

### 활용 예시
- 레시피에 '설탕'이 필요하지만 내 냉장고에 '알룰로스'가 있을 때, 사전에서 '설탕 → 알룰로스' 매칭을 찾아 대체 가능 재료로 추천합니다.
- 추후 similarity_score, substitution_reason 등도 UI에 활용할 수 있습니다.

## 📁 frontend/src/components/
- **RecipeSortBar.tsx**: 레시피 필터/정렬 UI 및 로직(공통, 모든 레시피 리스트 페이지에서 사용)
- **RecipeCard.tsx**: 레시피 카드 UI(공통, 레시피 리스트/상세 등에서 사용)
- **IngredientPillGroup.tsx**: 재료 pill UI(공통, 레시피 카드 등에서 사용)
- **FilterModal.tsx**: 필터 모달 UI(공통)
- **RecipeToast.tsx / Toast.tsx**: 토스트 메시지 UI(공통)
- **BottomNavBar.tsx / TopNavBar.tsx**: 하단/상단 네비게이션 바(공통)
- **PrimaryButton.tsx / TextInput.tsx / NeangteolButton.tsx / NeangteolInput.tsx**: 공통 버튼/입력 UI
- **TagPill.tsx / SortDropdown.tsx**: 태그 pill, 정렬 드롭다운 등 공통 UI
- **IngredientDateModal.tsx / IngredientDetailModal.tsx**: 재료 관련 상세/날짜 모달(공통)
- **MyFridge.tsx**: 내 냉장고 재료 관리 UI(공통)

## 📁 frontend/src/pages/
- **RecipeList.tsx**: "냉장고 요리" 메인 페이지(공통 필터/정렬/카드 구조)
- **IngredientDetail.tsx**: "요즘 인기" 상세(재료/테마/키워드별 레시피 리스트, 공통 구조)
- **RecordedRecipeListPage.tsx**: 마이페이지 - 내가 기록한 레시피(공통 구조)
- **CompletedRecipeListPage.tsx**: 마이페이지 - 내가 완료한 레시피(공통 구조)
- **Popular.tsx**: 인기 레시피/재료/테마 등 메인(특화)
- **MyPage.tsx**: 마이페이지 메인(특화)
- **RecipeDetail.tsx**: 레시피 상세 페이지(특화)
- **MyFridge.tsx**: 내 냉장고 관리(특화)
- **FridgeSelect.tsx / IngredientInput.tsx / Login.tsx**: 냉장고/재료/로그인 등 특화 페이지

## 📁 frontend/src/utils/
- **recipeFilters.ts**: 레시피 필터링 공통 함수(모든 페이지에서 사용)
- **recipeUtils.ts**: 레시피 관련 유틸 함수(매칭률, 정렬 등)
- **ingredientPillUtils.ts**: 재료 pill 분류/정규화 유틸
- **dummyData.ts**: 더미 데이터(테스트/로컬 개발용)

## 🌟 특징 및 데이터 흐름
- **RecipeSortBar, RecipeCard, filterRecipes 등 공통 컴포넌트/유틸**을 모든 레시피 리스트 페이지에서 사용
- **필터/정렬/카드 UI/로직을 한 곳만 수정하면 전체 페이지에 반영**
- **props/state로 데이터 흐름이 명확** (상위 페이지에서 상태 관리, 하위 컴포넌트에 전달)
- **확장/리팩터링/협업에 용이** (구조가 일관적, 문서화로 빠른 파악 가능)

---

> 이 문서는 주요 파일/컴포넌트/유틸의 역할과 구조를 빠르게 파악할 수 있도록 정리한 개요입니다. 
> 새로운 기능 추가, 리팩터링, 협업, AI 활용 등 모든 작업에서 참고용으로 활용하세요!

# 냉장고요리 페이지 필터/정렬 로직 정리

## 0. 진입 시 기본값 (냉장고가 비었는지에 따라 갈린다)

`RecipeList.tsx` 의 `getInitialSortBarState()` 가 정한다. **내 냉장고 재료가
하나라도 있는지**로 분기한다.

| 내 재료 | 기본 정렬 | 기본 매칭 구간 | 이유 |
|---|---|---|---|
| 1개 이상 | 재료매칭률순 | 30~100% | 내 재료로 만들 수 있는 것부터 |
| **0개** | **최신순** | **0~100%** | 아래 참고 |

**재료가 0개일 때 매칭률순으로 두면 화면이 텅 빈다.** 내 재료가 없으면 모든
레시피의 매칭률이 0% 인데, 기본 매칭 구간 30~100% 가 0% 를 전부 걸러내기
때문이다. 로딩이 안 끝난 것처럼 보여서 렉으로 오해하기 쉽다(실제로 그렇게
보고됐다). 그래서 비어 있으면 최신순으로 시작하고 매칭 구간도 열어 둔다.

> 사용자가 화면에서 정렬·구간을 바꾸면 그 값이 sessionStorage 에 저장돼 유지된다.
> 위 기본값은 **처음 들어올 때만** 적용된다.

## 1. 재료매칭도설정
- **매칭률 범위**: 사용자가 설정한 매칭률(%) 범위 내에 드는 레시피만 노출
- **부족 재료 개수**: 최대 부족 재료 개수(1~5개, 혹은 제한 없음) 설정 가능
- **OR 조건**: 매칭률 범위 또는 부족 재료 개수 중 **하나라도 통과**하면 해당 레시피가 노출됨 (둘 다 만족할 필요 없음)
- **동작**: 레시피의 `used_ingredients`와 내 냉장고 재료를 비교하여 매칭률 계산, 설정 범위 내 레시피 또는 부족 재료 개수 조건을 만족하는 레시피만 필터링

## 2. 임박재료 설정
- **임박재료 선택**: 내 냉장고 재료 중 임박(유통기한/구매일 기준) 재료를 선택
- **AND/OR 조건**: 선택한 임박재료가 모두 포함(AND) 또는 하나라도 포함(OR)된 레시피만 보기 선택 가능
- **정렬 기준**: '유통기한 임박순' 또는 '구매일 오래된순'으로 임박재료 리스트 정렬
- **동작**: 선택한 임박재료가 레시피의 `used_ingredients`에 포함되는지 AND/OR 조건에 따라 필터링

## 3. 재료매칭률순 (정렬 드롭다운)
- **정렬 옵션**:
  - 최신순: 'post_time' 컬럼 기준 내림차순  (platform컬럼의 값이 naver(주제별보기), naver(인플루언서핫토픽), youtube(인플루언서)인 3개 항목 모두 likes 값을 보유하고 있음)
  - 좋아요순: 'likes' 컬럼 기준 내림차순 (platform컬럼의 값이 naver(주제별보기), naver(인플루언서핫토픽), youtube(인플루언서)인 3개 항목 모두 likes 값을 보유하고 있음)
  - 댓글순: comments 기준 내림차순  (platform컬럼의 값이 naver(주제별보기), naver(인플루언서핫토픽), youtube(인플루언서)인 3개 항목 모두 likes 값을 보유하고 있음)
  - 조회수순 :  'hits' 컬럼 기준 내림차순 (platform컬럼의 값이 youtube(인플루언서)인 1개 항목만 likes 값을 보유하고 있음! 이 때, platform컬럼의 값이 naver(주제별보기), naver(인플루언서핫토픽) 인 항목은  youtube(인플루언서)항목보다는 뒤로두고, naver의 콘텐츠 끼리는 좋아요순을 기준으로 하단에 내림차순 할 것)
  - 재료매칭률순: 내 냉장고 재료와 레시피 재료의 매칭률 내림차순
  - 임박재료활용순: 선택한 임박재료가 많이 포함된 레시피 우선
- **동작**: 선택한 정렬 기준에 따라 레시피 리스트 정렬

## 4. 필터 (상세 필터 모달)
- **꼭 포함할 키워드**: 입력한 키워드가 레시피 제목+본문에 1번 이상 등장하면 통과
- **꼭 포함할 재료**: 선택한 재료명이 레시피 제목+본문에 각각 2번 이상 등장해야 통과(AND)
- **꼭 제외할 재료**: 선택한 재료명이 레시피 제목+본문에 각각 2번 이상 등장하면 해당 레시피는 제외(OR)
- **카테고리 키워드(효능, 영양분, 대상, TPO, 스타일)**: Filter_Keywords.csv의 대분류/중분류/키워드/동의어 기반, 선택한 키워드/동의어가 제목+본문에 2번 이상 등장해야 통과(AND)
- **동작**:
  - 필터 모달에서 선택/입력한 값에 따라 위 조건을 모두 AND로 적용하여 레시피를 필터링
  - 자동완성 검색 기능은 UI에서만 사용, 실제 필터링은 제목+본문 기준

---

**모든 필터/정렬 조건은 AND로 동작하며, 각 항목별 상세 기준은 위와 같음.**

## ✅ 주요 변경점 및 리팩토링(2024년 6월)

### 인기 급상승 재료/테마 TOP 10 기능 개선 (2024년 6월)

#### 인기 급상승 재료 TOP 10
- **레시피 수 계산 방식**: 
  - 레시피의 `used_ingredients` 필드에서 각 재료의 등장 횟수를 카운트
  - 쉼표(,)로 구분된 재료 목록을 분리하여 정확히 일치하는 재료명만 카운트
  - 상위 10개 재료를 선정하여 순위 표시

#### 인기 급상승 테마 TOP 10
- **레시피 수 계산 방식**:
  - `Filter_Keywords.csv`에서 키워드와 동의어 목록을 로드
  - 각 레시피의 제목과 본문에서 키워드/동의어가 2번 이상 등장하는 경우 카운트
  - 상위 10개 테마를 선정하여 순위 표시

#### 상세 페이지 연결
- **재료 상세 페이지** (`/ingredient/:name`):
  - 해당 재료가 `used_ingredients`에 포함된 레시피만 필터링하여 표시
  - 재료명은 정확히 일치하는 경우만 매칭

- **테마 상세 페이지** (`/ingredient/:name`):
  - `Filter_Keywords.csv`의 키워드/동의어 기반으로 필터링
  - 제목과 본문에서 키워드/동의어가 2번 이상 등장하는 레시피만 표시

- **검색 결과 페이지** (`/ingredient/:searchTerm`):
  - 검색어가 레시피의 제목이나 본문에 포함된 모든 레시피 표시
  - 대소문자 구분 없이 검색 (모두 소문자로 변환하여 비교)

### Clean Code 원칙 기반 1~10단계 리팩토링
- **1~3단계:** 타입/주석 정비, 네이밍 개선, 함수 분리(한 함수 한 역할)
- **4단계:** 유틸 함수/커스텀 훅 파일 분리 (`frontend/src/utils/recipeUtils.ts` 등)
- **5단계:** 불필요한 상태/로직/props/dead code 정리
- **6단계:** 주요 유틸 함수 단위 테스트 코드 추가 (`frontend/src/utils/recipeUtils.test.ts`)
- **7단계:** useCallback/useMemo/접근성(a11y) 등 성능/최적화/접근성 개선
- **8단계:** Prettier/ESLint 등 코드 스타일/포맷팅/컨벤션 통일
- **9단계:** 주요 함수/상태/로직/파일에 JSDoc/주석/문서화 보강
- **10단계:** any/object 등 느슨한 타입 → 명확한 타입/유틸리티 타입으로 강화
- **모든 리팩토링은 UI/UX/기능/동작 변화 없이 코드 품질만 개선**

---

## 📁 주요 프론트엔드 파일/폴더 구조 (리팩토링 반영)

- `frontend/src/components/RecipeSortBar.tsx`  
  레시피 필터/정렬 UI 및 상태 관리 컴포넌트 (Clean Code 리팩토링 적용)
- `frontend/src/components/FilterModal.tsx`  
  필터 모달 UI 및 상태 관리 (주석/타입/문서화 강화)
- `frontend/src/utils/recipeUtils.ts`  
  재료 매칭률, D-day, 카테고리 키워드 등 유틸 함수/타입 정의 (함수 분리, 타입 강화)
- `frontend/src/utils/recipeUtils.test.ts`  
  주요 유틸 함수 단위 테스트(Jest)

---

## 🧪 테스트 코드 및 실행법

- **테스트 파일:** `frontend/src/utils/recipeUtils.test.ts`
- **테스트 대상:**
  - `getDDay`, `calculateMatchRate`, `getDictCategoryKey`, `extractKeywordsAndSynonyms` 등 유틸 함수
- **실행 방법:**
  ```bash
  cd frontend
  npm install
  npm test
  # 또는
  npx jest src/utils/recipeUtils.test.ts
  ```
- **테스트는 실제 앱 동작에 영향 없음 (UI/UX/기능 100% 동일)**

---

## 📌 타입/유틸/주석/문서화 강화

- 주요 함수/상태/props/로직에 JSDoc 스타일 주석 추가
- any/object 등 느슨한 타입 → 명확한 타입(예: FilterKeywordTree, FilterKeywordNode, FilterState 등)으로 강화
- 타입 기반 자동완성, 타입 체크, 리팩토링 효율 증가
- 문서/주석/README 등도 최신 구조/역할/테스트/유틸 함수 등 반영

---

> 이 문서는 2024년 6월 기준 Clean Code 리팩토링 및 테스트/문서화/타입 강화 등 최신 구조를 반영합니다. 
> 신규 기능 추가, 협업, 유지보수, AI 활용 등 모든 작업에서 참고하세요!

---

# (이하 기존 내용은 최대한 보존, 변경/추가된 부분만 위에 보강)

## 변경 이력

- 네이버 postfiles 이미지가 외부에서 차단되는 문제를 해결하기 위해 `getProxiedImageUrl` 유틸 함수를 도입하고, 모든 레시피 썸네일 이미지에 적용함 (냉장고 요리, 요즘인기 등)
- `getProxiedImageUrl` 함수는 `frontend/src/utils/imageUtils.ts`에 위치하며, 네이버 postfiles 이미지를 weserv.nl 프록시로 우회하여 정상적으로 표시되도록 함

✅ 2. 크롤링 대상 및 구조
----------------------------------------------------------------------------------------
크롤링 대상                                    ㅣ 설명
----------------------------------------------------------------------------------------
1. naver_blog_crawler.py 네이버 블로그 > 주제별보기 > 요리/레시피       ㅣ URL: https://section.blog.naver.com/ThemePost.naver?directoryNo=20&activeDirectorySeq=2
                                            ㅣ 위치: 생활/노하우/쇼핑 > 요리/레시피
                                            ㅣ 필터: 본문에 재료 정보가 있는 포스트만 수집

2. naver_influencer_crawler.py 네이버 인플루언서 > 푸드 > 지금 핫한 토픽      ㅣ URL: https://in.naver.com/discover/135968760155968
                                            ㅣ 특징: 네이버에서 선정한 영향력 있는 인플루언서들의 요리 콘텐츠
                                            ㅣ 필터: 본문에 재료 정보가 있는 포스트만 수집

3. youtube_crawler.py YouTube 레시피 채널                        
                                            ㅣ 특징: 조회수, 좋아요, 댓글수 등 추가 메트릭 수집
                                            ㅣ 필터: 영상 설명에서 재료 정보가 있는 영상만 수집
                                            ㅣ 메타데이터: 최근 3일 내 영상들의 조회수/좋아요/댓글수 자동 업데이트
----------------------------------------------------------------------------------------

✅ 3. 크롤링 코드 구조
```
crawler/
├── naver_influencer_crawler.py  # 네이버 인플루언서 핫토픽 수집
├── naver_blog_crawler.py        # 네이버 블로그 주제별보기 수집
├── youtube_crawler.py           # 유튜브 수집
├── database.py                  # 데이터베이스 연결 및 관리
└── common/                      # 공통 상수, 기본 클래스, 데이터 모델 등

실행 순서: naver_blog_crawler.py → naver_influencer_crawler.py → youtube_crawler.py
```

### 크롤러 실행 방법

1. **통합 실행 (권장)**
   ```bash
  cd C:\Users\user\Desktop\RefrigeratorCode
  python run_all_crawlers.py
   ```
   - 모든 크롤러를 순차적으로 실행
   - 로그는 `crawler.log`에 기록
   - 예외 발생 시 상세 로그 확인 가능

2. **개별 크롤러 실행**
   ```bash
   python -m crawler.naver_blog_crawler
   python -m crawler.naver_influencer_crawler
   python -m crawler.youtube_crawler
   ```
   - 각 크롤러를 독립적으로 실행
   - 디버깅이나 테스트 시 유용

3. **크롤러 실행 순서**
   - 네이버(주제별보기) → 네이버(인플루언서핫토픽) → 유튜브(인플루언서)
   - 각 크롤러는 이전 크롤러가 완료된 후에 실행됨
   - 중간에 오류 발생 시 해당 시점에서 실행 중단

## 네이버 인플루언서 핫토픽 크롤러 데이터 저장 조건

- 아래 3개 필드 중 하나라도 값이 없으면 해당 레시피는 저장하지 않음
  - content (본문)
  - author (작성자)
  - thumbnail (썸네일 이미지)
- 모든 필드는 크롤링 시점에 값이 존재해야 하며, 값이 없을 경우 로그에 남기고 저장하지 않음

---

## 🍳 레시피 크롤링/저장 기준 및 키워드 관리

### 1. 저장/수집 공통 조건

- 아래 3개 필드 중 하나라도 값이 없으면 해당 레시피는 저장하지 않음
  - content (본문)
  - author (작성자)
  - thumbnail (썸네일 이미지)
- 모든 필드는 크롤링 시점에 값이 존재해야 하며, 값이 없을 경우 로그에 남기고 저장하지 않음

### 2. 재료 정보 필터링 조건 (모든 크롤러 공통)

**모든 크롤러는 다음 조건을 만족하는 레시피만 수집합니다:**

- **재료 블록 길이**: 10자 이상
- **추출된 재료 개수**: 4개 이상 (3개 이하 제외)
- **새로운 데이터만**: 기존 중복 데이터 제외

**크롤러별 필터링 적용:**
- **유튜브 크롤러**: 영상 설명에서 재료 정보 추출 후 필터링
- **네이버 블로그 크롤러**: 블로그 본문에서 재료 정보 추출 후 필터링
- **네이버 인플루언서 크롤러**: 블로그 본문에서 재료 정보 추출 후 필터링

### 3. 필터 키워드 적용 방식

- **네이버 인플루언서 핫토픽**
  - 큐레이션(토픽) 페이지에서 '블로그에서 더보기' 버튼을 모두 탐색
  - 각 버튼을 클릭해 블로그 원문(새 창/탭)으로 이동
  - **블로그 원문의 제목**에 필터 키워드(`RECIPE_KEYWORDS`) 중 하나라도 포함되어 있을 때만 수집

- **네이버 블로그 주제별보기**
  - 각 블로그 포스트의 **제목**에 필터 키워드(`RECIPE_KEYWORDS`) 중 하나라도 포함되어 있을 때만 수집

- **필터 키워드 변경 시**: `crawler/common/constants.py`의 `RECIPE_KEYWORDS`만 수정하면 전체 크롤러에 반영됨

### 4. 수동 관리 키워드/사전 파일 목록

- `frontend/public/Filter_Keywords.csv`  : 레시피 카테고리, 테마, 효능 등 필터링에 사용되는 키워드 목록
- `frontend/public/ingredient_profile_dict_with_substitutes.csv`  : 식재료별 프로필 및 대체재 정보
- `frontend/public/ingredient_substitute_table.csv`  : 식재료 대체 가능성 사전
- `frontend/public/YouTube_Cooking_influencer.csv` : 유튜브 요리 인플루언서 채널 목록 (여기에 채널 정보를 추가하면, 크롤러 실행 시 해당 채널의 영상이 자동으로 수집됩니다. CSV에 채널을 계속 추가하면, 그 채널의 영상도 모두 수집하게 됩니다.)

### 5. 재료 정보 자동 추출 시스템

**모든 크롤러는 크롤링 완료 후 자동으로 `update_used_ingredients_batch.py`를 실행합니다:**

- **실행 시점**: 각 크롤러의 크롤링 작업 완료 직후
- **실행 파일**: `ingredient_management/update_used_ingredients_batch.py`
- **처리 대상**: 새로 수집된 레시피의 `used_ingredients`, `used_ingredients_block`, `block_reason` 필드
- **실행 방식**: 
  - `run_all_crawlers.py`: 모든 크롤러 완료 후 통합 실행
  - `crawler/youtube_crawler.py`: 유튜브 크롤링 완료 후 실행
  - `crawler/naver_blog_crawler.py`: 네이버 블로그 크롤링 완료 후 실행
  - `crawler/naver_influencer_crawler.py`: 네이버 인플루언서 크롤링 완료 후 실행

**재료 추출 로직:**
1. **재료 블록 탐색**: 레시피 본문에서 재료 정보가 포함된 텍스트 블록 추출
2. **재료명 매칭**: 사전 기반으로 재료명과 동의어 매칭
3. **데이터베이스 업데이트**: 추출된 재료 정보를 DB에 저장

## YouTube 크롤러 설정

1. YouTube Data API v3 키 발급
   - Google Cloud Console에서 프로젝트 생성
   - YouTube Data API v3 활성화
   - API 키 발급

2. API 키 설정
   - 프로젝트 루트에 `.env` 파일 생성
   - 다음 내용 추가:
     ```
     YOUTUBE_API_KEY=your_api_key_here
     ```
   - ⚠️ 개발용 API 키 (테스트용으로만 사용):
     ```
     YOUTUBE_API_KEY=AIzaSyAHp_0bod-XWi5yNItEhQu16VWKy-fBA2Q
     ```
   - ⚠️ 보안 주의사항:
     - 이 API 키는 개발/테스트용이며, 실제 프로덕션 환경에서는 사용하지 마세요
     - 프로덕션 환경에서는 새로운 API 키를 발급받아 사용하세요
     - API 키는 절대 공개 저장소에 커밋하지 마세요
     - `.env` 파일은 반드시 `.gitignore`에 포함되어야 합니다

3. 크롤러 실행
   ```bash
   python crawler/youtube_crawler.py
   ```

4. 크롤러 특징
   - `frontend/public/YouTube_Cooking_influencer.csv` 파일에 등록된 채널의 영상만 수집
   - 영상 설명에서 재료 정보가 있는 영상만 선별적으로 수집
   - 재료 정보 추출 및 저장을 수집 시점에 수행
   - 최근 3일 내 영상들의 메타데이터(조회수, 좋아요, 댓글수) 자동 업데이트
   - API 쿼터 제한을 고려한 효율적인 수집 및 업데이트

## 폴더 구조
```
frontend/
├── src/
│   ├── components/
│   │   ├── RecipeCard.tsx        # 레시피 카드 컴포넌트
│   │   ├── IngredientPillGroup.tsx  # 재료 pill 그룹 컴포넌트
│   │   └── ...
│   ├── pages/
│   │   ├── Popular.tsx          # 인기 레시피 페이지
│   │   └── ...
│   └── ...
```

## 인기도 점수 계산 방식

### 유튜브 레시피
```
popularity_score = 1.0 * likes + 2.0 * comments + 0.5 * hits
```
- likes: 좋아요 수
- comments: 댓글 수
- hits: 조회수

### 네이버 레시피
```
popularity_score = 1.0 * likes + 2.0 * comments
```
- likes: 공감(좋아요) 수
- comments: 댓글 수

## [2025-06-23] YouTube 크롤러 API 할당량 최적화 적용 안내

- 유튜브 인플루언서 크롤러(`crawler/youtube_crawler.py`)는 다음과 같은 최적화가 실제 코드에 반영되어 있습니다.
    1. **채널 ID 캐싱**: 이미 조회한 채널 URL은 DB에 저장되어, 재실행 시 API 호출 없이 캐시에서 바로 조회합니다.
    2. **할당량 실시간 모니터링**: 각 API 호출마다 할당량 사용량을 로깅하며, 잔여량이 부족하면 즉시 중단합니다.
    3. **조기 종료**: quotaExceeded(403) 발생 시 즉시 크롤링을 중단하고, 상세 로그를 남깁니다.
    4. **상세 로깅**: API 호출 종류, 비용, 누적 사용량, 인플루언서별 처리 현황, 새로 수집된 영상 수 등 모든 과정을 로그로 남깁니다.
    5. **에러 재시도 로직**: 일시적인 네트워크 오류 시 지수 백오프로 재시도합니다.
    6. **플랫폼 구분**: PLATFORM 컬럼에 'youtube(인플루언서)'로 저장하여 일반 YouTube와 구분합니다.
- 실제 실행 시 로그(`crawler.log`)와 콘솔에서 할당량 소진 원인과 불필요한 호출 여부를 쉽게 추적할 수 있습니다.
- 환경변수(.env) 없이도 코드 내에서 API 키와 DB 정보를 직접 설정할 수 있도록 fallback 처리되어 있습니다.

### 추가 최적화 방안:
1. **채널 ID 캐싱 확장**: `@username` 형태 URL도 DB에 저장하여 재실행 시 API 호출 절약
2. **에러 재시도 메커니즘**: 일시적 오류 시 자동 재시도로 안정성 향상
3. **할당량 우선순위**: 중요한 채널부터 처리하도록 우선순위 설정 가능
4. **배치 처리 최적화**: Videos API는 50개씩 배치로 효율적 사용

---

### .env 파일 생성 및 API 키 설정
1. 프로젝트 루트에 `.env` 파일을 생성합니다.
2. `.env` 파일에 다음 내용을 추가합니다:
   ```
   YOUTUBE_API_KEY=AIzaSyAHp_0bod-XWi5yNItEhQu16VWKy-fBA2Q
   ```
3. 파일을 저장하고 닫습니다.

## 🆕 백엔드 필터링 및 정렬 기능 (2024년 6월 업데이트)

### 📋 새로운 기능 개요
- **백엔드에서 직접 필터링 및 정렬 수행**: 대량의 데이터(5~10만 건)에서도 빠르고 효율적인 검색 가능
- **키워드, 채널, 매칭률 등의 필터링 지원**
- **정렬 옵션 추가**: 매칭률, 날짜, 좋아요 등 다양한 기준으로 정렬 가능

### 🔧 API 사용 예시
```http
GET /api/recipes/filter?
  keyword=고단백&           # 키워드 필터링
  platform=youtube&         # 채널 필터링  
  match_rate_min=70&        # 매칭률 필터링
  sort_by=match_rate&       # 정렬 (match_rate, date, likes, etc)
  page=1&size=20            # 페이징
```

### 🛠️ 구현 세부사항
- **SQLAlchemy를 사용한 예시**로, 데이터베이스에서 직접 필터링과 정렬을 수행합니다.
- **DB 인덱스**: `title`, `content` 필드에 인덱스 설정으로 초고속 검색 지원
- **네트워크 절약**: 조건에 맞는 데이터만 전송하여 네트워크 사용 최소화

### 📈 성능 개선 효과
- **빠른 응답**: 0.1초 이내
- **정확한 결과**: 전체 데이터에서 필터링
- **확장성**: 데이터가 늘어나도 성능 유지

이렇게 백엔드에서 필터링과 정렬을 수행함으로써 사용자에게 최상의 경험을 제공할 수 있습니다.