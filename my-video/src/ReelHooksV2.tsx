import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY, WHITE, useCustomFont, Caption } from "./shared";
import { Reel1Demo, Reel1Cta, REEL1_DEMO_LEN, REEL1_CTA_LEN } from "./Reel1Receipt";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel3Demo, Reel3Cta, REEL3_DEMO_LEN, REEL3_CTA_LEN } from "./Reel3CookMode";
import { Reel4Demo, Reel4Cta, REEL4_DEMO_LEN, REEL4_CTA_LEN } from "./Reel4AiDiet";
import { Reel5Demo, Reel5Cta, REEL5_DEMO_LEN, REEL5_CTA_LEN } from "./Reel5ExpiryAlert";

// 후킹 v2(store/REEL_HOOKS_V2.md 프롬프트로 만든 제미나이 실사 클립) + 기존 1~5편의 앱 데모·엔딩을 그대로 이어붙인 버전.
// 데모 쪽 자막·나레이션·CTA는 원래 편과 완전히 같고, 앞의 후킹만 바뀐다.
// 훅 클립은 전부 720x1280 24fps(캔버스와 같은 9:16) — 실제 대사 구간은 Whisper 단어 타임스탬프 + 음량으로 실측했다.
// 같은 테이크 안에서 군더더기 구간을 뺄 때는 정지 화면 없이 바로 하드컷한다(06편에서 확인한 방침).

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

// 01편 사진 인식 ← 마트에서 두부 두 모 들고 "두부 있었던 것 같은데?"(0~3.3s)
// 폰 확인·저울질(~5.8s)까지 쓰고, 멍하니 서 있는 구간을 건너 마지막 두부 푸시인(9~10s)으로 하드컷.
const HOOK1: HookSpec = {
  src: "reel1_hook_v2_tofu.mp4",
  segs: [
    [0, 5.8],
    [9.0, 10.0],
  ],
  caption: "마트만 오면\n기억이 안 나요",
};

// 02편 매칭 ← 냉장고 열고 "아 진짜 먹을 게 없네"(1.6~4.1s) → 닫았다가 다시 열기 → 폰 쪽으로 손.
// 닫힌 문 앞에 서 있는 틈(4.9~5.6s)과 다시 연 뒤 멍하니 보는 뒷부분(8~9.2s)만 건너뛴다.
const HOOK2: HookSpec = {
  src: "reel2_hook_v2_fridge.mp4",
  segs: [
    [0.3, 4.9],
    [5.6, 8.0],
    [9.2, 10.0],
  ],
  caption: "냉장고는 몇 번을 열어도\n그대로예요",
};

// 03편 요리 모드 ← 반죽 묻은 손가락 관절로 폰 누르기 → "아 왜 안 눌려?"(4.1~6.0s) → 코를 들이밀며 "아 코로 해야 되나?"(7.9~8.7s).
// 앞쪽 손만 보는 1.2초와, 몸을 숙이는 중간(6.2~7.0s)만 덜어낸다.
const HOOK3: HookSpec = {
  src: "reel3_hook_v2_dough.mp4",
  segs: [
    [1.2, 6.2],
    [7.0, 10.0],
  ],
  caption: "반죽 묻은 손으로\n레시피 넘겨 본 적 있죠?",
};

// 04편 AI 식단 ← 장바구니에서 대파 꺼내기 → 냉장고에서 대파 두 단 더 발견 "아 뭐야… 대파 있었네"(5.2~8.5s) → 세 단 꽃다발 푸시인.
// 대파 들고 냉장고 쪽으로 몸 돌리는 이동 구간(2.3~3.0s)만 건너뛴다.
const HOOK4: HookSpec = {
  src: "reel4_hook_v2_greenonion.mp4",
  segs: [
    [0.8, 2.3],
    [3.0, 10.0],
  ],
  caption: "있는 줄 모르고\n또 샀어요",
};

// 05편 유통기한 알림 ← 야채칸에서 물러진 애호박 꺼내 보며 "이거 언제 샀더라"(4.6~5.6s). 원본이 6.3s로 짧아 앞 1초만 덜어낸다.
const HOOK5: HookSpec = {
  src: "reel5_hook_v2_zucchini.mov",
  segs: [[1.0, 6.3]],
  caption: "사 놓고 잊은 재료,\n우리 집에도 있죠",
};

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
  { id: "Reel4HookV2GreenOnion", ...makeReel(HOOK4, Reel4Demo, REEL4_DEMO_LEN, Reel4Cta, REEL4_CTA_LEN) },
  { id: "Reel5HookV2Zucchini", ...makeReel(HOOK5, Reel5Demo, REEL5_DEMO_LEN, Reel5Cta, REEL5_CTA_LEN) },
];
