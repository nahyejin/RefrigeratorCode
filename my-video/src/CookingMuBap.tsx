import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark } from "./ReelOverview";
import { SearchBanner } from "./TalkReels";

// 요리 릴스 7편 — 도아가 어린이집에서 캐 온 무로 콩나물 · 소고기 무밥(2026-11-17). 키즈노트 사진(11/10, 다른 아이 나온 사진 제외)
// → 집에 온 「무 아저씨」 → 손질 · 채 썰기 → 밥솥 → 대파 양념장 → 소고기 → 완성 → 잘 먹는 도아 → 쿡매치(무밥 검색 · 소고기 · 공유 · 쿡코치).
// 대사 · 시각은 받아쓰기 기준. 원본은 public/cooking/무밥_20261117/ (git 제외).

const DIR = "cooking/무밥_20261117/work/";
const f = (s: number) => Math.round(s * 30);

type PackList = { title: string; items: { at: number; text: string; head?: boolean }[]; bottom?: boolean; small?: boolean; hint?: string };

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[]; talk?: { at: number; len: number; text: string; who: string }[]; think?: { at: number; len: number; text: string }[] }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string; pan?: boolean; list?: PackList; dir?: string; lines?: { at: number; len: number; text: string }[] }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 첫 장면 = 무밥을 먹으며 웃는 도아 + 후킹
const HOOK = { at: 0, len: 3.4, text: "어린이집에서 도아가 캔 무로\n무밥 해 줬더니", sub: "콩나물 · 소고기 무밥" };
const OPEN: Shot[] = [{ kind: "photo", src: "hook.jpg", len: f(3.4), origin: "50% 40%" }];

// 키즈노트 사진(선생님이 보내 주심) — 묶음마다 자막 하나를 길게(KIDS_CAPTIONS)
// 어린이집 사진은 한 장씩 넘기지 말고 콜라주 한 컷(사용자 2026-11-17: 했다는 것만 인지되면 된다)
const KIDS: Shot[] = [{ kind: "photo", src: "kids_collage.jpg", len: f(3.4), origin: "50% 50%" }];
const KIDS_CAPTIONS = [{ from: 0, to: 0, text: "어린이집에서 무 캐고, 꾸미고\n오감 놀이까지!" }];

const HOME: Shot[] = [
  { kind: "photo", src: "k_091133.jpg", len: f(2.2), origin: "50% 45%", caption: "도아가 집에 들고 온\n「무 아저씨」" },
  // 「무밥 해 줄까?」가 급해 보인다(사용자 2026-11-17) → 렌더 뒤 1.15배속을 상쇄해 원래 속도로
  { kind: "video", src: "home.mp4", from: 5.3, to: 19.5, rate: 0.87, audio: true, talk: [
    { at: 0.23, len: 7.36, text: "무 아저씨 / 눈, 코, 귀", who: "" },
    { at: 7.82, len: 2.64, text: "이걸로 무밥 해 줄까?", who: "" },
    { at: 10.7, len: 1.38, text: "응!", who: "" },
    { at: 13.57, len: 2.64, text: "엄마가 무밥 해 줄게", who: "" },
  ] },
];

const COOK: Shot[] = [
  { kind: "video", src: "prep.mp4", from: 0, to: 4.1, step: "어린이집에서 캐 온\n도아 무 손질" },
  { kind: "video", src: "julienne.mp4", from: 0, to: 5.0, step: "무는 채 썰고" },
  { kind: "video", src: "pot.mp4", from: 0, to: 5.5, step: "쌀 위에 콩나물 · 무 얹어서\n밥 짓기" },
  { kind: "video", src: "onion.mp4", from: 0, to: 4.1, step: "양념장: 대파 · 청양고추 송송" },
  { kind: "video", src: "sauce.mp4", from: 0, to: 6.2, step: "간장 · 들기름 · 다진 마늘\n생강가루 · 후춧가루" },
  { kind: "video", src: "beef.mp4", from: 0, to: 5.6, step: "소고기는 도아 먹기 좋게\n양념 없이 따로 볶기" },
  { kind: "video", src: "open.mp4", from: 3.0, to: 13.0, audio: true, step: "콩나물 무밥 완성!", talk: [{ at: 2.9, len: 1.2, text: "짜잔!", who: "" }] },
  { kind: "video", src: "mix.mp4", from: 1.6, to: 7.1, step: "볶은 소고기 · 양념장 올려\n쓱쓱 비비기" },
];

// 쿡매치 레시피(코스트코 소고기 다짐육 소분 활용 소고기 무밥)와 바꾼 점 — 사용자 2026-11-17
const RECIPE: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 86.0, to: 95.0, app: true, list: { title: "원래 레시피는 이래요", bottom: true, items: [
    { at: 0.3, text: "다짐육 양념: 진간장 · 참기름 · 생강술" }, { at: 0.8, text: "다진 마늘 · 후추 · 대파" },
    { at: 1.4, text: "쌀 위에 절인 무 · 다짐육 얹어 밥 짓기" },
    { at: 2.0, text: "양념장 따로: 청양 · 매실청 · 고춧가루 …" },
  ] } },
  { kind: "photo", src: "bowl.jpg", len: f(8.0), origin: "50% 55%", list: { title: "이렇게 바꿨어요", small: true, items: [
    { at: 0.2, text: "밥", head: true }, { at: 0.4, text: "마침 있던 콩나물 추가, 콩나물 · 무만 얹어 짓기" },
    { at: 1.4, text: "소고기", head: true }, { at: 1.6, text: "도아 때문에 양념 없이 따로 볶기" },
    { at: 2.6, text: "양념장", head: true }, { at: 2.8, text: "다짐육 양념을 양념장으로 + 청양고추" },
    { at: 3.6, text: "생강술 대신 생강가루 (쿡코치 추천)" }, { at: 4.4, text: "이것만으로 충분해서 아래 양념장은 생략" },
  ] } },
];

const EAT: Shot[] = [
  { kind: "video", src: "eatA.mp4", from: 0, to: 11.5, audio: true, talk: [
    { at: 0.6, len: 1.8, text: "이거 누가 했어?", who: "" },
    { at: 8.8, len: 1.4, text: "도아가!", who: "" },
  ] },
  { kind: "video", src: "eatB.mp4", from: 0, to: 8.0, audio: true, lines: [{ at: 0.2, len: 7.7, text: "직접 캔 가을무라\n더 달고 맛있대요" }], talk: [
    { at: 0.3, len: 1.7, text: "응, 이거 도아가 한 거야", who: "" },
    { at: 3.9, len: 3.8, text: "가을무가 정말 정말 맛있어 / 정말 달아", who: "" },
  ] },
  { kind: "video", src: "eatC.mp4", from: 0, to: 10.0, audio: true, talk: [
    { at: 1.6, len: 1.7, text: "도아가 요리한 거야", who: "" },
    { at: 6.2, len: 1.8, text: "도아 고마워", who: "" },
    { at: 8.0, len: 1.9, text: "엄마 잘 먹을게", who: "" },
  ] },
];

// 쿡매치 앱 녹화(20261116_231027, 위쪽 상태 표시줄 · 집 카메라 알림 자리는 잘라 냄)
const APP: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 2.0, to: 28.0, rate: 4, app: true, step: "쿡매치에서 「무밥」 검색" },
  { kind: "video", src: "app_raw.mp4", from: 60.0, to: 74.0, rate: 2, app: true, step: "꼭 넣을 재료에 「소고기」" },
  { kind: "video", src: "app_raw.mp4", from: 80.0, to: 96.0, rate: 2.6, app: true, step: "내 냉장고 재료로\n소고기 무밥 레시피" },
  { kind: "video", src: "app_raw.mp4", from: 116.0, to: 135.0, rate: 2.6, app: true, step: "모르는 건 쿡코치에게\n「생강술 대신 뭘 써?」" },
];
const OUTRO_LEN = INTRO + 75;
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: OUTRO_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...KIDS, ...HOME, ...COOK, ...RECIPE, ...EAT, ...APP, ...TAIL];
export const COOKING_MUBAP_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(4.2);
const sum = (xs: Shot[]) => xs.reduce((a, x) => a + shotLen(x), 0);
const KIDS_FROM = sum(OPEN);
const kidsAt = (i: number) => KIDS_FROM + sum(KIDS.slice(0, i));
const COOK_START = sum([...OPEN, ...KIDS, ...HOME]);
const BANNER_FROM = sum([...OPEN, ...KIDS, ...HOME, ...COOK, ...RECIPE, ...EAT]);
const CTA_AT = BANNER_FROM + sum(APP);

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
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>도아가 캐 온 무로</div>
      <div style={{ color: WHITE, fontSize: 92, fontWeight: 900, lineHeight: 1.15, textAlign: "center", whiteSpace: "pre-line", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        {"콩나물 · 소고기\n무밥"}
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
                  냉장고 재료로, <span style={{ color: "#D99A00" }}>오늘 저녁 해결</span>
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

export const CookingMuBap: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      {KIDS_CAPTIONS.map((c, k) => (
        <Sequence key={"kc" + k} from={kidsAt(c.from)} durationInFrames={kidsAt(c.to + 1) - kidsAt(c.from)}>
          <Caption from={2} len={kidsAt(c.to + 1) - kidsAt(c.from) - 4} text={c.text} />
        </Sequence>
      ))}
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
