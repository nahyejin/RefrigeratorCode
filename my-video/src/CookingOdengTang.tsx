import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark } from "./ReelOverview";
import { SearchBanner } from "./TalkReels";

// 요리 릴스 5편 — 남은 무·대파로 어묵 오뎅탕(2026-11-02, 사용자 이야기: 냉장고에 무·대파·고추가 남아서, 고추는 도아가 매워해서 못 넣음).
// ① 후킹(냉장고 사진) → ② 마트에서 도아와 어묵 찾기(원래 소리) → ③ 요리(단계 자막 = 쿡매치 「간단 어묵국」 레시피 문구, 사용자 2026-11-02: 「원래 레시피 그대로 만든 척」)
// → ④ 먹는 도아(원래 소리) → ⑤ 쿡매치(검색 → 인기순·8/8 → 레시피 → 캘린더) → ⑥ 슬로건(검증된 레시피) → 그 밖에도.
// 원본은 public/cooking/오뎅탕_20261102/ (git 제외). 작업본은 work/ (ffmpeg 로 9:16·배속·소리 정리).

const DIR = "cooking/오뎅탕_20261102/work/";
const f = (s: number) => Math.round(s * 30);

type PackList = { title: string; items: { at: number; text: string; head?: boolean }[]; bottom?: boolean; small?: boolean; hint?: string };

const FAST = 1.15; // 요리·앱 장면만 살짝 빠르게(말소리 장면은 1배)
type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; fast?: boolean; audio?: boolean; step?: string; app?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[]; talk?: { at: number; len: number; text: string; who: string }[]; think?: { at: number; len: number; text: string }[] }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string; pan?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[] }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / ((s.rate ?? 1) * (s.fast ? FAST : 1))) : s.len);

// 첫 장면 = 냉장고에 남은 무·대파 사진 + 큰 노란 후킹(썸네일 겸용)
const HOOK = { at: 0, len: 3.4, text: "냉장고에 남은\n무·대파로 끓인\n아이 오뎅탕", sub: "고추는 아이가 매워해서 뺐어요" };
const OPEN: Shot[] = [
  { kind: "photo", src: "fridge.jpg", len: f(9.2), origin: "35% 62%", lines: [
    { at: 3.6, len: 3.2, text: "냉장고에 무랑 대파가 남아 있어서\n(고추도 있었지만 아이가 매워해서 패스 ㅠㅠ)" },
    { at: 6.9, len: 2.2, text: "오늘은 오뎅탕 해 볼까?" },
  ] },
];

// 오뎅 사러 가는 길 — 젖은 땅을 보고 비 온 걸 알아맞힘(07:38 영상 145.9~162.9s)
const RAIN: Shot[] = [
  { kind: "video", src: "m_r.mp4", from: 0, to: 11.4, audio: true, lines: [
    { at: 2.3, len: 4.6, text: "땅이 젖은 걸 보고\n비가 온 걸 알아맞힌 우리 아이 🕵️" },
    { at: 9.3, len: 2.1, text: "우와 똑똑해졌다!" },
  ], talk: [
    { at: 0.4, len: 1.15, text: "아 비가 왔네", who: "도아" },
  ] },
];

// 마트 — 도아와 어묵 찾기(엄마 목소리가 계속 나와 소리 끔, 사용자 2026-11-03: 엄마 말 최소화). 받아쓰기(Whisper) 기준: 「이제 오뎅 찾자」 16.2s, 「오뎅 어딨어」 28.2s, 「어묵이 다 팔렸어」 67.3s·72.4s, 「이거 밖에 없네 이거 먹자」 78s, 「도아가 계산해줘」 83s
const MART: Shot[] = [
  { kind: "video", src: "m_a.mp4", from: 0, to: 4.0, lines: [{ at: 0.2, len: 2.0, text: "비 온 길을 걸어\n오뎅 사러 마트로 🛒" }, { at: 2.3, len: 1.6, text: "이런 날엔 따뜻한 오뎅국!" }] },
  { kind: "video", src: "m_c.mp4", from: 0, to: 7.6, lines: [{ at: 1.0, len: 3.2, text: "그런데 어묵이 다 팔렸다…\n(이럴 수가 ㅠㅠ)" }] },
  { kind: "video", src: "m_d.mp4", from: 0, to: 5.3, lines: [{ at: 1.0, len: 3.0, text: "남은 거라도 건졌어요!" }] },
];

// 요리 — 단계 자막은 앱 레시피(간단 어묵국 · 오뎅탕) 문구 그대로
const COOK: Shot[] = [
  { kind: "video", fast: true, src: "r1.mp4", from: 0, to: 4.0, step: "무는 어묵 모양에 맞게\n채썰기" },
  { kind: "video", fast: true, src: "r3.mp4", from: 0, to: 4.0 },
  { kind: "video", fast: true, src: "p1.mp4", from: 0, to: 5.0, step: "대파는 어슷하게 썰고" },
  { kind: "video", fast: true, src: "e1.mp4", from: 0, to: 5.1, step: "사각어묵도 썰어 두기" },
  { kind: "video", src: "q_a2.mp4", from: 0, to: 5.7, lines: [
    { at: 0.1, len: 3.6, text: "우리 집은 먹는 양이 많아서\n하루 이틀 먹을 양으로 레시피의 거의\n2배를 끓였어요 (분량은 레시피 기준으로!)" },
    { at: 3.8, len: 1.9, text: "물 붓고 육수 넣기" },
  ] },
  { kind: "video", fast: true, src: "q_b.mp4", from: 0, to: 4.0, step: "무 먼저 넣고\n뚜껑 닫고 끓이기" },
  { kind: "video", fast: true, src: "q_c.mp4", from: 0, to: 4.0, step: "멸치액젓 · 국간장 · 양조간장\n넣어 간하기" },
  { kind: "video", fast: true, src: "q_d2.mp4", from: 0, to: 2.9, step: "다진마늘 넣기" },
  { kind: "video", fast: true, src: "q_e.mp4", from: 0, to: 4.0, step: "어묵 넣고 부드럽게 퍼질 때까지\n대파 넣고 끓이기" },
  { kind: "video", fast: true, src: "q_f2.mp4", from: 0, to: 2.4, step: "후춧가루 톡톡 뿌려서 완성" },
  { kind: "video", fast: true, src: "q_g.mp4", from: 0, to: 6.0, step: "보글보글" },
];
const PLATE: Shot[] = [{ kind: "video", fast: true, src: "d_pot.mp4", from: 0, to: 4.0, step: "간단 오뎅탕 완성!" }];
// 먹는 도아(원래 소리) — 받아쓰기 기준 「아 뜨거워」 6.9s, 「오뎅탕은 어때?」 10.8s (095231) / 「맛있지?」 25s, 「맛있어?」 28.6s, 「시원하다」 32s (100449)
const EAT: Shot[] = [
  { kind: "video", src: "ea.mp4", from: 0, to: 4.2, audio: true, lines: [{ at: 1.8, len: 2.2, text: "아이 반응은?" }], talk: [
    { at: 0.1, len: 0.8, text: "아 뜨거워", who: "도아" },
  ] },
  { kind: "video", src: "ed.mp4", from: 0, to: 6.2, audio: true, talk: [
    { at: 3.5, len: 0.9, text: "너무 맛있어!", who: "도아" },
    { at: 4.8, len: 0.8, text: "음!", who: "도아" },
  ] },
  { kind: "video", src: "ec.mp4", from: 0, to: 11.2, audio: true, lines: [{ at: 6.0, len: 2.6, text: "국물까지 맛있게 먹었어요" }], talk: [
    { at: 8.3, len: 2.0, text: "엄마 국물 줘", who: "도아" },
  ] },
];

// 쿡매치 앱 녹화(상태 표시줄 잘라 낸 작업본 884x1790, 원본과 같은 시각)
const APP: Shot[] = [
  { kind: "video", fast: true, src: "app_raw.mp4", from: 17.0, to: 23.5, app: true, step: "오늘 메뉴는 오뎅탕!\n쿡매치에서 「오뎅탕」 검색" },
  { kind: "video", fast: true, src: "app_raw.mp4", from: 34.0, to: 45.0, rate: 1.3, app: true, step: "인기순으로 골랐더니\n내 재료 8/8 (100%)" },
  { kind: "video", fast: true, src: "app_raw.mp4", from: 48.2, to: 57.8, rate: 1.3, app: true, step: "이 레시피대로 만들었어요" },
  { kind: "video", fast: true, src: "app_raw.mp4", from: 57.8, to: 62.4, app: true, step: "먹은 날은\n마이캘린더에 담아요" },
];
const OUTRO_LEN = INTRO + 75;
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: OUTRO_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...RAIN, ...MART, ...COOK, ...PLATE, ...EAT, ...APP, ...TAIL];
export const COOKING_ODENG_TANG_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(4.2);
const COOK_START = [...OPEN, ...RAIN, ...MART].reduce((a, s) => a + shotLen(s), 0);
const BANNER_FROM = [...OPEN, ...RAIN, ...MART, ...COOK, ...PLATE, ...EAT].reduce((a, s) => a + shotLen(s), 0);
const CTA_AT = BANNER_FROM + APP.reduce((a, s) => a + shotLen(s), 0);

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
      playbackRate={(s.rate ?? 1) * (s.fast ? FAST : 1)}
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
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 760, background: "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))", opacity: Math.min(p, out) }} />
      <div style={{ position: "absolute", top: 210, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * -24}px)`, fontFamily: FONT_FAMILY }}>
        <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>무·대파 남은 날</div>
        <div style={{ color: WHITE, fontSize: 92, fontWeight: 900, lineHeight: 1.15, textAlign: "center", whiteSpace: "pre-line", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
          {"어묵으로\n간단 오뎅탕"}
        </div>
      </div>
    </>
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
                  유튜브·네이버 상위 채널만 모았으니,
                  <br />
                  뭘 골라도 <span style={{ color: "#D99A00" }}>맛집이에요</span>
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

export const CookingOdengTang: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      <Sequence from={COOK_START} durationInFrames={TITLE_LEN}>
        <RecipeTitle />
      </Sequence>
      <Sequence from={f(HOOK.at)} durationInFrames={f(HOOK.len)}>
        <Hook />
      </Sequence>
      <Sequence from={BANNER_FROM} durationInFrames={CTA_AT - BANNER_FROM}>
        <SearchBanner bottom={120} scale={0.82} panel />
      </Sequence>
    </AbsoluteFill>
  );
};
