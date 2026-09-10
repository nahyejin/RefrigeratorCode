import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansKR";

const { fontFamily } = loadFont();

const YELLOW = "#FFD600";
const YELLOW_PRESSED = "#F2C200";
const YELLOW_BG = "#FFF6C2";
const YELLOW_TEXT = "#6B5200";
const INK = "#1A1A1E";
const GRAY = "#9AA0A6";
const GREEN = "#2FAE60";

// 실측치(쿡매치 AD_BRIEF.md 기준) — 지어낸 숫자 없음
const TOTAL_RECIPES = 44610;

export const CookMatchTeaser: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff", fontFamily }}>
      <Sequence from={0} durationInFrames={75} name="Hook">
        <SceneHook />
      </Sequence>
      <Sequence from={75} durationInFrames={120} name="Match">
        <SceneMatch />
      </Sequence>
      <Sequence from={195} durationInFrames={75} name="CTA">
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{
  children: React.ReactNode;
  top: number;
  delay?: number;
  size?: number;
  color?: string;
}> = ({ children, top, delay = 0, size = 56, color = INK }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const y = interpolate(p, [0, 1], [16, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
        textAlign: "center",
        fontSize: size,
        fontWeight: 800,
        color,
        opacity,
        transform: `translateY(${y}px)`,
        lineHeight: 1.35,
        letterSpacing: -1,
      }}
    >
      {children}
    </div>
  );
};

const AppIcon: React.FC<{ size: number }> = ({ size }) => (
  <Img
    src={staticFile("cookmatch_icon.png")}
    style={{ width: size, height: size, borderRadius: size * 0.22, display: "block" }}
  />
);

const Wordmark: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div style={{ fontSize: size, fontWeight: 800, color: INK, letterSpacing: -1 }}>
    Cook<span style={{ color: "#F2A400" }}>Match</span>
  </div>
);

// ---------- Scene 1 (0.0s-2.5s): Hooking ----------
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconScale = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 120 } });

  const tapStart = 52;
  const tapProgress = interpolate(frame, [tapStart, tapStart + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleScale = interpolate(tapProgress, [0, 1], [0.35, 2.1]);
  const rippleOpacity = interpolate(tapProgress, [0, 1], [0.55, 0]);
  const pressDip = interpolate(frame, [tapStart, tapStart + 6, tapStart + 14], [1, 0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordmarkOpacity = interpolate(frame, [14, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <Caption top={190} delay={4} size={64}>
        오늘 저녁 뭐 먹지?
      </Caption>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", transform: `scale(${iconScale * pressDip})` }}>
          <AppIcon size={340} />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 340,
              height: 340,
              borderRadius: 340 * 0.22,
              border: `6px solid ${YELLOW_PRESSED}`,
              transform: `translate(-50%, -50%) scale(${rippleScale})`,
              opacity: rippleOpacity,
            }}
          />
        </div>
        <div style={{ marginTop: 36, opacity: wordmarkOpacity }}>
          <Wordmark size={72} />
        </div>
      </AbsoluteFill>

      <Caption top={1520} delay={30} size={34} color={GRAY}>
        퇴근하고 냉장고 앞에서
        <br />
        5분째 멍때리고 있다면?
      </Caption>
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

  const cardOpacity = interpolate(frame, [65, 82], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [65, 88], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeScale = spring({ frame: frame - 78, fps, config: { damping: 10, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <Caption top={130} delay={2} size={48}>
        냉장고 재료로 만들 수 있는
        <br />
        요리 매칭중...
      </Caption>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: countOpacity }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: GRAY, marginBottom: 12 }}>누적 레시피 수</div>
        <div style={{ fontSize: 144, fontWeight: 900, color: INK, letterSpacing: -2 }}>
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
        <RecipeCard badgeScale={badgeScale} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

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
        borderRadius: 32,
        backgroundColor: "#fff",
        boxShadow: "0 24px 60px rgba(0,0,0,0.14)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 340,
          background: `linear-gradient(135deg, ${YELLOW} 0%, ${YELLOW_PRESSED} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AppIcon size={120} />
      </div>
      <div style={{ padding: "28px 36px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: INK }}>애호박 새우볶음</div>
          <div
            style={{
              backgroundColor: YELLOW,
              color: INK,
              borderRadius: 999,
              padding: "8px 22px",
              fontSize: 34,
              fontWeight: 900,
              transform: `scale(${badgeScale})`,
            }}
          >
            92%
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <div
              key={c.label}
              style={{
                padding: "10px 24px",
                borderRadius: 999,
                fontSize: 28,
                fontWeight: 700,
                backgroundColor: c.have ? "#E6F6EC" : "#F1F2F3",
                color: c.have ? GREEN : GRAY,
                border: c.have ? "none" : `2px solid ${GRAY}`,
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

// ---------- Scene 3 (6.5s-9.0s): Call To Action ----------
const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const taglineOpacity = interpolate(frame, [14, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionOpacity = interpolate(frame, [24, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const swipeOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bounce = Math.sin((frame / fps) * Math.PI * 2.2) * 14;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #ffffff 0%, ${YELLOW_BG} 100%)` }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <div
          style={{
            transform: `scale(${logoScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <AppIcon size={220} />
          <Wordmark size={68} />
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            fontWeight: 700,
            color: YELLOW_TEXT,
            backgroundColor: YELLOW_BG,
            padding: "10px 28px",
            borderRadius: 999,
            opacity: taglineOpacity,
          }}
        >
          설치 없이 웹에서 바로 시작
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          bottom: 340,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 54,
          fontWeight: 800,
          color: INK,
          opacity: captionOpacity,
          padding: "0 70px",
          lineHeight: 1.35,
        }}
      >
        버리는 식재료 0원 도전 🥑
        <br />
        <span style={{ color: "#F2A400" }}>쿡매치</span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: "50%",
          transform: `translate(-50%, ${bounce}px)`,
          fontSize: 40,
          fontWeight: 700,
          color: YELLOW_TEXT,
          opacity: swipeOpacity,
        }}
      >
        ▲ 위로 스와이프
      </div>
    </AbsoluteFill>
  );
};
