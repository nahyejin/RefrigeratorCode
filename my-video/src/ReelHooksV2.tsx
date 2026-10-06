import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY, WHITE, useCustomFont, Caption } from "./shared";
import { Reel1Demo, Reel1Cta, REEL1_DEMO_LEN, REEL1_CTA_LEN } from "./Reel1Receipt";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel3Demo, Reel3Cta, REEL3_DEMO_LEN, REEL3_CTA_LEN } from "./Reel3CookMode";
import { Reel5Demo, Reel5Cta, REEL5_DEMO_LEN, REEL5_CTA_LEN } from "./Reel5ExpiryAlert";
import { Reel6Demo, Reel6Cta, REEL6_DEMO_LEN, REEL6_CTA_LEN } from "./Reel6ChatbotDemo";
import { Reel7Demo, Reel7Cta, REEL7_DEMO_LEN, REEL7_CTA_LEN } from "./Reel7RealRecipe";
import { Reel8Demo, Reel8Cta, REEL8_DEMO_LEN, REEL8_CTA_LEN } from "./Reel8FamilySavings";

// 후킹 v2(store/REEL_HOOKS_V2.md 프롬프트로 만든 제미나이 실사 클립) + 기존 1~8편의 앱 데모·엔딩을 그대로 이어붙인 버전.
// 데모 쪽 자막·나레이션·CTA는 원래 편과 완전히 같고, 앞의 후킹만 바뀐다.
// 훅 클립은 전부 720x1280 24fps(캔버스와 같은 9:16). 사용자 요청(2026-10-06)으로 훅은 자르지 않고 원본을
// 처음부터 끝까지 그대로 쓴다 — 처음엔 군더더기 구간을 하드컷했더니 「뒤쪽이 다 잘렸다」는 지적. 끝 페이드만 남긴다.

type Seg = [number, number]; // 원본 초 단위 [시작, 끝]

type HookSpec = {
  src: string;
  segs: Seg[];
  caption: string;
};

const sec = (s: number) => Math.round(s * 30);
const segLen = ([a, b]: Seg) => sec(b) - sec(a);
const hookLen = (h: HookSpec) => h.segs.reduce((t, s) => t + segLen(s), 0);

const HOOK_FADE_OUT = 24; // 훅 끝 0.8s만 흰 화면으로 페이드 — 데모로 뚝 끊기지 않게(기존 편과 동일)
const CAPTION_CLEAR = 30; // 마지막 1초(푸시인 대상이 화면 아래쪽에 오는 순간)는 자막을 걷어서 가리지 않는다

// 끝 초는 원본 길이를 넘지 않게 0.1초 단위로 내림한 값(원본 길이는 주석).

// 01편 사진 인식 ← 마트에서 두부 두 모 들고 "두부 있었던 것 같은데?" → 저울질 → 두부 푸시인 (원본 10.0s)
const HOOK1: HookSpec = { src: "reel1_hook_v2_tofu.mp4", segs: [[0, 10.0]], caption: "마트만 오면\n기억이 안 나요" };

// 02편 매칭 ← 냉장고 열고 "아 진짜 먹을 게 없네" → 닫았다 다시 열기 → 폰 쪽으로 손 (원본 10.0s)
const HOOK2: HookSpec = { src: "reel2_hook_v2_fridge.mp4", segs: [[0, 10.0]], caption: "냉장고는 몇 번을 열어도\n그대로예요" };

// 03편 요리 모드 ← 반죽 손으로 폰 누르기 "아 왜 안 눌려?" → 코 들이밀며 "아 코로 해야 되나?" (원본 10.0s)
const HOOK3: HookSpec = { src: "reel3_hook_v2_dough.mp4", segs: [[0, 10.0]], caption: "반죽 묻은 손으로\n레시피 넘겨 본 적 있죠?" };

// 03편 B안 ← 다른 배우·다른 테이크. "아 안 넘어가네…" → "아 코로 넘겨?" → 코 들이밀기 (원본 8.22s)
const HOOK3B: HookSpec = { src: "reel3_hook_v2_dough_b.mov", segs: [[0, 8.2]], caption: "반죽 묻은 손으로\n레시피 넘겨 본 적 있죠?" };

// 01편 사진 인식 B안 ← 장바구니에서 대파 → 냉장고에 두 단 더 "아 뭐야… 대파 있었네" → 세 단 꽃다발 푸시인 (원본 10.0s)
// 기획은 04 AI 식단이었지만, 「있는 줄 모르고 또 산」 상황엔 사진 한 장으로 냉장고를 채워 두는 01 데모가 더 맞다는 사용자 판단(2026-10-06).
const HOOK1B: HookSpec = { src: "reel1_hook_v2_greenonion.mp4", segs: [[0, 10.0]], caption: "있는 줄 모르고\n또 샀어요" };

// 05편 유통기한 알림 ← 야채칸에서 물러진 애호박 꺼내 보며 "이거 언제 샀더라" (원본 6.33s)
const HOOK5: HookSpec = { src: "reel5_hook_v2_zucchini.mov", segs: [[0, 6.3]], caption: "사 놓고 잊은 재료,\n우리 집에도 있죠" };

// 06편 요리 AI ← 소파 커플 "뭐 먹을래?" "아무거나" … 김치찌개·된장찌개·제육볶음 세 번 퇴짜 → 남자 멍한 얼굴 (원본 10.0s)
const HOOK6: HookSpec = { src: "reel6_hook_v2_anything.mp4", segs: [[0, 10.0]], caption: "아무거나의 정답,\n물어보세요" };

// 07편 진짜 레시피 ← 소금 숟가락 들고 "적당히? 적당히가 얼만데" → 떨리는 손으로 소금 덜어내기 (원본 10.0s)
const HOOK7: HookSpec = { src: "reel7_hook_v2_salt.mp4", segs: [[0, 10.0]], caption: "레시피가\n친절하지 않을 때" };

// 08편 가족·아낀 돈 ← 배달 용기 탑 들고 복도 걸어오며 "어후, 쓰러지겠다, 쓰러지겠어" → 탑 푸시인 (원본 9.70s)
const HOOK8: HookSpec = { src: "reel8_hook_v2_takeout.mov", segs: [[0, 9.7]], caption: "이번 달 배달 용기,\n몇 개예요?" };

const HookV2: React.FC<{ spec: HookSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const total = hookLen(spec);
  const fadeOut = interpolate(frame, [total - HOOK_FADE_OUT - 1, total - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        {spec.segs.map((seg, i) => {
          const len = segLen(seg);
          const start = from;
          from += len;
          return (
            <Sequence key={i} from={start} durationInFrames={len} name={`hook-${i + 1}`}>
              {/* 훅은 배우의 실제 대사 음성을 살린다(기존 편과 같은 방침) */}
              <OffthreadVideo
                src={staticFile(spec.src)}
                trimBefore={sec(seg[0])}
                trimAfter={sec(seg[1])}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Sequence>
          );
        })}
      </AbsoluteFill>
      <Caption from={0} len={total - CAPTION_CLEAR} text={spec.caption} />
    </AbsoluteFill>
  );
};

const makeReel = (spec: HookSpec, Demo: React.FC, demoLen: number, Cta: React.FC, ctaLen: number) => {
  const hLen = hookLen(spec);
  const Comp: React.FC = () => {
    useCustomFont();
    return (
      <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
        <Sequence from={0} durationInFrames={hLen} name="Hook">
          <HookV2 spec={spec} />
        </Sequence>
        <Sequence from={hLen} durationInFrames={demoLen} name="Demo">
          <Demo />
        </Sequence>
        <Sequence from={hLen + demoLen} durationInFrames={ctaLen} name="CTA">
          <Cta />
        </Sequence>
      </AbsoluteFill>
    );
  };
  return { Comp, total: hLen + demoLen + ctaLen };
};

export const REELS_HOOK_V2 = [
  { id: "Reel1HookV2Tofu", ...makeReel(HOOK1, Reel1Demo, REEL1_DEMO_LEN, Reel1Cta, REEL1_CTA_LEN) },
  { id: "Reel2HookV2Fridge", ...makeReel(HOOK2, Reel2Demo, REEL2_DEMO_LEN, Reel2Cta, REEL2_CTA_LEN) },
  { id: "Reel3HookV2Dough", ...makeReel(HOOK3, Reel3Demo, REEL3_DEMO_LEN, Reel3Cta, REEL3_CTA_LEN) },
  { id: "Reel1HookV2GreenOnion", ...makeReel(HOOK1B, Reel1Demo, REEL1_DEMO_LEN, Reel1Cta, REEL1_CTA_LEN) },
  { id: "Reel5HookV2Zucchini", ...makeReel(HOOK5, Reel5Demo, REEL5_DEMO_LEN, Reel5Cta, REEL5_CTA_LEN) },
  { id: "Reel3HookV2DoughB", ...makeReel(HOOK3B, Reel3Demo, REEL3_DEMO_LEN, Reel3Cta, REEL3_CTA_LEN) },
  { id: "Reel6HookV2Anything", ...makeReel(HOOK6, Reel6Demo, REEL6_DEMO_LEN, Reel6Cta, REEL6_CTA_LEN) },
  { id: "Reel7HookV2Salt", ...makeReel(HOOK7, Reel7Demo, REEL7_DEMO_LEN, Reel7Cta, REEL7_CTA_LEN) },
  { id: "Reel8HookV2Takeout", ...makeReel(HOOK8, Reel8Demo, REEL8_DEMO_LEN, Reel8Cta, REEL8_CTA_LEN) },
];
