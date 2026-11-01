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
