import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, INK, WHITE, YELLOW, CtaOutro, useCustomFont } from "./shared";
import { TAIL_SCENES, TAIL_CTA_LEN, TAIL_TOTAL_FRAMES, sceneLen, type TailScene } from "./featureTailSpec";

// 기능영상 v2 「꼬리」 — 쿠키 릴스·후킹 릴스 뒤에 바로 이어 붙이는 기능 소개 한 덩어리(2026-11-12).
// 스토어 v3 8장의 순서·헤드라인·노랑/검정 번갈아 배경을 그대로 따른다:
//   매칭률순 → AI 개요(쿡 픽·식단 짜기) → 쿡 코치 → 사진 등록 → 소비기한 자동 → 요약·듣기 → 가족 → 끝 화면(새 로고).
// 화면은 안드로이드 에뮬레이터 새 UI 녹화(scripts/rec_feature_v2.py; AI 화면은 가짜 응답이라 크레딧 0)이고,
// 가족 장면만 로그인·식구 데이터가 필요해 스토어용 실제 캡처(store/sources/family_v3.png)를 천천히 다가가며 보여 준다.
// 나레이션: Gemini TTS(scripts/gen_tts_v2.py) — 장면 시작 0.3초 뒤. BGM 은 렌더 뒤 add_bgm.py 로 따로 깐다(렌더 자체는 나레이션만).

const PHONE_W = 860;
const PHONE_TOP = 470;
const PHONE_LEFT = (1080 - PHONE_W) / 2;
const FPS = 30;

const AiPill: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 26px",
      borderRadius: 999,
      backgroundColor: dark ? YELLOW : INK,
      color: dark ? INK : YELLOW,
      fontSize: 40,
      fontWeight: 800,
      letterSpacing: 1,
    }}
  >
    <span style={{ fontSize: 40 }}>✦</span> AI
  </div>
);

const SceneView: React.FC<{ s: TailScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dark = s.bg === "black";
  const bg = dark ? "#18181B" : YELLOW;
  const fg = dark ? WHITE : INK;
  const pop = spring({ frame, fps, config: { damping: 18, mass: 0.8 }, durationInFrames: 22 });
  const phoneY = interpolate(pop, [0, 1], [90, 0]);
  const headReveal = interpolate(spring({ frame: frame - 3, fps, config: { damping: 26, mass: 0.9 }, durationInFrames: 22 }), [0, 1], [0, 100]);

  // 세그먼트 → 프레임 구간
  let acc = 0;
  const parts = s.segs.map((g) => {
    const len = Math.round(((g.to - g.from) / (g.rate ?? 1)) * FPS);
    const start = acc;
    acc += len;
    return { g, len, start };
  });
  const phoneH = Math.round((PHONE_W * 1920) / 940);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: FONT_FAMILY }}>
      <div style={{ position: "absolute", left: 70, top: 96, right: 70 }}>
        <div style={{ height: 64, marginBottom: 18 }}>{s.ai && <AiPill dark={dark} />}</div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.16,
            letterSpacing: -2,
            color: fg,
            whiteSpace: "pre-line",
            wordBreak: "keep-all",
            clipPath: `inset(0 ${100 - headReveal}% 0 0)`,
          }}
        >
          {s.headline}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: PHONE_LEFT,
          top: PHONE_TOP + phoneY,
          width: PHONE_W,
          height: phoneH,
          borderRadius: "64px 64px 0 0",
          overflow: "hidden",
          backgroundColor: WHITE,
          boxShadow: dark ? "0 0 0 8px #3A3A42" : "0 0 0 8px #18181B, 0 30px 60px rgba(0,0,0,0.25)",
        }}
      >
        {parts.map(({ g, len, start }, i) => (
          <Sequence key={i} from={start} durationInFrames={len}>
            <Seg g={g} len={len} still={s.still} />
          </Sequence>
        ))}
      </div>

      {s.narr && (
        <Sequence from={s.narrAt ?? 9}>
          <Audio src={staticFile(`feature_v2/narr_${s.narr}.mp3`)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

const Seg: React.FC<{ g: TailScene["segs"][number]; len: number; still?: string }> = ({ g, len, still }) => {
  const frame = useCurrentFrame();
  const z0 = g.zoom ?? 1;
  const z1 = g.zoomTo ?? z0;
  const zoom = interpolate(frame, [0, Math.max(1, len - 1)], [z0, z1], { extrapolateRight: "clamp" });
  const common = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: g.origin ?? "50% 40%",
  };
  if (still) {
    // 정지 화면(가족): 위쪽 헤더를 잘라 낸 채 천천히 다가간다
    return <Img src={staticFile(still)} style={{ ...common, objectPosition: "50% 0%" }} />;
  }
  return (
    <OffthreadVideo
      src={staticFile(g.src!)}
      trimBefore={Math.round(g.from * FPS)}
      trimAfter={Math.round(g.to * FPS)}
      playbackRate={g.rate ?? 1}
      muted
      style={common}
    />
  );
};

export const FeatureTail: React.FC = () => {
  useCustomFont();
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      {TAIL_SCENES.map((s) => {
        const from = cursor;
        const len = sceneLen(s);
        cursor += len;
        return (
          <Sequence key={s.key} from={from} durationInFrames={len} name={s.key}>
            <SceneView s={s} />
          </Sequence>
        );
      })}
      <Sequence from={cursor} durationInFrames={TAIL_CTA_LEN} name="cta">
        <CtaOutro
          payoffLine={
            <>
              냉장고에 있는 걸로,
              <br />
              <span style={{ color: "#D99A00" }}>오늘 저녁 해결</span>
            </>
          }
        />
        <Sequence from={6}>
          <Audio src={staticFile("feature_v2/narr_cta.mp3")} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

// 개별 데모 = 장면 하나 + 끝 화면(새 로고). 후킹 편 뒤에 옛 Reel1~8 데모·엔딩 대신 이 한 덩어리를 붙인다.
export const demoOneLen = (s: TailScene) => sceneLen(s) + TAIL_CTA_LEN;
export const FeatureDemoOne: React.FC<{ k: string }> = ({ k }) => {
  useCustomFont();
  const s = TAIL_SCENES.find((x) => x.key === k)!;
  const len = sceneLen(s);
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={len} name={s.key}>
        <SceneView s={s} />
      </Sequence>
      <Sequence from={len} durationInFrames={TAIL_CTA_LEN} name="cta">
        <CtaOutro
          payoffLine={
            <>
              냉장고에 있는 걸로,
              <br />
              <span style={{ color: "#D99A00" }}>오늘 저녁 해결</span>
            </>
          }
        />
        <Sequence from={6}>
          <Audio src={staticFile("feature_v2/narr_cta.mp3")} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export { TAIL_TOTAL_FRAMES };
