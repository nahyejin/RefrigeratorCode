# 스플래시 「앉는 순간」 프레임 (브랜드 적용 B)

앱 스플래시(`frontend/src/components/SplashScreen.tsx` + `BrandMark motion="intro"`)의 애니메이션을 시각별로 멈춰 찍은 것이다.
Chrome 헤드리스(뷰포트 500x812 — 헤드리스 최소 폭)에서 `document.getAnimations()` 를 해당 시각(ms)에 멈춰 캡처했다. 실제 폰(375px)은 마크가 조금 더 작다.

| 파일 | 장면 |
| --- | --- |
| `splash_150ms.png` | 받침이 먼저 나타남(페이드·아래에서 위로) |
| `splash_450ms.png` | 재료가 위에서 내려옴 |
| `splash_620ms.png` | 재료가 받침에 앉는 순간(틈 18 이 보이기 시작) |
| `splash_700ms.png` | 살짝 눌림(가로 1.05·세로 0.92) |
| `splash_1000ms.png` | 잎이 펴짐 + 워드마크 페이드 시작 |
| `splash_1500ms.png` | 완성 상태(누적 레시피 수와 함께) |
| `splash_frames_sheet.png` | 위 여섯 장 한 장 요약 |

iOS 는 네이티브 정지 스플래시(완성된 마크)에서 이어지므로 `motion="hop"`(완성된 모양에서 한 번 떴다 앉기)을 쓴다.
움직임 줄이기(`prefers-reduced-motion`)에서는 이동·눌림 없이 0.12초 페이드만 하고 숫자도 바로 최종값을 보인다.
