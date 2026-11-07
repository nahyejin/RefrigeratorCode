# 쿡매치 브랜드 마스터 (P1 확정, 2026-11-07)

앱·스토어·웹의 모든 아이콘은 여기 마스터에서 나온다. 시안·검토 기록은 `store/logo_proposals/e9_final/p1_final/`.

| 파일 | 내용 |
| --- | --- |
| `../icon.png` | 앱 아이콘 정식 1024 — 정사각·RGB·알파 없음·모서리 안 깎음(시스템이 깎는다). 노랑 #FFD600 바탕 |
| `mark_p1.svg` | 위 그림의 벡터(노랑 바탕 포함). `make_mark_svg.py` 로 재생성 |
| `mark_p1_symbol.svg` | 바탕 없는 마크만(투명) |
| `icon_reverse_1024.png` | 검정 바탕판(받침 노랑·재료 흰색·잎 연초록) — iOS 다크 모드 후보 |
| `icon_light_1024.png` | 흰 바탕판(재료 노랑) |
| `adaptive_foreground_1024.png` | 안드로이드 적응형 전경(투명, 안전영역 안) |
| `notification_silhouette_1024.png` | 알림용 흰 단색 실루엣(투명) |

색: 바탕 #FFD600 · 재료 #FFFFFF · 받침 #1A1A1E · 잎 #1E9252.
네이티브(iOS·Android) 자산은 `python scripts/make_native_assets.py` 가, 스토어 아이콘·피처 그래픽은 `python store/make_store_assets.py icons` 가 이 마스터에서 만든다.
