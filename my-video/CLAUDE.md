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
- **새 로고(P1 확정, 2026-11-07) — 앞으로 만드는 릴스부터**: 엔딩(`CtaOutro`)의 마크는 `AppIcon`(정사각 마크 PNG + CSS 둥근 모서리), 글자는 `Wordmark`(「쿡매치 CookMatch」 PNG). **흰 바탕 엔딩 = 노랑 정식 마크(260px, 화면 위쪽 1/4 지점 `top:470`) + `Wordmark on="white"`**, **노랑 바탕 위에 올릴 때만 검정 바탕판 `AppIcon variant="black"` + `Wordmark on="yellow"`**(노랑 위에 노랑 타일은 사라진다), **검정 바탕 위는 노랑 정식 마크 + `Wordmark on="black"`**. 마크를 코드로 다시 그리거나 앰버·주황 띠·테두리를 두르지 않는다(원본 `store/brand/`·`store/make_brand_assets.py`, 확정 시안 `store/logo_proposals/e9_final/p1_final/`). **이미 올린 릴스는 못 바꾼다 — 옛 아이콘 그대로.** 옛 텍스트 워드마크(갈색 #D99A00 「Match」)는 폐기.
- **레시피를 DM·댓글로 보내는 PDF**는 [../store/RECIPE_PDF_GUIDE.md](../store/RECIPE_PDF_GUIDE.md) 형식 그대로(3쪽, 단위+괄호, 쪽 직접 나눔, 노란 「쿡매치 검색 · 여기를 누르면 쿡매치 받기」 링크, `utm_source=recipe_pdf_<요리이름>`).
