# 쿡매치 브랜드 마스터 (P1 확정 2026-11-07 · 메인 앱 아이콘 = 옅은(흰 배경) 판 2026-11-08)

앱·스토어·웹의 모든 아이콘은 여기 마스터에서 나온다. 시안·검토 기록은 `store/logo_proposals/e9_final/p1_final/`.

| 파일 | 내용 |
| --- | --- |
| `../icon.png` | **메인 앱 아이콘 1024 = 옅은(흰 #FFFFFF 바탕) 판, 재료 노랑 #FFD600** — 정사각·RGB·알파 없음·모서리 안 깎음(시스템이 깎는다) |
| `icon_yellow_1024.png` | 노랑 바탕판(옛 기본: 노랑 바탕 + 흰 재료). **스플래시·OG·노랑 화면 위 마크의 바탕** — 홈 화면·스토어 아이콘으로는 안 씀 |
| `icon_reverse_1024.png` | 검정 바탕판(받침 노랑·재료 흰색·잎 연초록) — iOS 다크 아이콘 · 틴트 아이콘의 원본(회색조) |
| `mark_p1.svg` | **흰 재료 마크 · 노랑 바탕 포함**(스플래시·노랑 화면용, 노랑 바탕판과 같은 그림). `make_mark_svg.py` 로 재생성 |
| `mark_p1_symbol.svg` | 흰 재료 마크만(투명) — 노랑·검정 바탕 위에 얹을 때 |
| `mark_light.svg` | **노랑 재료 마크 · 흰 바탕 포함**(메인 앱 아이콘과 같은 그림) |
| `mark_light_symbol.svg` | 노랑 재료 마크만(투명) — 흰·밝은 바탕 위에 얹을 때 |
| `adaptive_foreground_1024.png` | 안드로이드 적응형 전경(노랑 재료, 투명, 안전영역 안). 배경은 흰색 단색 #FFFFFF(`values/ic_launcher_background.xml`) |
| `notification_silhouette_1024.png` | 알림용 흰 단색 실루엣(투명) |

색: 메인 아이콘 = 바탕 #FFFFFF · 재료 #FFD600 · 받침 #1A1A1E · 잎 #1E9252 (노랑 바탕판 = 바탕 #FFD600 · 재료 #FFFFFF).
`python frontend/assets/brand/make_mark_svg.py` 는 마스터 3종(`../icon.png`·`icon_yellow_1024.png`·`icon_reverse_1024.png`)을 `store/logo_proposals/e9_final/p1_final/fullset/` 에서 복사하고 SVG 4종·적응형 전경·알림 실루엣을 다시 만든다.
네이티브(iOS·Android) 자산은 `python scripts/make_native_assets.py` 가, 스토어 아이콘·피처 그래픽은 `python store/make_store_assets.py icons` 가 이 마스터에서 만든다.
