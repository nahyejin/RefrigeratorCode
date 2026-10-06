import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY, WHITE, useCustomFont, Caption } from "./shared";
import { Reel1Demo, Reel1Cta, REEL1_DEMO_LEN, REEL1_CTA_LEN } from "./Reel1Receipt";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel3Demo, Reel3Cta, REEL3_DEMO_LEN, REEL3_CTA_LEN } from "./Reel3CookMode";
import { Reel4Demo, Reel4Cta, REEL4_DEMO_LEN, REEL4_CTA_LEN } from "./Reel4AiDiet";
import { Reel5Demo, Reel5Cta, REEL5_DEMO_LEN, REEL5_CTA_LEN } from "./Reel5ExpiryAlert";
import { Reel6Demo, Reel6Cta, REEL6_DEMO_LEN, REEL6_CTA_LEN } from "./Reel6ChatbotDemo";
import { Reel7Demo, Reel7Cta, REEL7_DEMO_LEN, REEL7_CTA_LEN } from "./Reel7RealRecipe";
import { Reel8Demo, Reel8Cta, REEL8_DEMO_LEN, REEL8_CTA_LEN } from "./Reel8FamilySavings";

// 후킹 v2(store/REEL_HOOKS_V2.md 프롬프트로 만든 제미나이 실사 클립) + 기존 1~8편의 앱 데모·엔딩을 그대로 이어붙인 버전.
// 데모 쪽 자막·나레이션·CTA는 원래 편과 완전히 같고, 앞의 후킹만 바뀐다.
// 훅 클립은 전부 720x1280 24fps(캔버스와 같은 9:16). 사용자 요청(2026-10-06)으로 훅은 자르지 않고 원본을
// 처음부터 끝까지 그대로 쓴다 — 처음엔 군더더기 구간을 하드컷했더니 「뒤쪽이 다 잘렸다」는 지적. 끝 페이드만 남긴다.

type Seg = [number, number] | [number, number, { zoom: number; origin: string }]; // 원본 초 단위 [시작, 끝, (확대)]

type HookSpec = {
  src: string;
  segs: Seg[];
  // 자막이 뜨는 원본 시각(초) — 웃음 포인트(대사·반전)가 터지는 순간. 그 전에 자막이 먼저 뜨면 결말을 미리
  // 말해 버려 재미가 없다는 지적(2026-10-06, 대파 편)으로 0초 고정에서 바꿨다. 실제 대사 시각은 silencedetect·Whisper로 실측.
  captionAt: number;
  caption: string;
};

const sec = (s: number) => Math.round(s * 30);
const segLen = (seg: Seg) => sec(seg[1]) - sec(seg[0]);
const hookLen = (h: HookSpec) => h.segs.reduce((t, s) => t + segLen(s), 0);

// 원본 시각 → 편집된 훅 타임라인 프레임(빠진 구간을 건너뛴 위치)
const toTimeline = (h: HookSpec, t: number) => {
  let acc = 0;
  for (const seg of h.segs) {
    if (t < seg[1]) return acc + Math.max(0, sec(t) - sec(seg[0]));
    acc += segLen(seg);
  }
  return acc;
};

const HOOK_FADE_OUT = 24; // 훅 끝 0.8s만 흰 화면으로 페이드 — 데모로 뚝 끊기지 않게(기존 편과 동일)

// 끝 초는 원본 길이를 넘지 않게 0.1초 단위로 내림한 값(원본 길이는 주석).

// 01편 사진 인식 ← 마트에서 두부 두 모 들고 "두부 있었던 것 같은데?" → 저울질 → 두부 푸시인 (원본 10.0s)
const HOOK1: HookSpec = { src: "reel1_hook_v2_tofu.mp4", segs: [[0, 10.0]], captionAt: 3.4, caption: "마트만 오면\n기억이 안 나요" };

// 02편 매칭 ← 냉장고 열고 "아 진짜 먹을 게 없네" → 닫았다 다시 열기 → 폰 쪽으로 손 (원본 10.0s)
// 생성 오류로 6.0s쯤(카메라가 살짝 돌 때)부터 왼쪽 아래 조리대에 폰이 하나 더 생긴다 — 그 직전(5.9s, 문 닫히고
// 손 뻗는 순간)부터 오른쪽 위 기준 1.3배 펀치인으로 조리대를 화면 밖으로 밀어낸다(사용자 선택, 2026-10-06).
const HOOK2: HookSpec = {
  src: "reel2_hook_v2_fridge.mp4",
  segs: [
    [0, 5.9],
    [5.9, 10.0, { zoom: 1.3, origin: "right top" }],
  ],
  captionAt: 6.5, caption: "냉장고는 몇 번을 열어도\n그대로예요",
};

// 03편 요리 모드(B안 — A안은 사용자가 빼서 이것만 씀, 2026-10-06) ← "아 안 넘어가네…" → "아 코로 넘겨?" → 코 들이밀기 (원본 8.22s)
const HOOK3B: HookSpec = { src: "reel3_hook_v2_dough_b.mov", segs: [[0, 8.2]], captionAt: 5.6, caption: "반죽 묻은 손으로\n레시피 넘겨 본 적 있죠?" };

// 04편 AI 식단 ← 장바구니에서 대파 → 냉장고에 두 단 더 "대파 있었네" → 세 단 꽃다발 푸시인 (원본 10.0s)
// 한때 01 사진 인식에 붙였다가 8편이 데모 하나씩 갖도록 다시 04로(사용자, 2026-10-06).
// 「연기가 어색하다」는 지적 — 카메라 쪽으로 고개를 돌려 입을 크게 벌리는 4.9~6.0s(「아 뭐야」)만 하드컷으로 빼고,
// 「대파 있었네」와 꽃다발 푸시인은 그대로 둔다. 잘리는 양끝은 둘 다 대사 없는 구간이다.
const HOOK4: HookSpec = {
  src: "reel4_hook_v2_greenonion.mp4",
  segs: [
    [0, 4.9],
    [6.0, 10.0],
  ],
  captionAt: 7.2, caption: "있는 줄 모르고\n또 샀어요",
};

// 05편 유통기한 알림 ← 야채칸에서 물러진 애호박 꺼내 보며 "이거 언제 샀더라" (원본 6.33s)
const HOOK5: HookSpec = { src: "reel5_hook_v2_zucchini.mov", segs: [[0, 6.3]], captionAt: 4.6, caption: "사 놓고 잊은 재료,\n우리 집에도 있죠" };

// 06편 요리 AI ← 소파 커플 "뭐 먹을래?" "아무거나" … 김치찌개·된장찌개·제육볶음 세 번 퇴짜 → 남자 멍한 얼굴 (원본 10.0s)
const HOOK6: HookSpec = { src: "reel6_hook_v2_anything.mp4", segs: [[0, 10.0]], captionAt: 7.7, caption: "아무거나의 정답,\n물어보세요" };

// 07편 진짜 레시피 ← 소금 숟가락 들고 "적당히? 적당히가 얼만데" → 떨리는 손으로 소금 덜어내기 (원본 10.0s)
const HOOK7: HookSpec = { src: "reel7_hook_v2_salt.mp4", segs: [[0, 10.0]], captionAt: 3.5, caption: "레시피가\n친절하지 않을 때" };

// 08편 가족·아낀 돈 ← 배달 용기 탑 들고 복도 걸어오며 "어후, 쓰러지겠다, 쓰러지겠어" → 탑 푸시인 (원본 9.70s)
const HOOK8: HookSpec = { src: "reel8_hook_v2_takeout.mov", segs: [[0, 9.7]], captionAt: 4.1, caption: "이번 달 배달 용기,\n몇 개예요?" };

const HookV2: React.FC<{ spec: HookSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const total = hookLen(spec);
  const captionFrom = toTimeline(spec, spec.captionAt);
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
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: seg[2] ? `scale(${seg[2].zoom})` : undefined,
                  transformOrigin: seg[2]?.origin,
                }}
              />
            </Sequence>
          );
        })}
        {/* 자막은 웃음 포인트부터 훅 끝까지 — 영상과 같이 흰 화면으로 페이드된다 */}
        <Caption from={captionFrom} len={total - captionFrom} text={spec.caption} />
      </AbsoluteFill>
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
  { id: "Reel4HookV2GreenOnion", ...makeReel(HOOK4, Reel4Demo, REEL4_DEMO_LEN, Reel4Cta, REEL4_CTA_LEN) },
  { id: "Reel5HookV2Zucchini", ...makeReel(HOOK5, Reel5Demo, REEL5_DEMO_LEN, Reel5Cta, REEL5_CTA_LEN) },
  { id: "Reel3HookV2DoughB", ...makeReel(HOOK3B, Reel3Demo, REEL3_DEMO_LEN, Reel3Cta, REEL3_CTA_LEN) },
  { id: "Reel6HookV2Anything", ...makeReel(HOOK6, Reel6Demo, REEL6_DEMO_LEN, Reel6Cta, REEL6_CTA_LEN) },
  { id: "Reel7HookV2Salt", ...makeReel(HOOK7, Reel7Demo, REEL7_DEMO_LEN, Reel7Cta, REEL7_CTA_LEN) },
  { id: "Reel8HookV2Takeout", ...makeReel(HOOK8, Reel8Demo, REEL8_DEMO_LEN, Reel8Cta, REEL8_CTA_LEN) },
];
