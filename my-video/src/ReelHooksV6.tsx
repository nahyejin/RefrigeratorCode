import { makeReel, type HookSpec } from "./ReelHooksV2";
import { REST_EXCL } from "./RestFeatures";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel3Demo, Reel3Cta, REEL3_DEMO_LEN, REEL3_CTA_LEN } from "./Reel3CookMode";
import { Reel7Demo, Reel7Cta, REEL7_DEMO_LEN, REEL7_CTA_LEN } from "./Reel7RealRecipe";
import { Reel4Demo, Reel4Cta, REEL4_DEMO_LEN, REEL4_CTA_LEN } from "./Reel4AiDiet";

// 후킹 v6(2026-10-23) — store/REEL_HOOKS_V6.md 프롬프트로 사용자가 뽑은 제미나이 클립 중 살린 두 편.
// 클립은 편집본(my-video/public/hooks_v6_fixed 에서 확대·글자 지우기·라벨 블러 후 사용자가 확인한 파일).
// 제미나이 후킹 릴스 형식 그대로(v2·v4 와 같은 makeReel): 훅 원본 전체 + 웃음 포인트부터 자막 → 그 편 기능 데모 → 끝 화면
// → 나머지 기능 7가지 → 끝 화면 한 번 더. 첫 프레임부터 뜨는 큰 노란 「썸네일 자막」은 요리 릴스 전용이라 쓰지 않는다(사용자 지적).
// 자막 시각은 Whisper(medium) 단어 시각 실측. BGM 은 렌더 뒤 scripts/render_hooks_v6.sh 에서 add_bgm.py 로 깐다.

// 02 매칭 ← 「오늘 저녁 뭐 먹어?」 「양배추 반 통이랑 소시지? 이게 다야」 → 「뒤에 저건 다 뭔데?」(6.08s) 「어? 저거 언제 샀지?」 (원본 10.0s)
const H2: HookSpec = { src: "reel2_hook_v6_cabbage.mp4", segs: [[0, 10.0]], captionAt: 6.1, caption: "있는 재료도 모르고\n뭐 해 먹지 고민했죠?" }; // 02 매칭 데모(「내 냉장고 기준 매칭률 순」)로 이어지게(사용자 선택, 2026-10-23)

// 03 요리 모드 ← 냄비 든 채 레시피 화면이 꺼짐 「나 손 없어」 → 「팔꿈치로 눌러」 「냄비 들고 있잖아」 → 「…그럼 코로」(9.24s)
// 편집본(12.2s): 「그럼 코로」부터 남자 얼굴로 다가가고, 대사 뒤 2.2초 입 다문 무표정으로 머문 뒤 흰 페이드(hooks_v6_fixed/03_장갑_수정.mp4).
const H3: HookSpec = { src: "reel3_hook_v6_gloves.mp4", segs: [[0, 12.2]], captionAt: 9.3, caption: "요리 중에 화면 꺼지면\n진짜 난감하죠" };

// 04 AI 식단 ← 「돈이 너무 많이 나갔네」 → 월 치킨·화 치킨·수 피자·목 족발 → 「금요일도 치킨」(10.32s) → 「그냥 정하지 말자」 (원본 20.0s)
// 17.3s 에서 자른다 — 둘이 웃고 난 뒤 남자가 굳은 채 앉아 있는 꼬리가 길다(사용자 요청, 2026-10-23).
const H4: HookSpec = { src: "reel4_hook_v6_menu.mp4", segs: [[0, 17.3]], captionAt: 10.4, caption: "일주일 식단 짜다가\n배달 메뉴판 완성" };

// 07 검증된 레시피 ← 빈 팬 앞에서 블로그 레시피를 내리며 「이 사람이 아직 제주도에 있어」 → 「아직 바다 보고 있어」 → 「…이제 귤 따러 갔어」
// 원본 9.25s 가 너무 빨라(사용자) 0.85배로 늦춘 편집본(10.875s, 목소리 높이 유지·표식 지움). 펀치 대사 「아직 바다 보고 있어」 원본 3.82s → 4.5s.
const H7: HookSpec = { src: "reel7_hook_v6_blog.mp4", segs: [[0, 10.8]], captionAt: 4.5, caption: "레시피 보려다\n남의 여행기만 봤어요" };

export const REELS_HOOK_V6 = [
  { id: "Reel2HookV6Cabbage", ...makeReel(H2, Reel2Demo, REEL2_DEMO_LEN, Reel2Cta, REEL2_CTA_LEN, REST_EXCL[1]) },
  { id: "Reel3HookV6Gloves", ...makeReel(H3, Reel3Demo, REEL3_DEMO_LEN, Reel3Cta, REEL3_CTA_LEN, REST_EXCL[2]) },
  { id: "Reel4HookV6Menu", ...makeReel(H4, Reel4Demo, REEL4_DEMO_LEN, Reel4Cta, REEL4_CTA_LEN, REST_EXCL[3]) },
  { id: "Reel7HookV6Blog", ...makeReel(H7, Reel7Demo, REEL7_DEMO_LEN, Reel7Cta, REEL7_CTA_LEN, REST_EXCL[6]) },
];
