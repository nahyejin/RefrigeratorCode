import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark } from "./ReelOverview";
import { SearchBanner } from "./TalkReels";

// 요리 릴스 8편 — 냉장고에 상비 중인 무 · 콩나물 · 청양고추로 황태콩나물국(2026-11-23). 쿡매치 「황태국 뽀얗게 맛있게」(황태 60g 기준)를
// 쿡코치에게 황태 200g 기준으로 계량해 달라고 함. 다시마 대신 코인육수. 대사 · 시각은 받아쓰기 기준, 아이 이름 대신 「아이」.
// 원본은 public/cooking/황태콩나물국_20261123/ (git 제외).

const DIR = "cooking/황태콩나물국_20261123/work/";
const f = (s: number) => Math.round(s * 30);

type PackList = { title: string; items: { at: number; text: string; head?: boolean }[]; bottom?: boolean; small?: boolean; hint?: string };

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[]; talk?: { at: number; len: number; text: string; who: string }[]; think?: { at: number; len: number; text: string }[] }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string; pan?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[] }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 첫 장면 = 황태국 먹고 웃는 아이 + 후킹
const HOOK = { at: 0, len: 3.4, text: "황태는 200g인데\n레시피는 60g 기준?", sub: "쿡코치가 계량 다시 해 줬어요" };
const OPEN: Shot[] = [{ kind: "photo", src: "hook.jpg", len: f(3.4), origin: "50% 40%" }];

const STORY: Shot[] = [
  { kind: "video", src: "prep.mp4", from: 0, to: 6.0, step: "냉장고에 상비 중인 무,\n콩나물 · 청양고추로\n쿡매치에서 찾은 황태국" },
];

// 쿡코치: 처음 한 질문과 최종 답만(092024 질문 + 092032 최종 답, 중간에 다시 물어본 과정은 뺌)
const COACH: Shot[] = [
  { kind: "photo", src: "coach_q.jpg", len: f(2.6), origin: "50% 30%", caption: "황태가 200g이라\n쿡코치에게 계량 부탁" },
  { kind: "photo", src: "coach_a.jpg", len: f(5.0), origin: "50% 40%", caption: "조리 순서별 계량까지\n한 번에" },
];

const COOK: Shot[] = [
  { kind: "video", src: "soak.mp4", from: 0, to: 5.0, step: "황태채 200g\n물에 헹궈 불리기" },
  { kind: "video", src: "marinate.mp4", from: 0, to: 5.0, step: "참기름 · 다진 마늘 · 미림에\n조물조물" },
  { kind: "video", src: "broth.mp4", from: 0, to: 9.0, audio: true, step: "물에 코인육수\n(다시마 대신)", talk: [{ at: 0.1, len: 3.0, text: "무랑 콩나물", who: "" }] },
  { kind: "video", src: "addveg.mp4", from: 0, to: 7.0, step: "무 · 콩나물 · 대파 · 청양고추\n위에 황태 올리기" },
  { kind: "video", src: "simmer.mp4", from: 0, to: 9.0, audio: true, step: "보글보글 끓이기", talk: [
    { at: 2.1, len: 2.2, text: "다 돼 간다", who: "" },
    { at: 5.0, len: 2.6, text: "우와 맛있겠다", who: "" },
  ] },
  { kind: "video", src: "ladle.mp4", from: 0, to: 8.0, step: "마지막에 달걀 풀어 넣고\n황태콩나물국 완성!" },
];

const RECIPE: Shot[] = [
  { kind: "photo", src: "pot.jpg", len: f(6.0), origin: "50% 55%", list: { title: "이렇게 바꿨어요", small: true, items: [
    { at: 0.2, text: "황태 60g → 200g, 쿡코치로 다시 계량" }, { at: 1.0, text: "다시마 대신 코인육수" },
    { at: 1.8, text: "두부는 생략" }, { at: 2.6, text: "달걀은 마지막에 풀어 넣기" },
  ] } },
];

const EAT: Shot[] = [
  { kind: "video", src: "eatA.mp4", from: 0, to: 9.5, audio: true, talk: [
    { at: 4.8, len: 1.4, text: "맛있어?", who: "" },
    { at: 6.6, len: 1.4, text: "다행이다", who: "" },
  ] },
  { kind: "video", src: "eatB.mp4", from: 0, to: 6.0, audio: true, talk: [
    { at: 1.1, len: 1.6, text: "이게 뭐야?", who: "" },
    { at: 3.8, len: 1.7, text: "말린 생선?", who: "" },
  ] },
  { kind: "video", src: "eatC.mp4", from: 0, to: 15.0, audio: true, lines: [{ at: 4.0, len: 10.8, text: "국에 넣은 무는\n어린이집에서 직접 캐 온 그 무!" }], talk: [
    { at: 0.5, len: 2.2, text: "그게 말린 생선이야", who: "" },
    { at: 10.4, len: 3.8, text: "어린이집에서 직접 캐서 / 가져온 거", who: "" },
  ] },
  { kind: "video", src: "eatD.mp4", from: 0, to: 11.0, audio: true, step: "오늘도 맛있게 냠냠" },
];
const OUTRO_LEN = INTRO + 75;
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: OUTRO_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...STORY, ...COACH, ...COOK, ...RECIPE, ...EAT, ...TAIL];
export const COOKING_HWANGTAE_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(4.2);
const sum = (xs: Shot[]) => xs.reduce((a, x) => a + shotLen(x), 0);
const COOK_START = sum([...OPEN, ...STORY, ...COACH]);
const BANNER_FROM = sum([...OPEN, ...STORY]);
const CTA_AT = BANNER_FROM + sum(COACH);

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
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>냉장고 상비 재료로</div>
      <div style={{ color: WHITE, fontSize: 92, fontWeight: 900, lineHeight: 1.15, textAlign: "center", whiteSpace: "pre-line", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        {"황태\n콩나물국"}
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
                  계량 계산도, <span style={{ color: "#D99A00" }}>쿡코치가 대신</span>
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
    <div style={{ position: "absolute", top: 1440, left: 30, right: 30, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", wordBreak: "keep-all", fontSize: 92, fontWeight: 900, lineHeight: 1.14, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
      <div style={{ marginTop: 18 }}>
        <span style={{ display: "inline-block", backgroundColor: WHITE, color: INK, fontSize: 56, fontWeight: 900, padding: "8px 32px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.35)" }}>{HOOK.sub}</span>
      </div>
    </div>
  );
};

export const CookingHwangtae: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      <Sequence from={BANNER_FROM} durationInFrames={CTA_AT - BANNER_FROM}>
        <SearchBanner bottom={120} scale={0.82} panel />
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
