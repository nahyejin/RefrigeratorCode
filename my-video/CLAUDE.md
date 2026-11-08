# my-video — 쿡매치 광고 영상(릴스) 작업 규칙

영상을 만들거나 고치기 전에 반드시 읽는다:

1. [../store/REEL_FORMATS.md](../store/REEL_FORMATS.md) — 형식(① 제미나이 훅 / ② 직접 요리 / ③ 셀카형)과 형식별 자막·구성 규칙, **배경음악 공통 규칙과 쓴 곡 표**.
2. ② 직접 요리 릴스는 [COOKING_REEL_GUIDE.md](COOKING_REEL_GUIDE.md), ① 훅 프롬프트는 [../store/VEO_PROMPT_RULES.md](../store/VEO_PROMPT_RULES.md).

모든 광고 영상(후킹·요리·셀카형·캠핑 같은 일상 영상)에 지키는 것 — 2026-11-01 사용자:
- **배경음악은 합성 곡(`make_bgm*.py`, `--engine`) 금지.** 저작권 무료 실제 곡(Mixkit)을 받아 `public/bgm_lib/` 에 두고 `scripts/add_bgm.py <in> 0 <out> --file public/bgm_lib/<곡>.mp3` 로 깐다.
  - 곡을 받기 전에 사용자에게 곡 이름·주소·크기를 말하고 허락받는다.
  - **멜로디 위주의 브이로그풍 밝은 곡**(어쿠스틱 기타·우쿨렐레·피아노 등). 펑크·스카·컨트리 같은 건 쓰지 않는다. 편마다 다른 곡, 쓴 곡은 REEL_FORMATS 표에.
  - 말소리 구간은 음악이 자동으로 -16dB 로 내려간다(`add_bgm.py` 기본). 따로 끄지 않는다.
- **① 훅의 웃음 포인트 자막은 최소 3.5초** 보이게 — 모자라면 대사 뒤 꼬리를 `scripts/slow_hook_tail.py` 로 슬로.
- **① 훅 릴스의 기능 데모 동안 하단 중앙 검색 안내**(`makeReel(..., true)`).
- **영상 맨 마지막 장표는 늘 검색 유도 끝 장표**(`CtaOutro`: 로고 + 검색창에 「쿡매치」 타이핑 + 프로필 링크) — 요리·통합·기능 영상 모두. 뒤에 기능영상을 붙이는 편도 끝 장표를 기능영상 **뒤로** 옮긴다(2026-11-08 사용자).
- 기능 총정리처럼 처음 보는 사람용 영상은 **맨 앞에 앱 스플래시 인트로**(`SplashIntro`, 3초)(2026-11-08 사용자).
- **새 로고(P1 확정, 2026-11-07) — 앞으로 만드는 릴스부터**: 엔딩(`CtaOutro`)의 마크는 `AppIcon`(정사각 마크 PNG + CSS 둥근 모서리), 글자는 `Wordmark`(「쿡매치 CookMatch」 PNG). **2026-11-08 메인 앱 아이콘 = 옅은(흰 배경) 판 → `AppIcon` 기본 variant 가 `"light"`(흰 타일 + 노랑 재료)**. **흰 바탕 엔딩 = 기본 마크(260px, 화면 위쪽 1/4 지점 `top:470`; 흰 타일이라 경계는 안 보이고 마크만 떠 보임) + `Wordmark on="white"`**, **노랑 바탕 위·검정 바탕 위도 기본 마크**(흰 타일이라 보임) + `Wordmark on="yellow"`/`"black"`. 흰 바탕에서 타일 경계가 필요하면 `variant="yellow"`(옛 노랑 판), 노랑 위에서 더 진한 타일이 필요하면 `variant="black"`(검정 바탕판). 마크를 코드로 다시 그리거나 앰버·주황 띠·테두리를 두르지 않는다(원본 `store/brand/`·`store/make_brand_assets.py`, 확정 시안 `store/logo_proposals/e9_final/p1_final/`). **이미 올린 릴스는 못 바꾼다 — 옛 아이콘 그대로.** 옛 텍스트 워드마크(갈색 #D99A00 「Match」)는 폐기.
- **레시피를 DM·댓글로 보내는 PDF**는 [../store/RECIPE_PDF_GUIDE.md](../store/RECIPE_PDF_GUIDE.md) 형식 그대로(3쪽, 단위+괄호, 쪽 직접 나눔, 노란 「쿡매치 검색 · 여기를 누르면 쿡매치 받기」 링크, `utm_source=recipe_pdf_<요리이름>`).
