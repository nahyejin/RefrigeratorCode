import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark, OverviewSegments, OverviewCta, SEGS_LEN } from "./ReelOverview";

// 요리 릴스 2편 — 황태미역국(2026-10-17, 친정에서 할아버지 생신).
// ① 생신 영상(아이의 생일 축하 노래 원음) + 이야기 자막(할머니가 고기를 못 드셔서 엄마가 「황태로 끓이자」)
// → ② 「황태 미역국이 있어?!」 쿡매치 검색 + 꼭 넣을 재료 「황태」 + 인기순 → 검증된 레시피 → ③ 레시피대로 끓이기(단계 자막)
// → ④ 완성 사진 →(먹는 영상: 받으면 EAT 에 추가) → ⑤ 이 편 슬로건(7편 검증된 레시피) → ⑥ 그 밖에도 → ⑦ 8개 기능 → ⑧ 대표 슬로건.
// 원본은 public/cooking/황태미역국_20261017/ (git 제외). 가이드 my-video/COOKING_REEL_GUIDE.md.

const DIR = "cooking/황태미역국_20261017/work/";
const f = (s: number) => Math.round(s * 30);

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean }
  | { kind: "plate"; len: number; caption: string }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number }
  | { kind: "features"; len: number }
  | { kind: "finalCta"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 생신 영상 — 아이가 「사랑하는 할아버지의 생일 축하합니다」를 부르는 원음 그대로, 이야기는 자막으로
const STORY: Shot[] = [{ kind: "video", src: "c01_050235.mp4", from: 0, to: 16.5, audio: true }];
const STORY_LINES = [
  { at: 3.0, len: 3.5, text: "할아버지 생신이라\n아이 데리고 친정에 왔어요", big: false },
  { at: 6.7, len: 3.7, text: "할머니가 고기 소화를 못 하시고\n이도 약해지셔서", big: false },
  { at: 10.6, len: 2.6, text: "「할머니, 무슨 미역국 드실 수 있어요?」", big: false },
  { at: 13.3, len: 3.2, text: "「황태로 부드럽게 끓이면\n먹을 수 있으려나…」", big: false },
];
// 첫 훅 — 의아함을 준다(2026-10-17 사용자 요청)
const HOOK = { at: 0.15, len: 2.75, text: "황태로도\n미역국을 끓인다고?" };

// 쿡매치에서 찾기 — 앱 작업본(1206x2422) 시각
const APP: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 60.5, to: 64, rate: 1.2, app: true, step: "황태 미역국이 있어…?!\n쿡매치에서 「미역국」 검색" },
  { kind: "video", src: "app_raw.mp4", from: 65, to: 70.6, rate: 1.4, app: true, step: "꼭 넣을 재료에 「황태」" },
  { kind: "video", src: "app_raw.mp4", from: 71.5, to: 75.6, app: true, step: "그중에서도 「인기순」으로" },
  { kind: "video", src: "app_raw.mp4", from: 76, to: 81, rate: 1.8, app: true, step: "있다! 황태 미역국\n유튜브·네이버 검증 레시피" },
  { kind: "video", src: "app_raw.mp4", from: 83, to: 93, rate: 2.2, app: true, step: "재료·조리 순서 그대로\n따라 하면 돼요" },
];

// 요리 단계(레시피 카드 순서와 같게) — 분량은 레시피 카드 그대로, 소리는 끄고 음악
const COOK: Shot[] = [
  { kind: "video", src: "c02_091153.mp4", from: 0, to: 24, rate: 4, step: "건미역은 물에 10~15분 불려요" },
  { kind: "video", src: "c02_091153.mp4", from: 55, to: 75, rate: 4, step: "황태는 물 두어 큰술에 적셔\n부드럽게, 먹기 좋게 잘라요" },
  { kind: "video", src: "c03_092040.mp4", from: 2, to: 9, rate: 1.6, step: "냄비에 들기름 1.5큰술" },
  { kind: "video", src: "c03_092040.mp4", from: 15.5, to: 21, rate: 1.2, step: "황태 넣고 풍미 있게 볶다가" },
  { kind: "video", src: "c04_092252.mp4", from: 46, to: 62, rate: 2.5, step: "불린 미역 넣고\n부드러워질 때까지 볶아요" },
  { kind: "video", src: "c05_092915.mp4", from: 0, to: 6, rate: 1.5, step: "물 1.2L 붓고" },
  { kind: "video", src: "c05_092915.mp4", from: 21, to: 26.5, step: "국간장 2큰술" },
  { kind: "video", src: "c09_094900.mp4", from: 0, to: 7.9, step: "끓어오르면 뚜껑 덮고\n중불로 30분" },
  { kind: "video", src: "c06_093210.mp4", from: 13, to: 21, rate: 1.6, step: "참치액 1.5 · 다진 마늘 ½큰술\n넣고 한소끔" },
  { kind: "video", src: "c07_094443.mp4", from: 9, to: 18, rate: 2, step: "모자란 간은 소금으로" },
];
const PLATE: Shot[] = [{ kind: "plate", len: 105, caption: "고기 없이도 깊은 맛\n부드러워서 할머니도 술술" }];
// 먹는 영상 — 사용자가 올리면 여기에 넣는다(대사가 있으면 audio: true + 큰 자막)
const EAT: Shot[] = [
  { kind: "video", src: "eat.mp4", from: 1.0, to: 5.0, step: "생신상에 올렸더니" },
  { kind: "video", src: "eat.mp4", from: 6.6, to: 13.0, rate: 1.4, step: "할아버지도 한 그릇 뚝딱" },
  { kind: "video", src: "eat.mp4", from: 27.9, to: 34.5, audio: true },
  { kind: "video", src: "eat.mp4", from: 49.1, to: 52.3, audio: true },
];
// 먹는 영상 대화(eat.mp4 원본 시각) — 엄마 「무슨 미역국이야 이게?」 28.14 · 아이 「주황색 미역국이야!」 32.36 · 엄마 「이게 황태가 주황색으로 보이는구나」 49.3
const EAT_TALK = [
  { shot: 2, at: 28.14, len: 1.9, text: "도아야, 무슨 미역국이야?", who: "mom" as const },
  { shot: 2, at: 32.3, len: 2.2, text: "주황색 미역국!", who: "kid" as const },
  { shot: 3, at: 49.25, len: 3.0, text: "황태가 주황색으로 보였구나 🧡", who: "mom" as const },
];
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: INTRO },
  { kind: "features", len: SEGS_LEN },
  { kind: "finalCta", len: CTA_LEN },
];
const SHOTS: Shot[] = [...STORY, ...APP, ...COOK, ...PLATE, ...EAT, ...TAIL];
export const COOKING_MIYEOK_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(3.4);
const STORY_LEN = STORY.reduce((a, s) => a + shotLen(s), 0);
const COOK_START = [...STORY, ...APP].reduce((a, s) => a + shotLen(s), 0);
const startOf = (target: Shot) => { let t = 0; for (const x of SHOTS) { if (x === target) return t; t += shotLen(x); } return 0; };
// 원음을 쓰는 장면(생신 노래·먹으며 나눈 대화) — 이때는 음악을 끈다
const TALK_WINDOWS = SHOTS.filter(x => x.kind === "video" && x.audio).map(x => [startOf(x), startOf(x) + shotLen(x)] as const);

const fadeInOut = (frame: number, len: number, k = 5) =>
  Math.min(
    interpolate(frame, [0, k], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [len - k, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

const Video: React.FC<{ s: Extract<Shot, { kind: "video" }>; len: number }> = ({ s, len }) => {
  const video = (
    <OffthreadVideo
      src={staticFile(DIR + s.src)}
      trimBefore={f(s.from)}
      trimAfter={f(s.to)}
      playbackRate={s.rate ?? 1}
      muted={!s.audio}
      style={{ width: "100%", height: "100%", objectFit: s.app ? "contain" : "cover" }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: s.app ? WHITE : "#000" }}>
      {s.app ? (
        // 앱 녹화(1206x2422) — 높이에 맞춰 가운데, 얇은 테두리
        <div style={{ position: "absolute", top: 0, left: (1080 - 956) / 2, width: 956, height: 1920, border: `1px solid ${LINE}` }}>{video}</div>
      ) : (
        video
      )}
      {s.step && <Caption from={6} len={len - 8} text={s.step} />}
    </AbsoluteFill>
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
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>고기 없이 부드럽게</div>
      <div style={{ color: WHITE, fontSize: 104, fontWeight: 900, lineHeight: 1.15, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        황태미역국
      </div>
    </div>
  );
};

// 아이 식판 사진 — 천천히 다가간다
const Plate: React.FC<{ len: number; caption: string }> = ({ len, caption }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, len], [1.0, 1.15], { easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeInOut(frame, len, 4) }}>
      <Img src={staticFile(DIR + "photo.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 60%", transform: `scale(${z})`, transformOrigin: "55% 65%" }} />
      <Caption from={6} len={len - 8} text={caption} />
    </AbsoluteFill>
  );
};

// 아이 목소리 자막 — 말풍선 느낌의 흰 글자(타이핑 없이 바로)
const Said: React.FC<{ at: number; len: number; text: string; who: "mom" | "kid" }> = ({ at, len, text, who }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0 || local > len) return null;
  const o = fadeInOut(local, len, 4);
  const p = spring({ frame: local, fps: 30, config: { damping: 12, mass: 0.5 } });
  return (
    <div style={{ position: "absolute", top: who === "kid" ? 1180 : 1040, left: 0, right: 0, textAlign: "center", opacity: o, transform: `scale(${interpolate(p, [0, 1], [0.85, 1])})`, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: who === "kid" ? 96 : 64, fontWeight: 900, color: who === "kid" ? YELLOW : WHITE, textShadow: "0 4px 16px rgba(0,0,0,0.75), 0 0 4px rgba(0,0,0,0.7)" }}>{text}</span>
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
        else if (s.kind === "plate") body = <Plate len={len} caption={s.caption} />;
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
              line1="그 밖에도"
              line2={
                <>
                  이런 <Mark>기능</Mark>이 있어요
                </>
              }
            />
          );
        else if (s.kind === "features") body = <OverviewSegments />;
        else body = <OverviewCta />;
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`${i + 1}-${s.kind}${s.kind === "video" ? "-" + s.src : ""}`}>
            {body}
          </Sequence>
        );
      })}
    </>
  );
};

// 브이로그 BGM — 생신 노래(원음)가 나오는 이야기 장면에서는 음악을 끄고, 그 뒤부터 깐다
const Bgm: React.FC = () => (
  <Audio
    src={staticFile("bgm_waltz_warm.mp3")}
    volume={(fr) => {
      let v = Math.min(
        interpolate(fr, [STORY_LEN - 10, STORY_LEN + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        interpolate(fr, [COOKING_MIYEOK_TOTAL - 45, COOKING_MIYEOK_TOTAL - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      );
      for (const [a, b] of TALK_WINDOWS) {
        if (a < STORY_LEN) continue;
        v = Math.min(v, interpolate(fr, [a - 12, a, b, b + 15], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
      }
      return 0.42 * v;
    }}
  />
);

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const len = f(HOOK.len);
  const p = spring({ frame, fps: 30, config: { damping: 12, mass: 0.6 } });
  const o = fadeInOut(frame, len, 5);
  return (
    <div style={{ position: "absolute", top: 640, left: 40, right: 40, textAlign: "center", opacity: o, transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: 118, fontWeight: 900, lineHeight: 1.18, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
    </div>
  );
};

export const CookingMiyeok: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      {STORY_LINES.map((l, i) => (
        <Sequence key={i} from={f(l.at)} durationInFrames={f(l.len)}>
          {l.big ? <Said at={0} len={f(l.len)} text={l.text} who="kid" /> : <Caption from={0} len={f(l.len)} text={l.text} />}
        </Sequence>
      ))}
      <Sequence from={COOK_START} durationInFrames={TITLE_LEN}>
        <RecipeTitle />
      </Sequence>
      <Sequence from={f(HOOK.at)} durationInFrames={f(HOOK.len)}>
        <Hook />
      </Sequence>
      {EAT_TALK.map((t, i) => {
        const shot = EAT[t.shot] as Extract<Shot, { kind: "video" }>;
        return <Said key={i} at={startOf(shot) + f(t.at - shot.from)} len={f(t.len)} text={t.text} who={t.who} />;
      })}
      <Bgm />
    </AbsoluteFill>
  );
};
