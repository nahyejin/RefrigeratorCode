# 쿡매치 마크를 앱 전반에 컴포넌트로 쓰는 법 (제안 문서 — 앱 코드에 연결하지 않음)

2026-11-07. 대상 마크: E9g 형태(재료 + 받침 + 큰 잎·작은 잎). 정식안 P12(검정 바탕 + 흰 재료 + 앰버 받침 + 노랑 잎), 밝은 배경용 P14 계열(검정 받침 + 노랑 재료 + 진초록 잎).
이 문서의 파일 경로·줄 번호는 `frontend/src` 를 직접 읽고 확인한 것이다. 한 장 요약: `component_map.png`. 초안 코드: `component_draft/BrandMark.tsx`.

## 0. 포인트: 「딱 맞는다」
이 모양의 포인트는 **재료가 받침에 딱 맞게 앉는다 = 재료와 레시피가 맞는다(Cook + Match)** 이다. 그림 한 장이 아니라 세 가지로 나타난다.
1. **간격** — 재료와 받침 사이의 얇은 틈은 항상 같은 폭(18/1024). 재료 모양이 달라도 마스크로 같은 폭을 만든다(`BrandMark` 의 stroke 마스크).
2. **앉는 깊이** — 재료 중심이 받침 윗선에 오는 「반쯤 앉은」 깊이.
3. **모션** — 위에서 내려와 0.4초 안에 앉고 한 번 눌렸다 올라온다.
하지 말 것(`why_snug.png`): 둥둥 뜬 재료, 받침에 안 닿는 재료, 헐렁한 틈, 틈 없이 뭉친 모양, 너무 깊이 파묻힌 재료. 예외: 빈 화면 「맞는 레시피가 없어요」에서만 재료가 받침 옆으로 굴러 나간 모양을 쓴다(맞지 않음을 뜻함).

## 1. 변형과 색 토큰 매핑
| 변형 | 쓰는 곳 | 색 |
| --- | --- | --- |
| `tone="color"` (밝은 배경) | 흰/옅은 화면(빈 화면·시트·카드·가이드) | 받침 `--ink-900` #1A1A1E · 재료 `--brand` #FFD600(또는 재료색) · 잎 `--brand-leaf`(제안) #1E9252 |
| `tone="reverse"` (어두운 배경) | 스플래시·검정 장·릴스 끝장·온보딩 | 받침 `--brand-bowl`(제안) #E8AC00 · 재료 `--surface` #FFFFFF · 잎 `--brand` #FFD600 · 바탕 `--ink-900` |
| `tone="mono"` | 알림 24dp·토스트·16~20px 배지 | `currentColor` 한 색 |
기존에 없는 토큰은 **제안**이다: `--brand-bowl: #E8AC00;` `--brand-leaf: #1E9252;` (index.css `:root` 에 추가하는 방식, 지금은 추가하지 않았다). 재료 색(토마토 #EE403A 등)은 컴포넌트 안 상수로 두고 토큰으로 만들지 않는다(재료 10개 이내 규칙).

## 2. 화면별 사용 (실제 경로)
| 자리 | 파일 | 크기·변형 | 언제 쓰지 말 것 |
| --- | --- | --- | --- |
| 스플래시 | `components/SplashScreen.tsx` (아이콘 import 2행, 이미지 156~157행) | reverse 120px, 입장 시 1회 앉기 | 반복 재생 금지 |
| 매칭 계산 로딩 | `components/FloatingScanLoader.tsx` (「재료 칸이 하나씩 맞춰지는」 그림) | color 72px 앉기 루프 1.2s | **AI 대기에는 쓰지 않는다** — `StepLoading.tsx` 의 scan-frame 은 「AI 를 쓰는 중, 크레딧이 나간다」 신호라서 같은 그림을 쓰면 오해를 부른다(FloatingScanLoader 주석이 같은 이유를 적고 있다) |
| 빈 화면 | `pages/RecipeList.tsx` 2746행 「등록된 재료가 없습니다」, 2776행 「조건에 맞는 레시피가 없어요」 | color 88px (재료 1개) | 섹션 안 작은 문구(`pages/MyFridge.tsx` 2891·2913·2935행 「재료가 아직 없어요」)에는 쓰지 않는다. `pages/Popular.tsx` 1715·1765행, `pages/CookingCalendar.tsx` 2933·3015행은 2순위 후보 |
| 「내 재료 N/M」 | `components/RecipeCard.tsx` 787행 (`RecipeRow.tsx`도 같은 문구) | mono/color 16px, M/M 일 때만 | 카드마다 깔지 않는다 |
| 사진 인식 완료 | `components/IngredientRecognitionSheet.tsx` 691행(「사진에서 찾은 재료」) | color 28px 결과 시트 열릴 때 1회 | 기다리는 동안은 StepLoading 유지 |
| 식단 짜기 완성 | `pages/WeeklyPlan.tsx` | color 36px 결과 카드 상단 | AI 칩(별 모양 표시) 옆에 나란히 두지 않는다 |
| 성공 토스트 | `components/Toast.tsx`, `RecipeToast.tsx` | mono 20px 흰색 | 일반 토스트(저장·오류) |
| 푸시 알림 | `components/NativePushBridge.tsx`, `android/app/src/main/res/drawable-*/ic_stat_cookmatch.png`(5개) | mono 24dp 흰 실루엣(틈 없는 판) | — |
| 위젯 | `android/.../res/layout/widget_*.xml`, `ios/App/CookMatchWidget/*.swift` | 18~32px 한 곳 | 위젯 전체를 마크로 덮지 않기 |
| 헤더 | `components/TopNavBar.tsx` 3·88행(워드마크 높이 20px) | **마크 없이 워드마크만** | 헤더에 마크까지 넣으면 혼잡 |
| 쿡 픽·쿡 코치 | `components/RecipeChatWidget.tsx` 561·688행(`ai-avatar-mark` 노랑 원 + 선 아이콘), `components/CookCoach.tsx` 85행(ChefHatIcon) | **그대로 둔다** | AI 기능은 선 아이콘·별 표시 체계라 마크로 바꾸지 않는다 |
| 마이페이지 | `pages/MyPage.tsx` 24행(`profile_default.png`) | color 56px, 사진 없을 때만 | 사용자 사진이 있으면 쓰지 않기 |
| 온보딩·가이드 | `components/GuideOverlay.tsx`, `PWAInstallGuide.tsx` | reverse 56px 첫 장만 | 단계마다 반복 |
| 스토어·릴스 | `store/make_store_assets_v3.py`, `my-video/src/shared.tsx` | 풀컬러 + 패밀리 도형 | — |

## 3. 「딱 맞는다」 순간의 마이크로 인터랙션 (0.4초)
공통 모션(`component_draft/BrandMark.tsx` 의 `BRAND_MARK_CSS`): 재료+잎이 위로 9% 떠 있다가 내려와(0→60%) 앉고, 한 번 눌렸다(78%, scale 1.04×0.94) 올라온다. `cubic-bezier(.2,.9,.3,1)`.
| 순간 | 트리거(근거) | 위치 |
| --- | --- | --- |
| 매칭 100% | 카드의 「내 재료 N/M」에서 N === M (`RecipeCard.tsx` 787행의 계산식) | 문구 옆 16px 배지, 화면에 들어올 때 1회(IntersectionObserver), 스크롤 중 재생 금지 |
| 모든 재료 보유 | 레시피 상세에서 부족 재료 0 | 상세 헤더 28px |
| 사진 인식 완료 | `IngredientRecognitionSheet` 가 결과를 보여 주는 순간 | 시트 제목 옆 28px |
| 식단 완성 | `WeeklyPlan` 결과 도착 | 결과 카드 상단 36px |
`prefers-reduced-motion: reduce` 에서는 이동·눌림 없이 0.12초 페이드만. 한 화면에서 같은 마크가 동시에 둘 이상 움직이지 않게(동시 재생 1개), 같은 세션에서 같은 항목은 한 번만.

## 4. 우선순위와 하지 않을 것
1순위 3곳: **① 스플래시 + 앱 아이콘**, **② 매칭 계산 로딩(FloatingScanLoader)**, **③ 레시피 목록 빈 화면 2종**. 2순위: 「내 재료 M/M」 배지, 사진 인식 완료, 식단 완성, 성공 토스트, 푸시 알림, 위젯. 3순위: 온보딩, 마이페이지 프로필, 스토어·릴스 확장.
하지 않을 것: ① 모든 버튼·카드·탭에 마크를 깔기(과사용 — 의미가 닳는다), ② 헤더에 마크 넣기, ③ AI 대기 화면에 쓰기(크레딧 오해), ④ AI 아바타(쿡 픽·쿡 코치)를 마크로 바꾸기, ⑤ 한 화면에서 마크 여러 개를 동시에 움직이기, ⑥ 둥둥 뜬 재료 모양(§0).

## 5. 재사용 컴포넌트 초안 `component_draft/BrandMark.tsx`
props: `ingredient`(ball·tomato·mandarin·egg·tofu·persimmon·strawberry·potato·zucchini·eggplant·melon), `size`, `tone`('color'|'reverse'|'mono'), `seated`(앉는 모션 on/off), `leaves`(1|2), `title`. 인라인 SVG, 색은 CSS 변수 폴백. 받침-재료 틈은 SVG 마스크(재료를 stroke 로 18 부풀려 받침에서 뺌)라 어떤 재료든 같은 틈이 생긴다. 사용 예 3개(`BrandMark.examples.tsx`): 스플래시(reverse 120px), 빈 화면(color 88px), 매칭 배지(color 16px, M/M 일 때만).
검증: 앱 번들에 안 들어가게 `store/logo_proposals/e9_final/finalists/component_draft/` 에 두었다(frontend tsconfig `include: ["src"]` 밖). 타입 검사는 프로젝트 파일을 건드리지 않고 임시 tsconfig(스크래치 폴더, `paths` 로 `frontend/node_modules/@types/react` 를 참조)로 `strict: true` 에서 돌렸고 오류 없이 통과했다(두 파일이 검사 대상에 포함됨을 `--listFiles` 로 확인).
앱에 넣을 때 순서 제안: ① `--brand-bowl`·`--brand-leaf` 토큰 추가 ② `BrandMark.tsx` 를 `components/` 로 옮기고 CSS 를 `index.css` 로 ③ 스플래시 → FloatingScanLoader → 빈 화면 순으로 교체.
