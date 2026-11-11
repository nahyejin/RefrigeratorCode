import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { CTA_LEN, Mark, fade } from "./ReelOverview";
import { SearchBanner } from "./TalkReels";
import { FeatureTailBody, FEATURE_TAIL_V2_LEN } from "./FeatureDemosV2";

// 요리 릴스 7편 — 도아랑 연유쿠키(2026-11-11 빼빼로데이). 레시피는 메리니즈부엌 「연유쿠키 만들기」(쿡매치에 있는 레시피, 170도 20분).
// 사용자 요청: 장보기 → 반죽 → 냉장고 → 도아랑 틀 찍기 → 도아가 오븐에 넣기, 특히 도아가 의미 있는 「말」을 할 때 우선.
// 쿠키 만들기 = 아이에게는 오감 놀이이자 특별한 교육(쿠키 교실) → 엄마들이 쿡매치를 쓰고 싶게.
// 순서: 후킹(쟁반 든 도아 사진) → 마트(강아지 포장 봉투, 「내일 친구들 줄 거야?」) → 차 안 연습(「친구야, 내가 이거 만들었어」)
// → 반죽 타임랩스 → 냉장고 → 쿠키 교실(틀 찍기·나눔 대화) → 오븐 → 완성(「아냐, 도아가 만들었어」) → 포장(숫자 세기) → 스크린샷 컷
// → 쿡매치(「쿠키」 검색 + 쿡 코치에게 설탕 20g 질문) → CTA → 그 밖에도 + 기능 8개 → CTA(맨 끝).
// 대사·시각은 scripts/words_cookie_20261111.py 받아쓰기(public/cooking/연유쿠키_20261111/words.txt) 기준. 원본은 git 제외.

const DIR = "cooking/연유쿠키_20261111/work/";
const f = (s: number) => Math.round(s * 30);

// t0·t1 은 원본 영상의 초(자막을 원본 시각 그대로 적는다)
type Line = { t0: number; t1: number; text: string };
type Card = { title: string; items: string[] };
type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; cap?: string; capAt?: number; talk?: Line[]; think?: Line[]; app?: boolean; card?: Card }
  | { kind: "photo"; src: string; len: number; cap?: string; origin?: string; snap?: boolean; card?: Card }
  | { kind: "cta"; len: number }
  | { kind: "tail"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// ── 후킹 = 썸네일(프로필 그리드 3:4, y 240~1680 안에)
const HOOK = { len: 3.2, text: "우리 집이\n쿠키 교실이 됐어요", sub: "반죽 · 틀 찍기 · 오븐 · 나눔" };
const OPEN: Shot[] = [{ kind: "photo", src: "p_113312_141.jpg", len: f(HOOK.len), origin: "50% 45%" }];

// ── 오늘의 이야기: 빼빼로데이, 친구들 줄 쿠키
const STORY: Shot[] = [
  { kind: "video", src: "091241.mp4", from: 0, to: 9.4, audio: true, cap: "도아가 직접 고른\n강아지 포장 봉투", talk: [
    { t0: 0.2, t1: 3.6, text: "뭐 산 거야? / 강아지야?" },
    { t0: 3.7, t1: 7.4, text: "내일 친구들 / 이걸로 줄 거야?" },
    { t0: 8.3, t1: 9.4, text: "응!" },
  ] },
  { kind: "video", src: "092414.mp4", from: 13.6, to: 17.7, audio: true, cap: "돌아오는 차 안에서\n건네줄 말 미리 연습", talk: [
    { t0: 14.0, t1: 16.3, text: "친구야, / 내가 이거 만들었어" },
    { t0: 16.5, t1: 17.7, text: "이거 먹어!" },
  ] },
  { kind: "video", src: "092414.mp4", from: 25.2, to: 30.0, audio: true, cap: "엄마는 친구 역할", talk: [
    { t0: 25.3, t1: 27.5, text: "쿠키? 고마워" },
    { t0: 27.6, t1: 30.0, text: "도아야, 잘 먹을게" },
  ] },
];

// ── 반죽(엄마) — 타임랩스(dough_*.mp4 는 ffmpeg 로 미리 빨리 감음), 레시피 카드의 재료 순서
const DOUGH: Shot[] = [
  { kind: "video", src: "dough_0.mp4", from: 0, to: 2.0, cap: "말랑한 버터에\n설탕 · 소금" },
  { kind: "video", src: "dough_1.mp4", from: 0, to: 2.5, cap: "연유 듬뿍" },
  { kind: "video", src: "dough_2.mp4", from: 0, to: 2.5, cap: "박력분은 체에 쳐서" },
  { kind: "video", src: "dough_3.mp4", from: 0, to: 4.0, cap: "한 덩어리로 뭉치면 반죽 끝" },
  { kind: "video", src: "104752.mp4", from: 0, to: 10.6, rate: 3, cap: "반죽은 냉장고에서\n30분 쉬어 가기" },
];

const LESSON_CARD: Card = {
  title: "오늘의 쿠키 교실",
  items: ["말랑한 반죽 만지기", "틀로 모양 찍기", "오븐 앞에서 기다리기", "하나 둘 셋, 숫자 세기", "친구 · 선생님과 나누기"],
};

// ── 쿠키 교실 — 도아가 틀로 찍는다(사자·토끼·곰돌이·버스 틀)
const CLASS: Shot[] = [
  { kind: "video", src: "111525.mp4", from: 146.3, to: 153.0, audio: true, cap: "엄마가 한 것처럼\n꾹 누르고, 쏙 빼고", capAt: 0.8, talk: [
    { t0: 146.5, t1: 148.7, text: "엄마 한 것처럼 / 해 봐, 빼 봐" },
    { t0: 152.1, t1: 153.0, text: "빼 봐!" },
  ] },
  { kind: "video", src: "111525.mp4", from: 603.9, to: 609.6, audio: true, cap: "모양 맞추기는\n손끝으로 하는 놀이", talk: [
    { t0: 604.1, t1: 607.6, text: "도아가 만든 거!" },
    { t0: 607.6, t1: 609.6, text: "자동차!" },
  ] },
  { kind: "video", src: "111525.mp4", from: 898.8, to: 910.2, rate: 1.4, audio: true, cap: "다 먹을 거라더니…", talk: [
    { t0: 899.0, t1: 900.2, text: "친구들은?" },
    { t0: 901.9, t1: 903.7, text: "친구랑 / 나눠 먹을 거야?" },
    { t0: 903.8, t1: 904.6, text: "응!" },
    { t0: 905.0, t1: 910.2, text: "이거 친구랑 / 같이 나눠 먹을 거야" },
  ] },
  { kind: "video", src: "111525.mp4", from: 973.4, to: 977.8, audio: true, cap: "손으로 만지고, 찍고, 웃고", talk: [
    { t0: 973.9, t1: 975.5, text: "아, 재밌다!" },
    { t0: 976.5, t1: 977.3, text: "재밌어?" },
    { t0: 977.3, t1: 977.8, text: "응!" },
  ] },
];

// ── 오븐 — 사진 세 장(찰칵) → 도아가 직접 넣기
const OVEN: Shot[] = [
  { kind: "photo", src: "p_113305_662.jpg", len: f(0.9), snap: true, origin: "50% 40%" },
  { kind: "photo", src: "p_113310_273.jpg", len: f(0.9), snap: true, origin: "50% 40%" },
  { kind: "video", src: "113321.mp4", from: 0, to: 7.0, audio: true, cap: "오븐에 넣는 것도 도아가\n170도에서 20분", capAt: 2.2, talk: [
    { t0: 0.1, t1: 3.6, text: "이렇게 살살, / 살살" },
    { t0: 6.0, t1: 7.0, text: "이제 닫아 줘" },
  ] },
];

// ── 완성 → 맛보기 → 포장
const DONE: Shot[] = [
  { kind: "video", src: "122506.mp4", from: 19.6, to: 23.6, audio: true, cap: "드디어 완성!", talk: [{ t0: 19.7, t1: 21.0, text: "열어 봐!" }] },
  { kind: "video", src: "122506.mp4", from: 50.3, to: 53.5, audio: true, talk: [
    { t0: 50.4, t1: 51.5, text: "어때?" },
    { t0: 51.9, t1: 53.5, text: "맛있어?" },
  ] },
  { kind: "video", src: "122506.mp4", from: 56.7, to: 62.8, audio: true, talk: [
    { t0: 56.8, t1: 59.3, text: "엄마가 반죽했다!" },
    { t0: 59.4, t1: 61.1, text: "아냐, / 도아가 만들었어!" },
    { t0: 61.3, t1: 62.8, text: "내일 친구 나눠 줘" },
  ] },
  { kind: "video", src: "122638.mp4", from: 102.0, to: 105.2, audio: true, card: LESSON_CARD, talk: [
    { t0: 102.2, t1: 104.2, text: "내일 친구들 / 몇 명 줄 거야?" },
    { t0: 104.3, t1: 105.2, text: "다섯 명?" },
  ] },
  { kind: "video", src: "122638.mp4", from: 117.9, to: 122.4, audio: true, card: LESSON_CARD, talk: [
    { t0: 118.0, t1: 120.3, text: "하나, 둘, 셋, / 넷, 다섯" },
    { t0: 120.4, t1: 122.3, text: "다섯 명이니까 / 다섯 개" },
  ] },
  // 사용자가 예뻐서 찍어 둔 스크린샷(소파에서 쿠키를 내미는 도아)
  { kind: "photo", src: "s_124813.jpg", len: f(1.8), snap: true, origin: "50% 45%", card: LESSON_CARD },
];

// ── 쿡매치 — 앱 녹화(상태바 잘라 냄, 이름·알림 배너 흐림: app_*.mp4)
const APP: Shot[] = [
  { kind: "video", src: "app_search.mp4", from: 9.0, to: 13.0, rate: 2, app: true, cap: "아이랑 만들 쿠키는\n쿡매치에서 「쿠키」 검색" },
  { kind: "video", src: "app_search.mp4", from: 13.6, to: 16.4, app: true, cap: "집에서 굽는 쿠키 레시피가\n한눈에" },
  { kind: "video", src: "app_coach.mp4", from: 15.0, to: 17.2, app: true, cap: "도아랑 만든 연유쿠키\n재료 5개, 내 재료 100%" },
  { kind: "video", src: "app_coach.mp4", from: 17.2, to: 30.4, rate: 4, app: true, cap: "반죽하다 궁금하면\n쿡 코치에게 물어봐요" },
  { kind: "video", src: "app_coach.mp4", from: 31.0, to: 36.4, app: true, cap: "「설탕 20g이면 어느 정도?」\n밥숟가락 2스푼 정도래요" },
];

const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "tail", len: FEATURE_TAIL_V2_LEN },
  { kind: "cta", len: CTA_LEN },
];

const SHOTS: Shot[] = [...OPEN, ...STORY, ...DOUGH, ...CLASS, ...OVEN, ...DONE, ...APP, ...TAIL];
export const COOKING_MILK_COOKIE_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const sum = (xs: Shot[]) => xs.reduce((a, x) => a + shotLen(x), 0);
const DOUGH_FROM = sum([...OPEN, ...STORY]);
const CLASS_FROM = DOUGH_FROM + sum(DOUGH);
const APP_FROM = sum([...OPEN, ...STORY, ...DOUGH, ...CLASS, ...OVEN, ...DONE]);
const TITLE_LEN = f(3.6);

const Video: React.FC<{ s: Extract<Shot, { kind: "video" }>; len: number }> = ({ s, len }) => {
  const rate = s.rate ?? 1;
  const at = (t: number) => Math.round(f(t - s.from) / rate);
  const video = (
    <OffthreadVideo
      src={staticFile(DIR + s.src)}
      trimBefore={f(s.from)}
      trimAfter={f(s.to)}
      playbackRate={rate}
      muted={!s.audio}
      volume={s.audio ? 1 : 0}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: s.app ? WHITE : "#000" }}>
      {s.app ? (
        // 앱 녹화 — 폰 비율 그대로 가운데(양옆 흰 여백), 얇은 테두리
        <div style={{ position: "absolute", top: 0, left: (1080 - 940) / 2, width: 940, height: 1920, overflow: "hidden", border: `1px solid ${LINE}` }}>{video}</div>
      ) : (
        video
      )}
      {s.cap && <Caption from={f(s.capAt ?? 0) + 3} len={len - f(s.capAt ?? 0) - 5} text={s.cap} />}
      {s.talk?.map((t, k) => (
        <Sequence key={k} from={at(t.t0)} durationInFrames={Math.max(12, at(t.t1) - at(t.t0))}>
          <Talk text={t.text} len={Math.max(12, at(t.t1) - at(t.t0))} />
        </Sequence>
      ))}
      {s.card && <LessonCard card={s.card} />}
    </AbsoluteFill>
  );
};

// 실제로 한 말 — 상자 없는 굵은 흰 글씨 + 검은 외곽선, 단어가 톡톡, 지금 단어만 노랗게(CookingCookie 와 같은 모양)
const Talk: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chunks = text.split(" / ");
  const per = len / chunks.length;
  const ci = Math.min(chunks.length - 1, Math.floor(frame / per));
  const local = frame - ci * per;
  const words = chunks[ci].split(" ");
  const span = Math.max(8, Math.min(per * 0.6, words.length * 8));
  const o = interpolate(frame, [len - 4, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cur = Math.min(words.length - 1, Math.floor((local / span) * words.length));
  const stroke = { WebkitTextStroke: "14px #000", paintOrder: "stroke fill" } as React.CSSProperties;
  return (
    <div style={{ position: "absolute", top: 430, left: 60, right: 60, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.22, wordBreak: "keep-all" }}>
        {words.map((w, k) => {
          const a = (k / words.length) * span;
          const p = spring({ frame: local - a, fps, config: { damping: 11, mass: 0.45 } });
          return (
            <span key={`${ci}-${k}`} style={{ display: "inline-block", margin: "0 12px", color: k === cur ? YELLOW : WHITE, opacity: local >= a ? 1 : 0, transform: `scale(${interpolate(p, [0, 1], [0.5, 1])}) rotate(${k === cur ? -2 : 0}deg)`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))", ...stroke }}>
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// 사진 — 천천히 다가간다. snap: 찰칵(흰 번쩍임) 후 살짝 기울어진 사진처럼
const Photo: React.FC<{ s: Extract<Shot, { kind: "photo" }>; len: number; first: boolean }> = ({ s, len, first }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, len], [1.0, 1.08], { easing: Easing.inOut(Easing.cubic) });
  const o = first ? interpolate(frame, [len - 4, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const flash = s.snap ? interpolate(frame, [0, 6], [0.85, 0], { extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: o }}>
      <Img src={staticFile(DIR + s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.origin ?? "50% 50%", transform: `scale(${z})`, transformOrigin: s.origin ?? "50% 50%" }} />
      {s.cap && <Caption from={4} len={len - 6} text={s.cap} />}
      {s.card && <LessonCard card={s.card} />}
      {flash > 0 && <AbsoluteFill style={{ backgroundColor: WHITE, opacity: flash }} />}
    </AbsoluteFill>
  );
};

// 「오늘의 쿠키 교실」 — 쿠키 만들기가 아이에게 무엇을 배우게 했는지(사용자: 오감 놀이·특별한 교육). 포장 장면 아래쪽에 계속 떠 있다
const LessonCard: React.FC<{ card: Card }> = ({ card }) => (
  <div style={{ position: "absolute", top: 1090, left: 56, right: 56, padding: "26px 38px 30px", borderRadius: 36, backgroundColor: "rgba(0,0,0,0.78)", fontFamily: FONT_FAMILY }}>
    <div style={{ color: YELLOW, fontSize: 56, fontWeight: 900, marginBottom: 10 }}>{card.title}</div>
    {card.items.map((it, k) => (
      <div key={k} style={{ display: "flex", alignItems: "center", gap: 18, color: WHITE, fontSize: 48, fontWeight: 800, lineHeight: 1.42 }}>
        <span style={{ color: YELLOW }}>✓</span>
        {it}
      </div>
    ))}
  </div>
);

// 반죽 첫 장면 위 — 오늘의 레시피 제목
const RecipeTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 2, fps, config: { damping: 15, mass: 0.7 } });
  const out = interpolate(frame, [TITLE_LEN - 8, TITLE_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 230, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * -24}px)`, fontFamily: FONT_FAMILY }}>
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>재료 5개 · 170도 20분</div>
      <div style={{ color: WHITE, fontSize: 104, fontWeight: 900, lineHeight: 1.15, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>연유쿠키</div>
    </div>
  );
};

// 쿠키 교실 시작 — 「도아의 쿠키 교실」 칩
const ClassTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 2, fps, config: { damping: 13, mass: 0.6 } });
  const out = interpolate(frame, [TITLE_LEN - 8, TITLE_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 210, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: Math.min(p, out), transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`, fontFamily: FONT_FAMILY }}>
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 68, fontWeight: 900, padding: "14px 44px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.3)" }}>🍪 도아의 쿠키 교실</div>
    </div>
  );
};

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const len = f(HOOK.len);
  // 썸네일로 쓰므로 첫 프레임부터 꽉 보이게 — 사라질 때만 페이드. 그리드(3:4) 안 y 700~1250
  const o = interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 700, left: 30, right: 30, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", wordBreak: "keep-all", fontSize: 118, fontWeight: 900, lineHeight: 1.18, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
      <div style={{ marginTop: 26 }}>
        <span style={{ display: "inline-block", backgroundColor: WHITE, color: INK, fontSize: 58, fontWeight: 900, padding: "10px 36px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.35)" }}>{HOOK.sub}</span>
      </div>
    </div>
  );
};

const Cta: React.FC = () => (
  <CtaOutro
    payoffLine={
      <>
        아이랑 쿠키 교실도, <Mark>쿡매치에서</Mark>
      </>
    }
  />
);

export const CookingMilkCookie: React.FC = () => {
  useCustomFont();
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      {SHOTS.map((s, i) => {
        const from = cursor;
        const len = shotLen(s);
        cursor += len;
        let body: React.ReactNode = null;
        if (s.kind === "video") body = <Video s={s} len={len} />;
        else if (s.kind === "photo") body = <Photo s={s} len={len} first={i === 0} />;
        else if (s.kind === "cta") body = <Cta />;
        else if (s.kind === "tail") body = <FeatureTailBody />;
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`${i + 1}-${s.kind}${s.kind === "video" || s.kind === "photo" ? "-" + s.src : ""}`}>
            {body}
          </Sequence>
        );
      })}
      <Sequence from={DOUGH_FROM} durationInFrames={TITLE_LEN} name="레시피 제목">
        <RecipeTitle />
      </Sequence>
      <Sequence from={CLASS_FROM} durationInFrames={TITLE_LEN} name="쿠키 교실">
        <ClassTitle />
      </Sequence>
      <Sequence from={APP_FROM} durationInFrames={sum(APP)} name="검색 안내">
        <AppFade len={sum(APP)} />
      </Sequence>
      <Sequence from={0} durationInFrames={f(HOOK.len)} name="후킹">
        <Hook />
      </Sequence>
    </AbsoluteFill>
  );
};

// 앱 구간 내내 하단 가운데 「쿡매치 검색」 안내(CookieTailV2 와 같은 자리)
const AppFade: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, len) }}>
      {/* 자막 상자(y 1400~1610)와 겹치지 않게 맨 아래로 */}
      <SearchBanner bottom={30} scale={0.78} panel />
    </AbsoluteFill>
  );
};
