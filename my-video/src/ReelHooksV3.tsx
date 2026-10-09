import { makeReel, type HookSpec } from "./ReelHooksV2";
import { Reel1Demo, Reel1Cta, REEL1_DEMO_LEN, REEL1_CTA_LEN } from "./Reel1Receipt";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel3Demo, Reel3Cta, REEL3_DEMO_LEN, REEL3_CTA_LEN } from "./Reel3CookMode";
import { Reel4Demo, Reel4Cta, REEL4_DEMO_LEN, REEL4_CTA_LEN } from "./Reel4AiDiet";
import { Reel5Demo, Reel5Cta, REEL5_DEMO_LEN, REEL5_CTA_LEN } from "./Reel5ExpiryAlert";
import { Reel6Demo, Reel6Cta, REEL6_DEMO_LEN, REEL6_CTA_LEN } from "./Reel6ChatbotDemo";
import { Reel7Demo, Reel7Cta, REEL7_DEMO_LEN, REEL7_CTA_LEN } from "./Reel7RealRecipe";
import { Reel8Demo, Reel8Cta, REEL8_DEMO_LEN, REEL8_CTA_LEN } from "./Reel8FamilySavings";

// 후킹 v3 — store/REEL_HOOKS_V3.md 프롬프트로 만든 제미나이 클립을 각 편 앞에 붙인다(2026-10-10 사용자가 8편 중 5편 먼저 전달).
// v2 와 같이 훅은 자르지 않고 원본 그대로(끝 페이드만), 자막은 문서의 「자막 띄울 순간」(웃음 포인트)부터.
// 편 번호 = 앱 데모 번호(01 사진 인식, 02 매칭, 03 요리 모드, 04 AI 식단, 05 유통기한, 06 요리 AI, 07 진짜 레시피, 08 가족).
// 06·07·08 은 사용자가 편집해 둔 v3 클립(public 에 이미 있던 것과 같은 파일).

// 01 ← 냉장고 앞에서 전화하며 "계란 있어? 없어?" → 계란판에 한 알 "한 개 있어" (10.0s, 원본 424x720 — 화면에 맞춰 확대되어 약간 부드러움)
const H1: HookSpec = { src: "reel1_hook_v3_egg.mov", segs: [[0, 10.0]], captionAt: 6.8, caption: "냉장고 사정,\n아직도 전화로 물어봐요?" };
// 02 ← 계란·밥·소시지·치즈 앞 부부 "이걸로 뭐 되나 보고 있어" (10.0s)
const H2: HookSpec = { src: "reel2_hook_v3_lineup.mp4", segs: [[0, 10.0]], captionAt: 5.0, caption: "재료는 있는데\n요리가 안 떠올라요" };
// 03 ← 손에 양념 묻은 채 "화면 좀 올려줄래? … 너무 올렸어. 아니 아니 아니" (10.0s)
const H3: HookSpec = { src: "reel3_hook_v3_scroll.mp4", segs: [[0, 10.0]], captionAt: 8.4, caption: "손이 바쁠 땐\n레시피도 못 넘겨요" };
// 04 ← 장 봐 온 아내가 "또 장 봤어? 응, 이번 주 거야" 냉장고 문을 등으로 막음 (10.0s)
const H4: HookSpec = { src: "reel4_hook_v3_fridgedoor.mp4", segs: [[0, 10.0]], captionAt: 6.0, caption: "이번 주도\n장을 너무 많이 봤어요" };
// 05 ← "이 우유 먹어도 되겠지? 냄새가 이상한데?" → "응 자기 많이 먹어"(편집본, 8.7s)
const H5: HookSpec = { src: "reel5_hook_v3_milk.mp4", segs: [[0, 8.7]], captionAt: 6.8, caption: "유통기한,\n아직도 냄새로 확인해요?" };

// 06 ← 엄마와 전화 "두부랑 애호박 있는데 뭐 해 먹지?" "된장찌개 하면 되지" "그걸 왜 맨날 나한테 물어봐" (10.2s)
const H6: HookSpec = { src: "reel6_hook_v3_mom.mp4", segs: [[0, 10.2]], captionAt: 5.2, caption: "엄마 말고\n물어볼 데 없나요?" };
// 07 ← 찜닭 먹으며 "근데 자기야, 이거 뭐야?" "찜닭인데" "아 찜닭" (10.0s)
const H7: HookSpec = { src: "reel7_hook_v3_jjimdak.mp4", segs: [[0, 10.0]], captionAt: 4.0, caption: "레시피대로 했는데\n왜 이렇게 됐지?" };
// 08 ← 로비에서 배달원과 "아 안녕하세요!" 반복 → 「또 뵙네요」 (10.0s)
const H8: HookSpec = { src: "reel8_hook_v3_lobby.mp4", segs: [[0, 10.0]], captionAt: 5.6, caption: "배달 기사님이\n우리 얼굴을 알아요" };

export const REELS_HOOK_V3 = [
  { id: "Reel1HookV3Egg", ...makeReel(H1, Reel1Demo, REEL1_DEMO_LEN, Reel1Cta, REEL1_CTA_LEN) },
  { id: "Reel2HookV3Lineup", ...makeReel(H2, Reel2Demo, REEL2_DEMO_LEN, Reel2Cta, REEL2_CTA_LEN) },
  { id: "Reel3HookV3Scroll", ...makeReel(H3, Reel3Demo, REEL3_DEMO_LEN, Reel3Cta, REEL3_CTA_LEN) },
  { id: "Reel4HookV3FridgeDoor", ...makeReel(H4, Reel4Demo, REEL4_DEMO_LEN, Reel4Cta, REEL4_CTA_LEN) },
  { id: "Reel5HookV3Milk", ...makeReel(H5, Reel5Demo, REEL5_DEMO_LEN, Reel5Cta, REEL5_CTA_LEN) },
  { id: "Reel6HookV3Mom", ...makeReel(H6, Reel6Demo, REEL6_DEMO_LEN, Reel6Cta, REEL6_CTA_LEN) },
  { id: "Reel7HookV3Jjimdak", ...makeReel(H7, Reel7Demo, REEL7_DEMO_LEN, Reel7Cta, REEL7_CTA_LEN) },
  { id: "Reel8HookV3Lobby", ...makeReel(H8, Reel8Demo, REEL8_DEMO_LEN, Reel8Cta, REEL8_CTA_LEN) },
];
