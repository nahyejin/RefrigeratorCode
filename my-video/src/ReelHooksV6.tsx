import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { FONT_FAMILY, WHITE, YELLOW, useCustomFont } from "./shared";
import { RestFeatures, restLen, REST_EXCL } from "./RestFeatures";
import { Reel2Demo, Reel2Cta, REEL2_DEMO_LEN, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel4Demo, Reel4Cta, REEL4_DEMO_LEN, REEL4_CTA_LEN } from "./Reel4AiDiet";

// 후킹 v6(2026-10-23) — store/REEL_HOOKS_V6.md 프롬프트로 사용자가 뽑은 제미나이 클립 중 살린 두 편.
// 클립은 편집본(my-video/public/hooks_v6_fixed 에서 확대·글자 지우기·라벨 블러 후 사용자가 확인한 파일).
// 구성: 후킹(원본 처음부터 끝까지, 끝 0.8s 흰 페이드) → 그 편 기능 데모 → 끝 화면 → 나머지 기능 7가지 → 끝 화면 한 번 더.
// 자막: ① 썸네일 후킹 자막 — 첫 프레임부터 화면 가운데 큰 노란 2줄(COOKING_REEL_GUIDE 0-1, v4 부터 후킹 영상도 같은 규칙)
//       ② 대사 자막 — Whisper(medium) 단어 시각 실측, 흰 글자(요리 릴스 Said 모양)
// BGM: 기존 루틴대로 렌더 뒤 scripts/add_bgm.py(--engine 3, 대사·나레이션이 나오면 자동으로 낮아짐)로 깐다 — scripts/render_hooks_v6.sh.

const sec = (s: number) => Math.round(s * 30);
const HOOK_FADE_OUT = 24;
const THUMB_LEN = sec(2.8);
const CTA2_LEN = 120;

type Line = { at: number; to: number; text: string };
type Spec = { src: string; len: number; thumb: string; lines: Line[] };

// 02 매칭 ← 「오늘 저녁 뭐 먹어?」 「양배추 반 통이랑 소시지? 이게 다야」 「뒤에 저건 다 뭔데?」 (원본 10.0s)
const H2: Spec = {
  src: "reel2_hook_v6_cabbage.mp4",
  len: 10.0,
  thumb: "먹을 게 없다더니\n뒤에 이게 다 뭐야?",
  lines: [
    { at: 0.0, to: 1.6, text: "오늘 저녁 뭐 먹어?" },
    { at: 2.26, to: 4.6, text: "음... 양배추 반 통이랑\n소시지?" },
    { at: 4.66, to: 6.06, text: "이게 다야.\n뭐 해 먹지?" },
    { at: 6.08, to: 7.4, text: "...뒤에 저건 다 뭔데?" },
    { at: 7.54, to: 9.3, text: "어? 저거 언제 샀지?" },
  ],
};

// 04 AI 식단 ← 「돈이 너무 많이 나갔네」 → 월요일 치킨·화요일도 치킨·수요일 피자·목요일 족발·금요일도 치킨 → 「그냥 정하지 말자」 (원본 20.0s)
const H4: Spec = {
  src: "reel4_hook_v6_menu.mp4",
  len: 20.0,
  thumb: "일주일 식단 짰는데\n왜 다 배달이야?",
  lines: [
    { at: 0.0, to: 1.48, text: "돈이 너무 많이 나갔네..." },
    { at: 1.48, to: 3.7, text: "우리 이번 주 저녁 메뉴\n미리 정해 볼까?" },
    { at: 3.76, to: 4.56, text: "월요일은 뭐 먹을래?" },
    { at: 4.6, to: 5.4, text: "월요일은 치킨" },
    { at: 5.4, to: 6.0, text: "화요일은?" },
    { at: 6.06, to: 6.84, text: "화요일도 치킨" },
    { at: 6.84, to: 7.9, text: "수요일은 피자" },
    { at: 7.92, to: 8.75, text: "목요일은?" },
    { at: 8.82, to: 10.3, text: "족발" },
    { at: 10.32, to: 12.4, text: "금요일도 치킨" },
    { at: 13.0, to: 13.7, text: "음..." },
    { at: 13.72, to: 15.8, text: "그냥 정하지 말자" },
  ],
};

// 썸네일 후킹 자막 — 첫 프레임부터 꽉 보이게, 사라질 때만 페이드(요리 릴스 Hook 과 같은 모양)
const Thumb: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [THUMB_LEN - 6, THUMB_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 640, left: 40, right: 40, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: 118, fontWeight: 900, lineHeight: 1.18, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{text}</span>
    </div>
  );
};

// 대사 자막 — 화면 아래쪽 흰 글자(요리 릴스 Said 「mom」 모양)
const Said: React.FC<{ len: number; text: string }> = ({ len, text }) => {
  const local = useCurrentFrame();
  const o = interpolate(local, [0, 3, len - 3, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p = spring({ frame: local, fps: 30, config: { damping: 12, mass: 0.5 } });
  return (
    <div style={{ position: "absolute", top: 1380, left: 30, right: 30, textAlign: "center", opacity: o, transform: `scale(${interpolate(p, [0, 1], [0.88, 1])})`, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: 66, fontWeight: 900, lineHeight: 1.25, color: WHITE, textShadow: "0 4px 16px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.75)" }}>{text}</span>
    </div>
  );
};

const Hook: React.FC<{ s: Spec }> = ({ s }) => {
  const frame = useCurrentFrame();
  const total = sec(s.len);
  const fadeOut = interpolate(frame, [total - HOOK_FADE_OUT - 1, total - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <OffthreadVideo src={staticFile(s.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {s.lines.map((l, i) => (
          <Sequence key={i} from={sec(l.at)} durationInFrames={Math.max(6, sec(l.to) - sec(l.at))}>
            <Said len={Math.max(6, sec(l.to) - sec(l.at))} text={l.text} />
          </Sequence>
        ))}
        <Sequence from={0} durationInFrames={THUMB_LEN}>
          <Thumb text={s.thumb} />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const make = (s: Spec, Demo: React.FC, demoLen: number, Cta: React.FC<{ silent?: boolean }>, ctaLen: number, restIdx: number) => {
  const hLen = sec(s.len);
  const rLen = restLen(restIdx);
  const total = hLen + demoLen + ctaLen + rLen + CTA2_LEN;
  const restAt = hLen + demoLen + ctaLen;
  const Comp: React.FC = () => {
    useCustomFont();
    return (
      <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
        <Sequence from={0} durationInFrames={hLen} name="Hook">
          <Hook s={s} />
        </Sequence>
        <Sequence from={hLen} durationInFrames={demoLen} name="Demo">
          <Demo />
        </Sequence>
        <Sequence from={hLen + demoLen} durationInFrames={ctaLen} name="CTA">
          <Cta />
        </Sequence>
        <Sequence from={restAt} durationInFrames={rLen} name="Rest">
          <RestFeatures excl={restIdx} />
        </Sequence>
        <Sequence from={restAt + rLen} durationInFrames={CTA2_LEN} name="CTA-again">
          <Cta silent />
        </Sequence>
      </AbsoluteFill>
    );
  };
  return { Comp, total };
};

export const REELS_HOOK_V6 = [
  { id: "Reel2HookV6Cabbage", ...make(H2, Reel2Demo, REEL2_DEMO_LEN, Reel2Cta, REEL2_CTA_LEN, REST_EXCL[1]) },
  { id: "Reel4HookV6Menu", ...make(H4, Reel4Demo, REEL4_DEMO_LEN, Reel4Cta, REEL4_CTA_LEN, REST_EXCL[3]) },
];
