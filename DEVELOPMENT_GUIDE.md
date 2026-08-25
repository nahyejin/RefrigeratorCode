# 🚀 냉털이 개발 가이드

## 📋 개발 워크플로우

### 1. 개발 환경 시작
```bash
# 전체 개발 환경 시작 (백엔드 + 프론트엔드)
start_dev.bat

# 또는 빠른 개발 (프론트엔드만)
quick_dev.bat
```

### 2. 개발 과정
1. **코드 수정** → 파일 저장
2. **즉시 확인** → `http://localhost:5178` 에서 자동 반영
3. **문제 해결** → 개발자 도구로 디버깅
4. **완벽 확인** → 모든 기능 테스트

### 3. 배포
```bash
# Git 커밋 및 푸시
git add .
git commit -m "기능 추가/수정"
git push origin main
```

### 4. 배포 확인
```bash
# 배포 상태 확인
check_deployment.bat
```

## 🌐 환경별 URL

| 환경 | 프론트엔드 | 백엔드 | 용도 |
|------|------------|--------|------|
| **로컬 개발** | http://localhost:5178 | http://localhost:5000 | 코드 수정 즉시 확인 |
| **실제 배포** | https://refrigerator-code.vercel.app/ | Railway | 사용자 접속 |

## 🔧 주요 스크립트

### `start_dev.bat`
- 백엔드 + 프론트엔드 동시 시작
- 브라우저 자동 열기
- 개발 환경 완전 설정

### `quick_dev.bat`
- 프론트엔드만 시작 (백엔드가 이미 실행 중일 때)
- 빠른 개발용

### `check_deployment.bat`
- 배포된 사이트 확인
- Vercel/Railway 대시보드 열기

## 💡 개발 팁

### 코드 수정 후 확인
1. 파일 저장 (Ctrl+S)
2. 브라우저에서 `http://localhost:5178` 새로고침
3. 변경사항 즉시 반영 확인

### API 테스트
- 백엔드 API: `http://localhost:5000/api/health`
- 프론트엔드에서 API 호출 시 자동으로 로컬 백엔드 사용

### 배포 확인
- GitHub 푸시 후 1-2분 대기
- `https://refrigerator-code.vercel.app/` 에서 최종 확인

## 🚨 문제 해결

### 서버가 시작되지 않을 때
1. 포트 충돌 확인 (5000, 5178)
2. Python/Node.js 설치 확인
3. 의존성 설치: `npm install` (frontend 폴더에서)

### 배포가 반영되지 않을 때
1. GitHub 푸시 확인
2. Vercel 빌드 로그 확인
3. 몇 분 더 대기 후 새로고침

## 📁 프로젝트 구조
```
RefrigeratorCode/
├── frontend/          # React 프론트엔드
├── backend/           # Flask 백엔드
├── start_dev.bat      # 개발 환경 시작
├── quick_dev.bat      # 빠른 개발
└── check_deployment.bat # 배포 확인
``` 

---

## 🎨 UI 체계 (2026-08-26 정비)

디자인이 화면마다 제각각이던 문제를 정리하면서 **공통 규격**을 만들었습니다.
새 화면·팝업을 만들 때는 아래를 따라 주세요. 직접 스타일을 짜면 다시 제각각이 됩니다.

### 토큰 — 값은 여기서만 바꿉니다

| 파일 | 내용 |
|---|---|
| `frontend/src/index.css` 의 `:root` | 색(ink/line/surface/brand) · 타이포 · z-index · 터치 최소 크기 |
| `frontend/tailwind.config.js` | 위와 **같은 값**을 Tailwind 클래스로도 쓰게 미러링 |
| `frontend/src/styles/ingredientPill.ts` | 재료 pill 3상태(보유/부족/대체) 색 — pill 과 범례가 이 파일 하나를 공유 |

```
색   : --ink-900/700/500/400/300, --line-200/300, --surface, --surface-sub,
       --brand, --brand-light, --brand-strong, --brand-soft
타이포: --text-caption 12 / --text-sm 13 / --text-body 15 / --text-md 16 /
       --text-lg 18 / --text-xl 22 / --text-2xl 26
레이어: --z-sticky 100 < --z-nav 200 < --z-dropdown 300 < --z-fab 400 <
       --z-overlay 500 < --z-modal 600 < --z-toast 700
```

### 공통 컴포넌트 (`frontend/src/components/ui/`)

| 컴포넌트 | 용도 | 비고 |
|---|---|---|
| `Button` | 모든 버튼 | md·lg 는 높이 44px 이상 자동 보장 |
| `Input` | 입력창 | 높이 44px, 글자 16px 고정 (iOS 자동 확대 방지) |
| `Chip` | 태그·필터 칩 | 재료 pill 은 `styles/ingredientPill.ts` 사용 |
| `Dialog` | 확인·안내 팝업 | 버튼 없으면 하단에 취소 자동 추가 |
| `Sheet` | 바텀시트 | 아래로 밀어 닫기 / 위로 끌어 펼치기 |
| `CloseButton` | 팝업 닫기 | 36×36 둥근 사각형 — 팝업마다 다르게 만들지 말 것 |
| `PopupHeader` | 팝업 상단 바 | 높이 52px, 제목 17px 고정 |

그 밖에 `components/` 의 `Portal`, `LoadingIndicator`, `IngredientLegend`,
`SectionHeader`, `RecipeCardSkeleton`, `CoupangDisclaimer` 도 공통으로 씁니다.

### 지켜야 할 규칙

1. **팝업은 반드시 `Dialog` 또는 `Sheet`** 를 쓰고, 우상단 X 와 하단 나가기 버튼을 둡니다.
2. **모달을 `position: sticky` / `transform` 이 걸린 요소 안에서 렌더하지 마세요.**
   그 조상이 새 스택 맥락을 만들어, z-index 를 아무리 올려도 헤더·네비 아래에 깔립니다.
   `Portal` 로 body 직속 렌더하면 해결됩니다. (실제로 겪은 버그)
3. **로딩은 `LoadingIndicator` 하나만** 씁니다. 화면마다 다른 로딩을 만들지 마세요.
4. **`prefers-reduced-motion` 안에서 `*` 로 애니메이션을 죽이지 마세요.**
   로딩·FAB 같은 상태 표시까지 멈춰 앱이 고장 난 것처럼 보입니다. (실제로 겪은 버그)
5. **입력창 포커스 스타일을 개별로 지정하지 마세요.** 전역 `input:focus` 규칙이 있습니다.
6. SVG 아이콘은 flex 안에서 0px 로 찌그러질 수 있으니 **width/height 를 인라인으로 고정**합니다.

### 확인 방법

UI 를 바꾼 뒤에는 눈으로만 보지 말고 측정해 주세요. 이번 정비에서
"애니메이션이 멈췄다", "닫기 버튼이 안 보인다" 같은 문제가 실제로는
**설정·색·크기 문제**였던 경우가 여러 번 있었습니다.

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json   # 타입·JSX 구조 확인
```
