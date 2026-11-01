import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark } from "./ReelOverview";
import { SearchBanner } from "./TalkReels";

// 요리 릴스 4편 — 캠핑 다음날, 남은 면으로 햄 알리오올리오(2026-11-01 아침).
// 3편 캠핑 밤: 도아가 추워서 울다가 파스타를 한 입도 못 먹음 → 면 3인분이 남아 싸 옴(사용자 이야기, 실제 인물·사연)
// ① 도아가 먹는 장면 + 후킹 → ② 어젯밤 캠핑(3편 장면) → ③ 남은 면, 팬을 들여다보는 도아(원래 소리) → ④ 요리(단계 자막)
// → ⑤ 먹는 도아(원래 소리) → ⑥ 원래 레시피 / 이렇게 바꿨어요 → ⑦ 쿡매치(검색 → 7/9·쪽파→대파 → 조리 순서 → 캘린더) → ⑧ 슬로건 → 그 밖에도.
// 도아에게 하는 말은 받아 적지 못해(음성 인식 막힘) 원래 소리로만 두고, 자막은 화면에 보이는 사실만.
// 원본은 public/cooking/남은면파스타_20261101/ (git 제외). 작업본은 ffmpeg 로 미리 9:16·배속(k1~k9, 원본 24분 요리 영상).

const DIR = "cooking/남은면파스타_20261101/work/";
const DIR3 = "cooking/새우알리오올리오_20261031/work/";
const f = (s: number) => Math.round(s * 30);

type PackList = { title: string; items: { at: number; text: string; head?: boolean }[]; bottom?: boolean; small?: boolean; hint?: string };

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean; list?: PackList; dir?: string }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string; pan?: boolean; list?: PackList; dir?: string }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 첫 장면 = 다음 날 파스타를 먹는 도아 + 큰 노란 후킹(썸네일 겸용)
const HOOK = { at: 0, len: 2.8, text: "캠핑에서 못 먹인 파스타\n다음날 다시 해 줬어요" };
const OPEN: Shot[] = [{ kind: "photo", src: "hook.jpg", len: f(2.8), origin: "50% 40%" }];

// 어젯밤 캠핑 — 3편 장면을 다시 쓴다
const RECAP: Shot[] = [
  { kind: "video", src: "n_090542.mp4", dir: DIR3, from: 0, to: 2.8, rate: 1.0, step: "어젯밤 캠핑에서 만든\n새우 알리오올리오" },
  { kind: "photo", src: "plate.jpg", dir: DIR3, len: f(3.4), origin: "50% 55%", caption: "도아는 너무 추워서 울다가\n한 입도 못 먹었어요" },
];
// 남은 면 → 팬을 들여다보는 도아(원래 소리)
const LEFT: Shot[] = [
  { kind: "photo", src: "leftover.jpg", len: f(3.0), origin: "50% 60%", caption: "면은 3인분이나 남아서\n집에 싸 왔어요" },
  { kind: "video", src: "pan.mp4", from: 0.8, to: 12.5, audio: true, step: "다음 날 아침\n남은 면을 본 도아" },
];
const COMMENT_HINT = "상세 레시피가 필요하면\n팔로우 + 댓글에 「쿡매치」\nDM으로 보내 드릴게요 💌";

// 요리 — 원본 24분을 단계마다 잘라 배속해 둔 작업본(k1~k9)
const COOK: Shot[] = [
  { kind: "video", src: "k1.mp4", from: 0, to: 5.0, step: "통마늘은 편으로" },
  { kind: "video", src: "k2.mp4", from: 0, to: 5.0, step: "방울토마토는 반으로" },
  { kind: "video", src: "k3.mp4", from: 0, to: 4.6, step: "파 송송" },
  { kind: "video", src: "k4.mp4", from: 0, to: 6.0, step: "새우 대신\n도아가 좋아하는 햄" },
  { kind: "video", src: "k5.mp4", from: 0, to: 5.9, step: "올리브오일에\n냉동 다진 마늘" },
  { kind: "video", src: "k6.mp4", from: 0, to: 5.0, step: "편 마늘 · 파 넣고\n향 내기" },
  { kind: "video", src: "k7.mp4", from: 0, to: 6.0, step: "햄 넣고 볶다가" },
  { kind: "video", src: "k8.mp4", from: 0, to: 6.2, step: "어제 삶아 둔 면과\n방울토마토" },
  { kind: "video", src: "k9.mp4", from: 0, to: 5.0, step: "파마산 치즈 솔솔" },
];
const PLATE: Shot[] = [{ kind: "photo", src: "done.jpg", len: f(2.6), caption: "햄 알리오올리오 완성!", origin: "50% 60%" }];
// 먹는 도아(원래 소리)
const EAT: Shot[] = [{ kind: "video", src: "eat.mp4", from: 2.5, to: 15.5, audio: true, step: "오늘은\n맛있게 냠냠" }];

// 원래 레시피(앱 조리 순서 화면) → 이렇게 바꿨어요
const RECIPE: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 18.0, to: 26.0, app: true, list: { title: "원래 레시피는 이래요", bottom: true, hint: COMMENT_HINT, items: [
    { at: 0.3, text: "물 · 소금에 면 삶기" }, { at: 0.9, text: "올리브유에 편 마늘 · 페퍼론치노" },
    { at: 1.5, text: "간 마늘 넣고 노릇하게" }, { at: 2.1, text: "면 넣고 면수 부어 센 불에" },
    { at: 2.7, text: "쪽파 · 파마산 치즈로 완성" },
  ] } },
  { kind: "photo", src: "done.jpg", len: f(6.0), origin: "50% 65%", list: { title: "이렇게 바꿨어요", small: true, hint: COMMENT_HINT, items: [
    { at: 0.2, text: "면은 어제 남은 면", head: true }, { at: 0.5, text: "삶기는 건너뛰고 바로 볶기" },
    { at: 1.3, text: "도아 입맛에 맞게", head: true }, { at: 1.6, text: "햄 · 방울토마토 추가" },
    { at: 2.2, text: "간 마늘은 냉동 다진 마늘로" },
  ] } },
];

// 쿡매치 앱 녹화(상태 표시줄 잘라 낸 작업본 884x1790, 원본과 같은 시각)
const APP: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 11.0, to: 13.4, app: true, step: "남은 면으로 뭘 할까?\n쿡매치에서 「알리오올리오」" },
  { kind: "video", src: "app_raw.mp4", from: 13.4, to: 16.4, rate: 0.8, app: true, step: "내 재료로 7/9 (76%)\n없는 쪽파는 대파로" },
  { kind: "video", src: "app_raw.mp4", from: 26.0, to: 30.0, rate: 1.2, app: true, step: "조리 순서도 한눈에" },
  { kind: "video", src: "app_raw.mp4", from: 30.0, to: 37.4, rate: 1.5, app: true, step: "먹은 날은\n마이캘린더에 담아요" },
];
const OUTRO_LEN = INTRO + 75;
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: OUTRO_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...RECAP, ...LEFT, ...COOK, ...PLATE, ...EAT, ...RECIPE, ...APP, ...TAIL];
export const COOKING_LEFTOVER_PASTA_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(3.4);
const COOK_START = [...OPEN, ...RECAP, ...LEFT].reduce((a, s) => a + shotLen(s), 0);
const BANNER_FROM = [...OPEN, ...RECAP, ...LEFT, ...COOK, ...PLATE, ...EAT, ...RECIPE].reduce((a, s) => a + shotLen(s), 0);
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
      {s.list && <PackCard list={s.list} />}
    </AbsoluteFill>
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
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>어제 남은 면으로</div>
      <div style={{ color: WHITE, fontSize: 104, fontWeight: 900, lineHeight: 1.15, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        햄 알리오올리오
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
                  버리기 전에, <span style={{ color: "#D99A00" }}>있는 재료부터 요리하세요</span>
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
    <div style={{ position: "absolute", top: 1060, left: 40, right: 40, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: 118, fontWeight: 900, lineHeight: 1.18, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
    </div>
  );
};

export const CookingLeftoverPasta: React.FC = () => {
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
