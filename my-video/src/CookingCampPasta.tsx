import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark, OverviewSegments, OverviewCta, SEGS_LEN } from "./ReelOverview";

// 요리 릴스 3편 — 캠핑 새우 알리오올리오(2026-10-31, 캠핑장 버너 하나로).
// ① 완성 사진 + 후킹 → ② 쿡매치에서 「알리오올리오」 검색 · 재료매칭순 · 대체 재료 → 「원팬 파스타」 레시피 → 캘린더 · 장 봐야 할 재료
// → ③ 집에서 양념·재료 소분 → ④ 캠핑장 도착, 도아랑 텐트 → ⑤ 버너 하나로 요리(단계 자막) → ⑥ 완성
// → ⑦ 이 편 슬로건(4편 장보기) → ⑧ 그 밖에도 → ⑨ 8개 기능 → ⑩ 대표 슬로건. 먹는 영상은 없다.
// 원본은 public/cooking/새우알리오올리오_20261031/ (git 제외). 가이드 my-video/COOKING_REEL_GUIDE.md.

const DIR = "cooking/새우알리오올리오_20261031/work/";
const f = (s: number) => Math.round(s * 30);

type Shot =
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean }
  | { kind: "photo"; src: string; len: number; caption?: string; origin?: string }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number }
  | { kind: "features"; len: number }
  | { kind: "finalCta"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" ? Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1)) : s.len);

// 첫 장면 = 완성 사진 + 큰 노란 후킹(썸네일 겸용)
const HOOK = { at: 0, len: 2.8, text: "캠핑 요리는\n집에서 끝내요" };
const OPEN: Shot[] = [{ kind: "photo", src: "hook.jpg", len: f(2.8), origin: "50% 55%" }];

// 쿡매치에서 찾기 — 앱 작업본(880x1784, 상태바 잘라 냄, 17.3~24.7s 알림 흐림) 시각
const APP: Shot[] = [
  { kind: "video", src: "app_raw.mp4", from: 2.0, to: 7.6, rate: 1.6, app: true, step: "캠핑 메뉴는 쿡매치에서\n「알리오올리오」 검색" },
  { kind: "video", src: "app_raw.mp4", from: 8.0, to: 11.6, rate: 1.2, app: true, step: "내 재료와 잘 맞는 순서로" },
  { kind: "video", src: "app_raw.mp4", from: 24.8, to: 35.0, rate: 2, app: true, step: "없는 재료는 있는 걸로\n새우 → 새우살 · 치킨스톡 → 코인육수" },
  { kind: "video", src: "app_raw.mp4", from: 36.0, to: 40.0, rate: 1.2, app: true, step: "버너 하나로 되는\n「원팬 파스타」" },
  { kind: "video", src: "app_raw.mp4", from: 40.5, to: 48.0, rate: 2.5, app: true, step: "재료·조리 순서 그대로\n따라 하면 돼요" },
  { kind: "video", src: "app_raw.mp4", from: 49.0, to: 53.0, rate: 1.2, app: true, step: "먹을 날을 골라\n캘린더에 담고" },
  { kind: "video", src: "app_raw.mp4", from: 89.5, to: 94.0, rate: 1.4, app: true, step: "장 봐야 할 재료만 챙겨요" },
];

// 집에서 소분 → 캠핑장 도착(텐트 영상은 가로 → 흐린 배경 위 가운데로 미리 합성)
const PREP: Shot[] = [
  { kind: "photo", src: "prep_sauce.jpg", len: f(2.6), caption: "양념은 작은 통에 덜고", origin: "40% 75%" },
  { kind: "photo", src: "prep_bags.jpg", len: f(2.8), caption: "새우살·마늘·면·채소는\n지퍼백에 소분", origin: "55% 45%" },
  { kind: "video", src: "t_072234.mp4", from: 0, to: 7.5, rate: 1.5, step: "캠핑장 도착!\n도아랑 텐트부터 쳐요" },
  { kind: "video", src: "t_074745.mp4", from: 2, to: 10, rate: 1.6, step: "도아는 텐트 안이 신기해요" },
];

// 버너 하나로 요리 — 분량은 쿡매치 레시피 카드 그대로, 순서는 실제로 한 순서
const COOK: Shot[] = [
  { kind: "video", src: "c_095555.mp4", from: 0, to: 7.0, rate: 2, step: "물 500ml 끓이고" },
  { kind: "video", src: "c_095638.mp4", from: 0, to: 9.4, rate: 2, step: "파스타면 90g · 참치액 1T" },
  { kind: "video", src: "c_100012.mp4", from: 2, to: 30, rate: 4, step: "면이 엉겨 붙지 않게\n저어 가며 10~12분" },
  { kind: "video", src: "c_100443.mp4", from: 30, to: 70, rate: 4, step: "새우살은 따로 익혀 두고" },
  { kind: "video", src: "c_101422.mp4", from: 48, to: 123, rate: 5, step: "올리브오일 3T에 마늘 슬라이스\n노릇노릇 고소하게" },
  { kind: "video", src: "c_101422.mp4", from: 124, to: 142, rate: 3, step: "재료를 넣고 함께 볶아요" },
];
const PLATE: Shot[] = [{ kind: "photo", src: "plate.jpg", len: f(3.6), caption: "잎채소·토마토 올려 완성!\n버너 하나로 캠핑 파스타", origin: "50% 55%" }];
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: INTRO },
  { kind: "features", len: SEGS_LEN },
  { kind: "finalCta", len: CTA_LEN },
];
const SHOTS: Shot[] = [...OPEN, ...APP, ...PREP, ...COOK, ...PLATE, ...TAIL];
export const COOKING_CAMP_PASTA_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(3.4);
const COOK_START = [...OPEN, ...APP, ...PREP].reduce((a, s) => a + shotLen(s), 0);

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
        // 앱 녹화 — 높이에 맞춰 가운데, 얇은 테두리
        <div style={{ position: "absolute", top: 0, left: (1080 - 956) / 2, width: 956, height: 1920, border: `1px solid ${LINE}` }}>{video}</div>
      ) : (
        video
      )}
      {s.step && <Caption from={6} len={len - 8} text={s.step} />}
    </AbsoluteFill>
  );
};

// 사진 — 천천히 다가간다. 첫 장면(후킹)은 첫 프레임부터 보이게 페이드 없이 시작
const Photo: React.FC<{ s: Extract<Shot, { kind: "photo" }>; len: number; first: boolean }> = ({ s, len, first }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, len], [1.0, 1.12], { easing: Easing.inOut(Easing.cubic) });
  const o = first ? interpolate(frame, [len - 4, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : fadeInOut(frame, len, 4);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: o }}>
      <Img src={staticFile(DIR + s.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.origin ?? "50% 50%", transform: `scale(${z})`, transformOrigin: s.origin ?? "50% 50%" }} />
      {s.caption && <Caption from={6} len={len - 8} text={s.caption} />}
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
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>버너 하나로</div>
      <div style={{ color: WHITE, fontSize: 104, fontWeight: 900, lineHeight: 1.15, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        새우 알리오올리오
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
                  이제 장보기도, <span style={{ color: "#D99A00" }}>가장 효율적으로</span>
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
          <Sequence key={i} from={from} durationInFrames={len} name={`${i + 1}-${s.kind}${s.kind === "video" || s.kind === "photo" ? "-" + s.src : ""}`}>
            {body}
          </Sequence>
        );
      })}
    </>
  );
};

// 캠핑 저녁 마림바 BGM(scripts/make_bgm_camp.py) — 원음 대사가 없어서 처음부터 끝까지 깐다
const Bgm: React.FC = () => (
  <Audio
    src={staticFile("bgm_camp_marimba.mp3")}
    volume={(fr) =>
      0.42 *
      Math.min(
        interpolate(fr, [0, 10], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        interpolate(fr, [COOKING_CAMP_PASTA_TOTAL - 45, COOKING_CAMP_PASTA_TOTAL - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      )
    }
  />
);

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const len = f(HOOK.len);
  // 썸네일로 쓰므로 첫 프레임부터 꽉 보이게 — 사라질 때만 페이드(COOKING_REEL_GUIDE 0-1)
  const o = interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 640, left: 40, right: 40, textAlign: "center", opacity: o, fontFamily: FONT_FAMILY }}>
      <span style={{ display: "inline-block", whiteSpace: "pre-line", fontSize: 118, fontWeight: 900, lineHeight: 1.18, color: YELLOW, textShadow: "0 6px 22px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.8)" }}>{HOOK.text}</span>
    </div>
  );
};

export const CookingCampPasta: React.FC = () => {
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
      <Bgm />
    </AbsoluteFill>
  );
};
