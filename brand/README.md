# 쿡매치 브랜드 폴더

로고와 디자인 컴포넌트를 **한 곳에** 모아 둔 폴더다(2026-11-08). 스토어·릴스·문서·앱을 만들 때 여기서 꺼내 쓴다.
**원본(소스 오브 트루스)은 아래 「원본 위치」에 있고, 이 폴더는 쓰기 편하게 정리한 사본이다.** 고칠 때는 원본을 고치고 이 폴더를 다시 만든다.

## 로고 = 「재료가 받침에 딱 맞게 앉는다」
Cook + Match — 재료와 레시피가 맞는다. 재료(흰 원) · 받침(검정 그릇) · 잎(초록)이 한 덩어리이고, 재료와 받침 사이의 **얇은 틈이 항상 같은 폭**이다.
**하지 말 것**: 재료가 둥둥 뜨거나 받침에 안 닿기 · 틈이 없거나 너무 크게 · 앰버/주황 띠·테두리 · 그라데이션·그림자 · 모서리를 깎은 아이콘 파일(모서리는 시스템이 깎는다) · AI 대기 화면과 쿡 픽/쿡 코치 아바타에 쓰기.

## 폴더 구성
| 폴더 | 내용 |
|---|---|
| `logo/app_icon/1_기본_노랑바탕` | **기본 앱 아이콘**(노랑 바탕 + 흰 재료 + 검정 받침 + 초록 잎). 1024·512·180·120·60·29px, 정사각·알파 없음 |
| `logo/app_icon/2_검정바탕판` | 검정 바탕판. **노랑 배경 위**(스토어 노랑 장·노랑 배경화면)에서 타일이 사라지지 않게 쓰고, iOS 다크 모드 아이콘 후보 |
| `logo/app_icon/3_옅은판` | 옅은(흰) 바탕판 + 노랑 재료. 앱 안 빈 화면·광고 여백·인스타 프로필 후보 |
| `logo/mark/` | 마크 벡터(`mark_p1.svg`, 심볼 `mark_p1_symbol.svg`)와 생성 코드 |
| `logo/wordmark/` | 굵은 한글 「쿡매치」+ 작은 「CookMatch」 워드마크(투명 PNG; 흰·노랑·검정 바탕용) |
| `logo/lockup/` | 락업 3종(가로·세로·아이콘 단독), 스토어 첫 장 상단 예 |
| `logo/android/` | 적응형 아이콘 전경·배경, 알림 흰 실루엣 |
| `colors/` | `colors.json`, `tokens.css` — 노랑 #FFD600 · 검정 #1A1A1E · 잎 #1E9252(검정 위 #3CBE6E) |
| `components/` | 앱에서 실제로 쓰는 코드의 복사본: `BrandMark`(마크 SVG + 앉기 모션), `BrandWordmark`, `SnugMark`(작은 「딱 맞는다」 표시), `LoadingIndicator`(재료가 하나씩 앉는 로딩), `SplashScreen`(스플래시), `brand-motion.css`(모션 키프레임 발췌) |
| `seasonal/` | 계절 대체 아이콘 4종(봄 딸기·여름 수박·가을 감·겨울 귤). **받침·구도·바탕은 그대로, 재료와 잎만 교체** |
| `splash/` | 스플래시 애니메이션 프레임(받침 → 재료 낙하 → 앉음 → 눌림 → 잎 펴짐) |
| `store/` | 스토어 아이콘 1024(앱스토어)·512(플레이), 플레이 피처 그래픽 1024x500 |
| `guide/` | 브랜드 보드, 「딱 맞는다」 OK/NG, 컴포넌트 활용 지도·가이드(화면별 어디에 어떻게), 계절 리스트, 로고 결정 기록 |

## 컴포넌트 사용 원칙(요약 — 자세히는 `guide/COMPONENT_GUIDE.md`)
- 1순위 3곳: **스플래시**, **매칭 계산 로딩**, **빈 화면**. 그다음 「딱 맞는다」 순간(매칭 N=M·사진 인식 완료·식단 완성)의 0.4초 앉기 모션.
- 목록 스크롤마다 반복 재생 금지(처음 보일 때 한 번, 동시에 2개까지). `prefers-reduced-motion` 에서는 0.12초 페이드만.
- 노랑 장에는 검정 바탕판, 검정 장에는 기본(노랑) 아이콘.

## 원본 위치 (고칠 때 여기를 고친다)
- 앱 아이콘 마스터: `frontend/assets/icon.png`, 벡터 `frontend/assets/brand/`
- 네이티브 아이콘·스플래시·알림 생성: `scripts/make_native_assets.py` (iOS 8개·Android 약 68개 자동 생성/검사)
- 스토어 아이콘·피처 그래픽: `python store/make_store_assets.py icons`
- 웹 아이콘·PWA: `scripts/make_web_icons.py`, OG 이미지 `scripts/make_og_image.py`
- 마크 컴포넌트: `frontend/src/components/brand/`, 모션 CSS `frontend/src/index.css`(`.brand-mark…`)
- 스토어 스크린샷: `store/make_store_assets_v3.py`
- 시안·논의 기록: `store/logo_proposals/` (D→E→P1 변형, 팔레트 17종 등), 적용 점검표 `store/logo_proposals/ROLLOUT_CHECKLIST.md`

## 결정 대기
- 메인 앱 아이콘을 **기본 노랑 바탕**으로 갈지 **옅은 판**으로 갈지(사용자는 옅은 판 쪽으로 기울어 있음 — 홈 화면에서 노랑 바탕이 더 눈에 띄고, 옅은 판은 흰 타일·밝은 배경과 섞일 수 있음). 옅은 판으로 바꾸면 `frontend/assets/icon.png` 를 바꾸고 `python scripts/make_native_assets.py`·`python store/make_store_assets.py icons`·`scripts/make_web_icons.py` 를 다시 돌리면 된다.
- 상표 검색(KIPRIS)과 디자이너 검수.
