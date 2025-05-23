✅ 1. 주요 Python 코드 파일 및 역할
markdown
복사
편집
----------------------------------------------------------------------------------------
파일명                                      ㅣ 설명
----------------------------------------------------------------------------------------
extract_keywords_dual_view.py                  ㅣ 수집된 레시피 텍스트에서 명사 기반 및 띄어쓰기 기반 키워드를 추출하여 CSV로 저장. Komoran 형태소 분석기 사용. 전체 저장 모두 지원.
ingredient_text_utils.py                       ㅣ 재료 텍스트 전처리 및 추출에 필요한 유틸리티 함수 정의 (예: 정규표현식, 필터링 함수 등).
update_used_ingredients_batch.ipynb            ㅣ 레시피 텍스트에서 추출한 재료 결과(`used_ingredients`)를 데이터셋에 반영하는 배치 처리 로직 구현.
refrigerator_crawler.ipynb                     ㅣ Naver 블로그 및 YouTube에서 레시피 포스트를 크롤링하고 필요한 텍스트 데이터를 수집.
export_recipes_all.ipynb                       ㅣ 수집된 레시피 데이터를 가공·요약·정제하는 보조 코드.
generate_substitutes2_by_trait_similarity.ipynbㅣ 사전내에서 재료의 특징 패턴을 찾아 대체제를 자동으로 채워주는 코드. 
----------------------------------------------------------------------------------------
✅ 2. 실행 및 환경 구성 방법
# 가상환경 실행 상태에서 아래 명령어 입력
pip install -r requirements.txt
Python 버전: 3.10

Java 버전: JDK 11

JAVA_HOME 환경 변수 설정 필요

반드시 가상환경 venv310에서 실행할 것

✅ 3. 주요 구성 요소 설명
markdown
복사
편집
----------------------------------------------------------------------------------------
파일명                                         ㅣ 설명
----------------------------------------------------------------------------------------
requirements.txt                               ㅣ 실행에 필요한 Python 패키지 목록 및 버전 명시
ingredient_profile_dict_v1.csv                 ㅣ 주요 식재료별 명칭, 레이블(예: 유제품, 단백질원, 건강식 등) 정의
ingredient_substitute_table_v1.csv             ㅣ 재료 대체 가능성 사전 (예: 설탕 → 알룰로스 등) 정의, 재료 부족 시 대체 추천에 활용
----------------------------------------------------------------------------------------
⚠️ 필수 주의사항
konlpy는 0.5.2 버전, JPype1은 1.4.1 버전으로 설치해야 Komoran 정상 작동

open-korean-text-2.1.0.jar 파일 안에 kr.lucypark.okt.OktInterface 클래스가 포함되어 있어야 함

모든 코드는 반드시 가상환경 venv310 안에서 실행할 것

extract_keywords_dual_view.py는 Komoran 기반으로 명사/띄어쓰기 단어를 모두 추출하며, full 저장 모드와 top-100 저장 모드를 모두 지원함

✅ 4. 프로젝트 폴더 구조 및 역할

```
RefrigeratorCode/
├── backend/                # 백엔드(서버) 코드
├── frontend/               # 프론트엔드(React) 코드
├── data/                   # 데이터 및 데이터 처리 스크립트
├── crawling/               # 크롤링 관련 코드
├── ingredient-management/  # 식재료 관리 기능
├── utils/                  # 공통 유틸리티 함수
├── node_modules/           # 프론트엔드 라이브러리(자동 생성)
├── __pycache__/            # 파이썬 캐시(자동 생성)
├── package.json            # 프론트엔드 의존성/스크립트
├── package-lock.json       # 프론트엔드 의존성 고정
└── PROJECT_OVERVIEW        # 프로젝트 설명 문서
```

- **backend/**: 백엔드(서버) 코드 및 API
- **frontend/**: 프론트엔드(React) 코드
- **data/**: 데이터 파일, 데이터 처리 스크립트
- **crawling/**: 크롤링(데이터 수집) 관련 코드
- **ingredient-management/**: 식재료 관리 기능/모듈
- **utils/**: 공통 유틸리티 함수 및 모듈
- **node_modules/**: 프론트엔드 라이브러리(자동 생성, 직접 수정 X)
- **__pycache__/**: 파이썬 캐시(자동 생성, 직접 수정 X)
- **package.json / package-lock.json**: 프론트엔드 의존성 및 스크립트 관리
- **PROJECT_OVERVIEW**: 프로젝트 설명 및 구조 안내 문서

## MySQL 데이터베이스 구조 및 recipes 테이블 설명

### 스키마: refrigerator

#### 테이블: recipes

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
| likes                  | int                 | 좋아요 수                                                    |
| comments               | int                 | 댓글 수                                                      |
| post_time              | date                | 게시일자                                                     |
| collected_at           | datetime            | 데이터 수집 일자                                             |

---

#### 예시: MySQL 연결 설정 (pymysql)

```python
import pymysql

# MySQL 연결 설정
conn = pymysql.connect(
    host='localhost',
    user='root',
    password='sk784512!!',
    db='refrigerator',
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

## 📌 특징 및 데이터 흐름
- **RecipeSortBar, RecipeCard, filterRecipes 등 공통 컴포넌트/유틸**을 모든 레시피 리스트 페이지에서 사용
- **필터/정렬/카드 UI/로직을 한 곳만 수정하면 전체 페이지에 반영**
- **props/state로 데이터 흐름이 명확** (상위 페이지에서 상태 관리, 하위 컴포넌트에 전달)
- **확장/리팩터링/협업에 용이** (구조가 일관적, 문서화로 빠른 파악 가능)

---

> 이 문서는 주요 파일/컴포넌트/유틸의 역할과 구조를 빠르게 파악할 수 있도록 정리한 개요입니다. 
> 새로운 기능 추가, 리팩터링, 협업, AI 활용 등 모든 작업에서 참고용으로 활용하세요!

# 냉장고요리 페이지 필터/정렬 로직 정리

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
  - 최신순: post_time/date 기준 내림차순
  - 좋아요순: likes 기준 내림차순
  - 댓글순: comments 기준 내림차순
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

