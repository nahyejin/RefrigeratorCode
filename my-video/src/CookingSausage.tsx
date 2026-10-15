import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Intro, INTRO, CTA_LEN, Mark, OverviewSegments, OverviewCta, SEGS_LEN } from "./ReelOverview";

// 요리 릴스 1편 — 소세지야채볶음(2026-10-15, 사용자가 직접 요리한 영상).
// ① 요리(레시피를 알려 주듯 단계 자막) → ② 아이 식판·먹는 모습 → ③ 쿡매치로 이 레시피를 찾고 완료한 화면
// (당근이 없어 대체 재료 「양파」로 추천된 것을 강조) → ④ 이 편에 맞는 슬로건(2편 매칭과 같은 「없는 재료 대신…」)+스토어·프로필 링크
// → ⑤ 「그 밖에도 이런 기능이 있어요」 → ⑥ 8개 기능 풀영상 → ⑦ 대표 슬로건 CTA.
// 원본은 public/cooking/소세지볶음_20261015/ (git 제외). work/ 는 1080x1920·30fps 로 바꾼 작업본(앱 녹화는 상태바 잘라 냄, 알림 배너 흐림).

const DIR = "cooking/소세지볶음_20261015/work/";
const f = (s: number) => Math.round(s * 30);

type Shot =
  | { kind: "story"; src: string; from: number; to: number }
  | { kind: "video"; src: string; from: number; to: number; rate?: number; audio?: boolean; step?: string; app?: boolean }
  | { kind: "plate"; len: number; caption: string }
  | { kind: "chip"; len: number }
  | { kind: "cta"; len: number }
  | { kind: "transition"; len: number }
  | { kind: "features"; len: number }
  | { kind: "finalCta"; len: number };

const shotLen = (s: Shot) => (s.kind === "video" || s.kind === "story" ? Math.round((f(s.to) - f(s.from)) / (s.kind === "video" ? s.rate ?? 1 : 1)) : s.len);

// 오늘의 이야기 — 하원길 영상(원래 소리는 다른 대화라 끄고, 자막으로 이야기를 붙인다)
const STORY: Shot[] = [{ kind: "story", src: "pickup.mp4", from: 0, to: 10 }];
const STORY_LINES = [
  { at: 0.3, len: 2.6, text: "하원길에 물어봤어요\n「오늘 저녁 뭐 먹고 싶어?」", big: false },
  { at: 3.1, len: 2.2, text: "「소시지!」", big: true },
  { at: 5.5, len: 4.4, text: "쏘야엔 파프리카·당근도 필요한데\n집에 있는 채소는 양파뿐…", big: false },
];

// 요리 단계(레시피 카드 순서와 같게) — 숫자·분량은 레시피 카드 그대로
const COOK: Shot[] = [
  { kind: "video", src: "c01.mp4", from: 2, to: 10, rate: 2, step: "비엔나소시지는 칼집 내고,\n양파는 큼직하게 썰어요" },
  { kind: "video", src: "c02.mp4", from: 0.5, to: 7.5, rate: 2, step: "식용유 2스푼에\n마늘 먼저 볶아 향을 내요" },
  { kind: "video", src: "c02.mp4", from: 14, to: 20, rate: 2, step: "양파 넣고\n투명해질 때까지 볶아요" },
  { kind: "video", src: "c03.mp4", from: 0, to: 8, rate: 2, step: "소시지 넣고 함께 볶아요" },
  { kind: "video", src: "c03.mp4", from: 132, to: 146, rate: 3.5, step: "케첩 4 · 간장 2\n설탕 2 · 식초 1 스푼" },
  { kind: "video", src: "c03.mp4", from: 189.5, to: 193, step: "후추 톡톡" },
  { kind: "video", src: "c03.mp4", from: 204, to: 212, rate: 2, step: "양념이 고루 배면 완성!" },
];
const KID: Shot[] = [
  { kind: "plate", len: 105, caption: "아이 식판엔 소시지 듬뿍" },
  { kind: "video", src: "kid.mp4", from: 34, to: 37.5 },
  { kind: "video", src: "kid.mp4", from: 4.5, to: 12, audio: true },
];
const APP: Shot[] = [
  { kind: "video", src: "app.mp4", from: 9.0, to: 10.6, app: true, step: "쿡매치 레시피는 유튜브·네이버\n상위 채널에서 검증된 것들" },
  { kind: "video", src: "app.mp4", from: 10.6, to: 11.9, rate: 0.6, app: true, step: "그중에서도 「인기순」으로 정렬" },
  { kind: "video", src: "app.mp4", from: 11.9, to: 14, rate: 2, app: true },
  { kind: "video", src: "app.mp4", from: 14, to: 20, rate: 2, app: true, step: "꼭 넣을 재료에 「소시지」" },
  { kind: "video", src: "app.mp4", from: 24, to: 39.3, rate: 3, app: true, step: "인기 많고, 내 냉장고 재료와\n많이 맞는 소시지 요리" },
  { kind: "chip", len: 210 },
  { kind: "video", src: "app.mp4", from: 41, to: 47, rate: 1.5, app: true, step: "당근은 빼고, 있는 양파로" },
  { kind: "video", src: "app.mp4", from: 69.3, to: 73.3, app: true, step: "다 만들면 완료 — 기록까지 끝" },
];
const TAIL: Shot[] = [
  { kind: "cta", len: CTA_LEN },
  { kind: "transition", len: INTRO },
  { kind: "features", len: SEGS_LEN },
  { kind: "finalCta", len: CTA_LEN },
];
const SHOTS: Shot[] = [...STORY, ...COOK, ...KID, ...APP, ...TAIL];
export const COOKING_SAUSAGE_TOTAL = SHOTS.reduce((a, s) => a + shotLen(s), 0);
const TITLE_LEN = f(3.6);
const STORY_LEN = STORY.reduce((a, s) => a + shotLen(s), 0);

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

// 오늘의 레시피 제목 — 첫 장면 위쪽
const RecipeTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 2, fps, config: { damping: 15, mass: 0.7 } });
  const out = interpolate(frame, [TITLE_LEN - 8, TITLE_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 210, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * -24}px)`, fontFamily: FONT_FAMILY }}>
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 52, fontWeight: 800, padding: "10px 34px", borderRadius: 999, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>5분 완성</div>
      <div style={{ color: WHITE, fontSize: 104, fontWeight: 900, lineHeight: 1.15, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.6)" }}>
        소세지야채볶음
      </div>
    </div>
  );
};

// 아이 식판 사진 — 천천히 다가간다
const Plate: React.FC<{ len: number; caption: string }> = ({ len, caption }) => {
  const frame = useCurrentFrame();
  // 소시지 칸(사진 왼쪽 가운데)을 화면 가운데로 두고 천천히 다가간다
  const z = interpolate(frame, [0, len], [1.0, 1.28], { easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeInOut(frame, len, 4) }}>
      <Img src={staticFile(DIR + "plate.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "0% 50%", transform: `scale(${z})`, transformOrigin: "30% 52%" }} />
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
      <span style={{ display: "inline-block", fontSize: who === "kid" ? 96 : 64, fontWeight: 900, color: who === "kid" ? YELLOW : WHITE, textShadow: "0 4px 16px rgba(0,0,0,0.75), 0 0 4px rgba(0,0,0,0.7)" }}>{text}</span>
    </div>
  );
};

// 레시피 카드 하단으로 줌인 — ① 「내 재료 11/11 (87%)」 매칭률 ② 「당근 → 양파」 대체 재료(당근이 없어서 양파로 추천)
// 좌표는 앱 작업본(1206x2422) 기준
const HL = [
  { x: 14, y: 1838, w: 500, h: 52, round: 14, from: 34, to: 112, caption: "내 냉장고 재료와\n87% 매칭되는 레시피" },
  { x: 45, y: 1925, w: 258, h: 74, round: 999, from: 112, to: 9999, caption: "당근이 없으면?\n있는 「양파」로 대체 추천" },
];
const ChipZoom: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = interpolate(frame, [6, 34], [1, 1.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const s = 956 / 1206; // 앱 화면 배율
  // 두 줄 사이를 화면 가운데 위(자막 위)로 끌어오며 확대: 화면 좌표 = T + z·p
  const t = interpolate(frame, [6, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const px = 270 * s, py = 1915 * s;
  const tx = t * (478 - z * px), ty = t * (820 - z * py);
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <div style={{ position: "absolute", top: 0, left: (1080 - 956) / 2, width: 956, height: 1920, overflow: "hidden", border: `1px solid ${LINE}` }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
          <Img src={staticFile(DIR + "chip_frame.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          {HL.map((h, i) => {
            const ring = spring({ frame: frame - h.from, fps, config: { damping: 11, mass: 0.6 } });
            const off = interpolate(frame, [h.to - 4, h.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const pulse = frame > h.from + 16 ? 1 + Math.sin(((frame - h.from - 16) / fps) * Math.PI * 2) * 0.03 : 1;
            if (frame < h.from) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: (h.x - 8) * s,
                  top: (h.y - 8) * s,
                  width: (h.w + 16) * s,
                  height: (h.h + 16) * s,
                  borderRadius: h.round,
                  border: `${5 / z}px solid ${YELLOW}`,
                  boxShadow: `0 0 ${18 / z}px rgba(255,214,0,0.9)`,
                  opacity: Math.min(ring, off),
                  transform: `scale(${interpolate(ring, [0, 1], [1.3, 1]) * pulse})`,
                }}
              />
            );
          })}
        </div>
      </div>
      {HL.map((h, i) => (
        <Caption key={i} from={h.from + 2} len={Math.min(h.to, len) - h.from - 6} text={h.caption} />
      ))}
    </AbsoluteFill>
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
        if (s.kind === "story") body = <Video s={{ kind: "video", src: s.src, from: s.from, to: s.to }} len={len} />;
        else if (s.kind === "video") body = <Video s={s} len={len} />;
        else if (s.kind === "plate") body = <Plate len={len} caption={s.caption} />;
        else if (s.kind === "chip") body = <ChipZoom len={len} />;
        else if (s.kind === "cta")
          body = (
            <CtaOutro
              payoffLine={
                <>
                  없는 재료 대신, <span style={{ color: "#D99A00" }}>있는 걸로 바꿔드려요</span>
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

// 아이 장면에서 엄마·아이 말 자막 — kid.mp4 4.5s~ 구간 기준(원본 5.06s 「맛있어?」, 6.92s 「맛있다!」)
const kidStart = SHOTS.slice(0, STORY.length + COOK.length + 2).reduce((a, s) => a + shotLen(s), 0);

// 잔잔한 브이로그 BGM(scripts/make_vlog_bgm.py 로 직접 합성) — 아이 대사 장면에서는 음악을 내리고 대사만
const KID_TALK_LEN = f(12 - 4.5);
const Bgm: React.FC = () => {
  const talkFrom = kidStart, talkTo = kidStart + KID_TALK_LEN;
  return (
    <Audio
      src={staticFile("bgm_vlog_bright.mp3")}
      volume={(fr) =>
        0.42 *
        Math.min(
          interpolate(fr, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          interpolate(fr, [COOKING_SAUSAGE_TOTAL - 45, COOKING_SAUSAGE_TOTAL - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          interpolate(fr, [talkFrom - 12, talkFrom, talkTo, talkTo + 15], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        )
      }
    />
  );
};

export const CookingSausage: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily: FONT_FAMILY }}>
      <Shots />
      {STORY_LINES.map((l, i) => (
        <Sequence key={i} from={f(l.at)} durationInFrames={f(l.len)}>
          {l.big ? <Said at={0} len={f(l.len)} text={l.text} who="kid" /> : <Caption from={0} len={f(l.len)} text={l.text} />}
        </Sequence>
      ))}
      <Sequence from={STORY_LEN} durationInFrames={TITLE_LEN}>
        <RecipeTitle />
      </Sequence>
      <Bgm />
      <Said at={kidStart + f(5.06 - 4.5)} len={f(1.3)} text="맛있어?" who="mom" />
      <Said at={kidStart + f(6.92 - 4.5)} len={f(1.9)} text="맛있다!" who="kid" />
    </AbsoluteFill>
  );
};
