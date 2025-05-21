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

