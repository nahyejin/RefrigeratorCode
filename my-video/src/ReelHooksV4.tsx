import { makeReel, type HookSpec } from "./ReelHooksV2";
import { Reel1Demo, Reel1Cta, REEL1_DEMO_LEN, REEL1_CTA_LEN } from "./Reel1Receipt";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel3Demo, Reel3Cta, REEL3_DEMO_LEN, REEL3_CTA_LEN } from "./Reel3CookMode";
import { Reel4Demo, Reel4Cta, REEL4_DEMO_LEN, REEL4_CTA_LEN } from "./Reel4AiDiet";
import { Reel5Demo, Reel5Cta, REEL5_DEMO_LEN, REEL5_CTA_LEN } from "./Reel5ExpiryAlert";
import { Reel6Demo, Reel6Cta, REEL6_DEMO_LEN, REEL6_CTA_LEN } from "./Reel6ChatbotDemo";
import { Reel7Demo, Reel7Cta, REEL7_DEMO_LEN, REEL7_CTA_LEN } from "./Reel7RealRecipe";
import { Reel8Demo, Reel8Cta, REEL8_DEMO_LEN, REEL8_CTA_LEN } from "./Reel8FamilySavings";

// 후킹 v4 — 2026-10-10 사용자가 보내 준 제미나이 새 클립 8편(각 편 앞 후킹) + 기존 1~8편 앱 데모·엔딩.
// v2 와 같은 장면 구성(같은 대사)의 새 촬영본이라 편 매칭은 대사·장면으로 했다(Whisper 로 대사 시각 실측).
// 훅은 자르지 않고 원본을 처음부터 끝까지(끝 페이드만) 쓴다 — v2 와 같은 방침(HookV2 컴포넌트 재사용).
// 자막은 웃음 포인트(대사 직후)부터 — 0초부터 띄우면 결말을 미리 말한다.

// 01 사진 인식 ← 마트에서 두부 두 팩 들고 "두부 있었던 것 같은데?" (10.0s)
const H1: HookSpec = { src: "reel1_hook_v4_tofu.mp4", segs: [[0, 10.0]], captionAt: 3.0, caption: "마트만 오면\n기억이 안 나요" };
// 02 매칭 ← 냉장고 열고 "아 진짜 먹을 게 없네" (10.0s)
const H2: HookSpec = { src: "reel2_hook_v4_fridge.mp4", segs: [[0, 10.0]], captionAt: 5.0, caption: "냉장고는 몇 번을 열어도\n그대로예요" };
// 03 요리 모드 ← 반죽 묻은 손 "아 안 넘어가네… 아 코로 넘겨?" (8.2s)
const H3: HookSpec = { src: "reel3_hook_v4_dough.mov", segs: [[0, 8.2]], captionAt: 5.0, caption: "반죽 묻은 손으로\n레시피 넘겨 본 적 있죠?" };
// 04 AI 식단 ← 장바구니·냉장고에서 대파 "아 뭐야, 대파 있었네" (10.0s)
const H4: HookSpec = { src: "reel4_hook_v4_greenonion.mp4", segs: [[0, 10.0]], captionAt: 6.2, caption: "있는 줄 모르고\n또 샀어요" };
// 05 유통기한 ← 냉장고 앞 "이거 언제 샀더라?" (6.3s)
const H5: HookSpec = { src: "reel5_hook_v4_zucchini.mov", segs: [[0, 6.3]], captionAt: 3.3, caption: "사 놓고 잊은 재료,\n우리 집에도 있죠" };
// 06 요리 AI ← 소파 커플 "뭐 먹을래?" "아무거나" … 세 번 퇴짜 (10.0s, 대사 0~9.0s)
const H6: HookSpec = { src: "reel6_hook_v4_anything.mp4", segs: [[0, 10.0]], captionAt: 8.2, caption: "아무거나의 정답,\n물어보세요" };
// 07 진짜 레시피 ← "적당히? 적당히가 얼만데?" (10.0s)
const H7: HookSpec = { src: "reel7_hook_v4_salt.mp4", segs: [[0, 10.0]], captionAt: 4.0, caption: "레시피가\n친절하지 않을 때" };
// 08 가족·아낀 돈 ← 배달 용기 탑 "어휴, 쓰러지겠다" (9.7s)
const H8: HookSpec = { src: "reel8_hook_v4_takeout.mov", segs: [[0, 9.7]], captionAt: 5.5, caption: "이번 달 배달 용기,\n몇 개예요?" };

export const REELS_HOOK_V4 = [
  { id: "Reel1HookV4Tofu", ...makeReel(H1, Reel1Demo, REEL1_DEMO_LEN, Reel1Cta, REEL1_CTA_LEN) },
  { id: "Reel2HookV4Fridge", ...makeReel(H2, Reel2Demo, REEL2_DEMO_LEN, Reel2Cta, REEL2_CTA_LEN) },
  { id: "Reel3HookV4Dough", ...makeReel(H3, Reel3Demo, REEL3_DEMO_LEN, Reel3Cta, REEL3_CTA_LEN) },
  { id: "Reel4HookV4GreenOnion", ...makeReel(H4, Reel4Demo, REEL4_DEMO_LEN, Reel4Cta, REEL4_CTA_LEN) },
  { id: "Reel5HookV4Zucchini", ...makeReel(H5, Reel5Demo, REEL5_DEMO_LEN, Reel5Cta, REEL5_CTA_LEN) },
  { id: "Reel6HookV4Anything", ...makeReel(H6, Reel6Demo, REEL6_DEMO_LEN, Reel6Cta, REEL6_CTA_LEN) },
  { id: "Reel7HookV4Salt", ...makeReel(H7, Reel7Demo, REEL7_DEMO_LEN, Reel7Cta, REEL7_CTA_LEN) },
  { id: "Reel8HookV4Takeout", ...makeReel(H8, Reel8Demo, REEL8_DEMO_LEN, Reel8Cta, REEL8_CTA_LEN) },
];
