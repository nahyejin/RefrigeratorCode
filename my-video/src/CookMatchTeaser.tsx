import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import {
  FONT_FAMILY,
  INK,
  INK_SOFT,
  INK_FAINT,
  LINE,
  YELLOW,
  WHITE,
  BGM_FILE,
  useCustomFont,
  RevealText,
  CtaOutro,
  AppIcon,
  Wordmark,
} from "./shared";

const TOTAL_RECIPES = 44610; // 지어낸 숫자 아님 — 쿡매치 AD_BRIEF.md 실측치

// 나레이션 없이 음악만 쓰는 컷이라 다른 소리와 경쟁할 일이 없음 — 잘 들리게 크게
const BGM_VOLUME = 0.55;

export const CookMatchTeaser: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Audio
        src={staticFile(BGM_FILE)}
        volume={(f) =>
          interpolate(f, [0, 20, 250, 270], [0, BGM_VOLUME, BGM_VOLUME, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Sequence from={0} durationInFrames={75} name="Hook">
        <SceneHook />
      </Sequence>
      <Sequence from={75} durationInFrames={120} name="Match">
        <SceneMatch />
      </Sequence>
      <Sequence from={195} durationInFrames={75} name="CTA">
        <CtaOutro
          payoffLine={
            <>
              버리는 식재료 0원 도전
              <br />
              <span style={{ color: "#D99A00" }}>쿡매치</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- Scene 1 (0.0s-2.5s): Hooking ----------
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconP = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 24, mass: 0.9 } }),
    [0, 1],
    [0.9, 1]
  );
  const iconOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <RevealText top={210} delay={4} size={62}>
        오늘 저녁 뭐 먹지?
      </RevealText>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: iconOpacity, transform: `scale(${iconP})` }}>
          <AppIcon size={300} />
        </div>
        <div style={{ marginTop: 34, opacity: wordmarkOpacity }}>
          <Wordmark size={66} />
        </div>
      </AbsoluteFill>

      <RevealText top={1530} delay={34} size={32} color={INK_SOFT} weight={500}>
        퇴근하고 냉장고 앞에서
        <br />
        5분째 멍때리고 있다면?
      </RevealText>
    </AbsoluteFill>
  );
};

// ---------- Scene 2 (2.5s-6.5s): Core Value ----------
const SceneMatch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const countProgress = interpolate(frame, [0, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const count = Math.round(countProgress * TOTAL_RECIPES);
  const countOpacity = interpolate(frame, [0, 10, 60, 75], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cardOpacity = interpolate(frame, [65, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [65, 90], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const badgeP = interpolate(
    spring({ frame: frame - 80, fps, config: { damping: 18, mass: 0.8 } }),
    [0, 1],
    [0.85, 1]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <RevealText top={150} delay={2} size={46}>
        냉장고 재료로 만들 수 있는
        <br />
        요리 매칭중...
      </RevealText>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: countOpacity }}>
        <div style={{ fontSize: 36, fontWeight: 500, color: INK_SOFT, marginBottom: 10 }}>누적 레시피 수</div>
        <div style={{ fontSize: 138, fontWeight: 700, color: INK, letterSpacing: -1 }}>
          {count.toLocaleString("ko-KR")}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
        }}
      >
        <RecipeCard badgeScale={badgeP} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BowlIcon: React.FC = () => (
  <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
    <path
      d="M18 40h52a1 1 0 0 1 1 1c0 14-12.3 25-27 25S17 55 17 41a1 1 0 0 1 1-1Z"
      stroke={INK_SOFT}
      strokeWidth="3"
    />
    <path d="M30 40c0-8 6-14 14-14s14 6 14 14" stroke={INK_SOFT} strokeWidth="3" strokeLinecap="round" />
    <path d="M34 68h20" stroke={INK_SOFT} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const RecipeCard: React.FC<{ badgeScale: number }> = ({ badgeScale }) => {
  const chips: { label: string; have: boolean }[] = [
    { label: "양파", have: true },
    { label: "대파", have: true },
    { label: "간장", have: true },
    { label: "새우", have: false },
  ];
  return (
    <div
      style={{
        width: 760,
        borderRadius: 28,
        backgroundColor: WHITE,
        border: `1px solid ${LINE}`,
        boxShadow: "0 10px 28px rgba(26,26,30,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 300,
          backgroundColor: "#FAF8F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BowlIcon />
      </div>
      <div style={{ padding: "26px 34px 34px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: INK }}>애호박 새우볶음</div>
          <div
            style={{
              backgroundColor: YELLOW,
              color: INK,
              borderRadius: 999,
              padding: "6px 18px",
              fontSize: 30,
              fontWeight: 700,
              transform: `scale(${badgeScale})`,
              flexShrink: 0,
              marginLeft: 16,
            }}
          >
            92%
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <div
              key={c.label}
              style={{
                padding: "9px 20px",
                borderRadius: 999,
                fontSize: 26,
                fontWeight: 500,
                backgroundColor: c.have ? INK_FAINT : "transparent",
                color: c.have ? INK : INK_SOFT,
                border: c.have ? "none" : `1.5px dashed ${INK_SOFT}`,
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
