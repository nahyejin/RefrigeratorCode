import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark } from "./ReelOverview";

// 요리 릴스 6편 — 마트에서 도아가 고른 쿠키 믹스로 집에서 쿠키 만들기(2026-11-05). 오감 놀이 각도(사용자).
// 마트(091212) → 저녁 먹으며 곰돌이 틀(102447) → 반죽 꾹·쑥(123514, 240fps) → 오븐 구경(123925·130041) → 다 구운 쿠키(131506) → 먹기·친구 나눠 주기(132155).
// 대사·시각은 받아쓰기(scripts/transcribe.py) 기준. 쿡매치 앱 녹화는 아직 없음 — 끝은 슬로건 → 그 밖에도.
// 원본은 public/cooking/쿠키_20261105/ (git 제외).

const DIR = "cooking/쿠키_20261105/work/";
const f = (s: number) => Math.round(s * 30);

type PackList = { title: string; items: { at: number; text: string; head?: boolean }[]; bottom?: boolean; small?: boolean; hint?: string };

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[]; talk?: { at: number; len: number; text: string; who: string }[]; think?: { at: number; len: number; text: string }[] }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string; pan?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[] }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 첫 장면 = 쿠키를 먹는 도아 + 후킹(육아 고민 「집에서 뭐 하지?」 + 해결)
const HOOK = { at: 0, len: 3.4, text: "아이랑 집에서 뭐 하지?\n쿠키 믹스 하나로\n오감 놀이 끝", sub: "반죽 꾹 · 틀 쏙 · 오븐 구경" };
const OPEN: Shot[] = [{ kind: "photo", src: "hook.jpg", len: f(3.4), origin: "50% 40%" }];

const STORY: Shot[] = [
  // 마트 장면 최소화(사용자 2026-11-05) — 「버스 모양 쿠키!」만
  { kind: "video", src: "store.mp4", from: 11.6, to: 14.6, audio: true, lines: [{ at: 0.1, len: 2.9, text: "마트에서 도아가 고른\n쿠키 믹스" }], talk: [
    { at: 1.2, len: 1.7, text: "버스 모양 쿠키!", who: "" },
  ] },
  { kind: "video", src: "dinner.mp4", from: 5.6, to: 11.1, audio: true, lines: [{ at: 0.1, len: 5.4, text: "밥 먹으면서도\n곰돌이 틀을 꼭 쥐고" }], talk: [
    { at: 1.5, len: 2.3, text: "곰돌이 쿠키 만들까?", who: "" },
    { at: 3.9, len: 1.5, text: "응!", who: "" },
  ] },
];

// 반죽을 틀로 꾹 누르고 쑥 빼기 — 오감 놀이
const SHAPE: Shot[] = [
  { kind: "video", src: "shape1.mp4", from: 0, to: 7.8, audio: true, lines: [{ at: 0.2, len: 7.5, text: "곰돌이 · 토끼 틀로\n쿠키 모양 찍기" }] },
  { kind: "video", src: "shape2a.mp4", from: 2.6, to: 6.4, audio: true, talk: [{ at: 0.5, len: 1.0, text: "쑥!", who: "" }] },
  { kind: "video", src: "shape2b.mp4", from: 4.0, to: 14.2, audio: true },
];
const SHAPE_CAPTION = "말랑말랑 반죽을\n꾹 누르고, 쑥 빼고\n손끝으로 느끼는 오감 놀이";

const OVEN: Shot[] = [
  { kind: "photo", src: "in_oven.jpg", len: f(2.4), origin: "50% 55%", caption: "이제 오븐으로!" },
  { kind: "video", src: "oven1.mp4", from: 0, to: 5.6, audio: true },
  { kind: "video", src: "oven2.mp4", from: 2.6, to: 6.6, audio: true },
  { kind: "video", src: "oven3.mp4", from: 2.5, to: 8.4, audio: true, talk: [
    { at: 0.2, len: 1.5, text: "뭐가 제일 마음에 들어?", who: "" },
    { at: 2.1, len: 1.2, text: "토끼!", who: "" },
  ] },
];
const OVEN_CAPTION = "오븐 앞에서 기다리는 것도\n신기한 구경거리";

const DONE: Shot[] = [
  { kind: "photo", src: "baked.jpg", len: f(2.6), origin: "50% 55%", caption: "반죽이 진짜 쿠키가 됐어요" },
  { kind: "video", src: "done.mp4", from: 11.8, to: 16.0, audio: true, talk: [
    { at: 1.6, len: 2.4, text: "토끼가 됐지?", who: "" },
  ] },
  { kind: "video", src: "hot.mp4", from: 0, to: 3.5, audio: true, talk: [{ at: 0.1, len: 2.3, text: "아 뜨거워", who: "" }] },
];
const EAT: Shot[] = [
  { kind: "video", src: "eat1.mp4", from: 5.6, to: 11.3, audio: true, lines: [{ at: 0.2, len: 5.5, text: "직접 만들어서 그런지\n더 맛있나 봐요" }], talk: [
    { at: 4.4, len: 1.2, text: "맛있어?", who: "" },
  ] },
  { kind: "video", src: "eat2.mp4", from: 0, to: 7.0, audio: true, lines: [{ at: 0.2, len: 6.7, text: "친구들한테도\n나눠 주고 싶대요" }], talk: [
    { at: 0.1, len: 0.9, text: "친구 줄 거야?", who: "" },
    { at: 1.0, len: 0.9, text: "어!", who: "" },
  ] },
  { kind: "video", src: "eat3.mp4", from: 0, to: 2.9, audio: true, talk: [{ at: 0.1, len: 2.7, text: "도아가 만들었다고 자랑해", who: "" }] },
];

const OUTRO_LEN = INTRO + 75;
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: OUTRO_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...STORY, ...SHAPE, ...OVEN, ...DONE, ...EAT, ...TAIL];
export const COOKING_COOKIE_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(4.2);
const sum = (xs: Shot[]) => xs.reduce((a, x) => a + shotLen(x), 0);
const SHAPE_FROM = sum([...OPEN, ...STORY]);
const OVEN_FROM = SHAPE_FROM + sum(SHAPE) + f(2.4); // 오븐 사진 다음부터
const OVEN_LEN = sum(OVEN) - f(2.4);
const COOK_START = SHAPE_FROM;

const fadeInOut = (frame: number, len: number, k = 5) =>
  Math.min(
    interpolate(frame, [0, k], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [len - k, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

const Video: React.FC<{ s: Extract<Shot, { kind: "video" }>; len: number }> = ({ s, len }) => {
  const video = (
    <OffthreadVideo
      src={staticFile((s.dir ?? DIR) + s.src)}
      trimBefore={f(s.from)}
      trimAfter={f(s.to)}
      playbackRate={s.rate ?? 1}
      muted={!s.audio}
      volume={s.audio ? 1 : 0}
      style={{ width: "100%", height: "100%", objectFit: s.app ? "contain" : "cover" }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: s.app ? WHITE : "#000" }}>
      {s.app ? (
        // 앱 녹화 — 높이에 맞춰 가운데, 얇은 테두리
        <div style={{ position: "absolute", top: 0, left: (1080 - 956) / 2, width: 956, height: 1920, border: `1px solid ${LINE}` }}>{video}</div>
      ) : (
        video
      )}
      {s.step && <Caption from={6} len={len - 8} text={s.step} />}
      {s.lines?.map((l, k) => <Caption key={k} from={f(l.at)} len={f(l.len)} text={l.text} />)}
      {s.talk?.map((t, k) => <Sequence key={k} from={f(t.at)} durationInFrames={f(t.len)}><Talk text={t.text} who={t.who} len={f(t.len)} /></Sequence>)}
      {s.think?.map((t, k) => <Sequence key={"t" + k} from={f(t.at)} durationInFrames={f(t.len)}><Think text={t.text} len={f(t.len)} /></Sequence>)}
      {s.list && <PackCard list={s.list} />}
    </AbsoluteFill>
  );
};

// 사람이 실제로 한 말 — 요즘 릴스식 말 자막(사용자 2026-11-01: 말풍선이 촌스럽다). 상자 없이 굵은 흰 글씨 + 검은 외곽선,
// 단어가 하나씩 톡톡 튀어나오고 지금 단어만 노랗게(캡컷 자동 자막 느낌). 말한 사람 이름은 쓰지 않는다(사용자 2026-11-01)
const Talk: React.FC<{ text: string; who: string; len: number }> = ({ text, who, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 긴 말은 「 / 」로 나눈 덩어리를 한 번에 하나씩(요즘 릴스 자막처럼 한 줄씩 바뀜)
  const chunks = text.split(" / ");
  const per = len / chunks.length;
  const ci = Math.min(chunks.length - 1, Math.floor(frame / per));
  const local = frame - ci * per;
  const words = chunks[ci].split(" ");
  const span = Math.max(8, Math.min(per * 0.6, words.length * 8));
  const o = interpolate(frame, [len - 5, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cur = Math.min(words.length - 1, Math.floor((local / span) * words.length));
  const stroke = { WebkitTextStroke: "14px #000", paintOrder: "stroke fill" } as React.CSSProperties;
  return (
    <div style={{ position: "absolute", top: 470, left: 60, right: 60, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.22, wordBreak: "keep-all" }}>
        {words.map((w, k) => {
          const at = (k / words.length) * span;
          const p = spring({ frame: local - at, fps, config: { damping: 11, mass: 0.45 } });
          return (
            <span key={`${ci}-${k}`} style={{ display: "inline-block", margin: "0 12px", color: k === cur ? YELLOW : WHITE, opacity: local >= at ? 1 : 0, transform: `scale(${interpolate(p, [0, 1], [0.5, 1])}) rotate(${k === cur ? -2 : 0}deg)`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))", ...stroke }}>
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// 아이 속마음 — 엄마 말 아래에 괄호로(사용자 2026-11-01: 엄마는 신나서 설명하는데 아이는 한마디도 없다 → 「허탕 친 캠핑」 이야기).
// 말 자막과 구분되게 연한 하늘색, 단어 튀기 없이 살짝 떠오름
const Think: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const frame = useCurrentFrame();
  const o = Math.min(interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }), interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const y = interpolate(frame, [0, 10], [14, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 700, left: 60, right: 60, textAlign: "center", opacity: o, transform: `translateY(${y}px)`, fontFamily: FONT_FAMILY }}>
      <span style={{ fontSize: 74, fontWeight: 900, color: "#BFE6FF", WebkitTextStroke: "12px #000", paintOrder: "stroke fill", whiteSpace: "pre-line", wordBreak: "keep-all", lineHeight: 1.25 } as React.CSSProperties}>{text}</span>
    </div>
  );
};

// 사진 — 천천히 다가간다. 첫 장면(후킹)은 첫 프레임부터 보이게 페이드 없이 시작.
// pan: 가로 사진을 높이에 맞추고 왼쪽 끝 → 오른쪽 끝으로 훑어 사진 전체를 보여 준다
const Photo: React.FC<{ s: Extract<Shot, { kind: "photo" }>; len: number; first: boolean }> = ({ s, len, first }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, len], [1.0, 1.12], { easing: Easing.inOut(Easing.cubic) });
  const x = interpolate(frame, [4, len - 4], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const o = first ? interpolate(frame, [len - 4, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : fadeInOut(frame, len, 4);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: o }}>
      {s.pan ? (
        <Img src={staticFile((s.dir ?? DIR) + s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% 50%` }} />
      ) : (
        <Img src={staticFile((s.dir ?? DIR) + s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.origin ?? "50% 50%", transform: `scale(${z})`, transformOrigin: s.origin ?? "50% 50%" }} />
      )}
      {s.caption && <Caption from={6} len={len - 8} text={s.caption} />}
      {s.lines?.map((l, k) => <Caption key={k} from={f(l.at)} len={f(l.len)} text={l.text} />)}
      {s.list && <PackCard list={s.list} />}
    </AbsoluteFill>
  );
};

const PackCard: React.FC<{ list: PackList }> = ({ list }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, mass: 0.6 } });
  const h = spring({ frame: frame - 20, fps, config: { damping: 14, mass: 0.6 } });
  return (
    <>
    {list.hint && (
      // 댓글 유도 — 카드 반대편(카드가 아래면 위, 위면 아래 자막 자리)
      <div style={{ position: "absolute", left: 70, right: 70, top: list.bottom ? 210 : 1360, padding: "22px 30px 26px", borderRadius: 30, backgroundColor: YELLOW, color: INK, textAlign: "center", whiteSpace: "pre-line", fontFamily: FONT_FAMILY, fontSize: 46, fontWeight: 900, lineHeight: 1.3, boxShadow: "0 10px 28px rgba(0,0,0,0.35)", opacity: h, transform: `scale(${interpolate(h, [0, 1], [0.9, 1])})` }}>
        {list.hint}
      </div>
    )}
    <div style={{ position: "absolute", top: list.bottom ? 960 : 150, left: 56, right: 56, padding: "30px 40px 34px", borderRadius: 36, backgroundColor: list.bottom ? "rgba(0,0,0,0.86)" : "rgba(0,0,0,0.62)", opacity: p, transform: `translateY(${(1 - p) * -20}px)`, fontFamily: FONT_FAMILY }}>
      <div style={{ color: YELLOW, fontSize: 62, fontWeight: 900, marginBottom: 14 }}>{list.title}</div>
      {list.items.map((it, k) => {
        const q = spring({ frame: frame - f(it.at), fps, config: { damping: 14, mass: 0.5 } });
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 18, color: it.head ? YELLOW : WHITE, fontSize: it.head ? 40 : list.small ? 46 : 54, fontWeight: 800, lineHeight: 1.45, marginTop: it.head && k > 0 ? 14 : 0, opacity: q, transform: `translateX(${(1 - q) * -30}px)` }}>
            {!it.head && <span style={{ color: YELLOW }}>✓</span>}
            {it.head ? `― ${it.text}` : it.text}
          </div>
        );
      })}
    </div>
    </>
  );
};

// 오늘의 레시피 제목 — 요리 첫 장면 위쪽
const RecipeTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 2, fps, config: { damping: 15, mass: 0.7 } });
  const out = interpolate(frame, [TITLE_LEN - 8, TITLE_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 210, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * -24}px)`, fontFamily: FONT_FAMILY }}>
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>도아랑 같이 만드는</div>
      <div style={{ color: WHITE, fontSize: 92, fontWeight: 900, lineHeight: 1.15, textAlign: "center", whiteSpace: "pre-line", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        {"곰돌이 · 토끼\n쿠키"}
      </div>
    </div>
  );
};

const Shots: React.FC = () => {
  let cursor = 0;
  return (
    <>
      {SHOTS.map((s, i) => {
        const from = cursor;
        const len = shotLen(s);
        cursor += len;
        let body: React.ReactNode;
        if (s.kind === "video") body = <Video s={s} len={len} />;
        else if (s.kind === "photo") body = <Photo s={s} len={len} first={i === 0} />;
        else if (s.kind === "cta")
          body = (
            <CtaOutro
              payoffLine={
                <>
                  아이랑 만들 간식도, <span style={{ color: "#D99A00" }}>쿡매치에서</span>
                </>
              }
            />
          );
        else if (s.kind === "transition")
          body = (
            <Intro
              outro={OUTRO_LEN}
              line1="그 밖에도"
              line2={
                <>
                  이런 <Mark>기능</Mark>이 있어요
                </>
              }
            />
          );
        else body = null;
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`${i + 1}-${s.kind}${s.kind === "video" || s.kind === "photo" ? "-" + s.src : ""}`}>
            {body}
          </Sequence>
        );
      })}
    </>
  );
};

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const len = f(HOOK.len);
  // 썸네일로 쓰므로 첫 프레임부터 꽉 보이게 — 사라질 때만 페이드(COOKING_REEL_GUIDE 0-1)
  const o = interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 930, left: 30, right: 30, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", wordBreak: "keep-all", fontSize: 108, fontWeight: 900, lineHeight: 1.16, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
      <div style={{ marginTop: 26 }}>
        <span style={{ display: "inline-block", backgroundColor: WHITE, color: INK, fontSize: 64, fontWeight: 900, padding: "10px 36px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.35)" }}>{HOOK.sub}</span>
      </div>
    </div>
  );
};

export const CookingCookie: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      <Sequence from={SHAPE_FROM} durationInFrames={sum(SHAPE)}>
        <Caption from={f(7.9)} len={sum(SHAPE) - f(8.1)} text={SHAPE_CAPTION} />
      </Sequence>
      <Sequence from={OVEN_FROM} durationInFrames={OVEN_LEN}>
        <Caption from={4} len={OVEN_LEN - 6} text={OVEN_CAPTION} />
      </Sequence>
      <Sequence from={COOK_START} durationInFrames={TITLE_LEN}>
        <RecipeTitle />
      </Sequence>
      <Sequence from={f(HOOK.at)} durationInFrames={f(HOOK.len)}>
        <Hook />
      </Sequence>
    </AbsoluteFill>
  );
};
