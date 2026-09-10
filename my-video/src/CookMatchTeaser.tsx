import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  delayRender,
  continueRender,
} from "remotion";

const FONT_FAMILY = "'KyoboHandwriting2025', 'Noto Sans KR', sans-serif";

// 브랜드 컬러(AD_BRIEF 기준). 노란색은 매칭률·CTA 등 단 하나의 포인트로만 쓰고
// 배경 전체에 그라디언트로 깔지 않는다 — "너무 촌스럽다" 피드백 반영.
const INK = "#1A1A1E";
const INK_SOFT = "rgba(26,26,30,0.5)";
const INK_FAINT = "rgba(26,26,30,0.06)";
const LINE = "rgba(26,26,30,0.1)";
const YELLOW = "#FFD600";
const YELLOW_TEXT = "#6B5200";
const WHITE = "#FFFFFF";

const TOTAL_RECIPES = 44610; // 지어낸 숫자 아님 — 쿡매치 AD_BRIEF.md 실측치

// BGM: "Positive Acoustic Guitar with Soft Beat" by JorisVermeer (Pixabay, 무료 라이선스, 출처 표시 불필요)
// https://pixabay.com/music/beats-positive-acoustic-guitar-with-soft-beat-526509/
// 나레이션 없이 음악만 쓰는 컷이라 다른 소리와 경쟁할 일이 없음 — 잘 들리게 크게
const BGM_VOLUME = 0.55;

const useCustomFont = () => {
  const [handle] = useState(() => delayRender("커스텀 폰트 로드"));
  useEffect(() => {
    const font = new FontFace("KyoboHandwriting2025", `url(${staticFile("KyoboHandwriting2025lyb.otf")})`);
    font
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
};

export const CookMatchTeaser: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Audio
        src={staticFile("bgm_positive_acoustic_guitar.mp3")}
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
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};

// 클립패스로 왼쪽에서 열리며 드러나는 헤드라인 — 흔한 fade+slide 대신 쓰는 시그니처 모션
const RevealText: React.FC<{
  children: React.ReactNode;
  top: number;
  delay?: number;
  size?: number;
  color?: string;
  weight?: number;
}> = ({ children, top, delay = 0, size = 58, color = INK, weight = 700 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 26, mass: 0.9 }, durationInFrames: 20 });
  const reveal = interpolate(p, [0, 1], [0, 100], { extrapolateRight: "clamp" });
  const y = interpolate(p, [0, 1], [10, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 64,
        right: 64,
        textAlign: "center",
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.34,
        letterSpacing: -0.5,
        transform: `translateY(${y}px)`,
        clipPath: `inset(0 ${100 - reveal}% 0 0)`,
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

const Wordmark: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <div style={{ fontSize: size, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
    Cook<span style={{ color: "#D99A00" }}>Match</span>
  </div>
);

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

// ---------- Scene 3 (6.5s-9.0s): Call To Action ----------
const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoP = interpolate(
    spring({ frame, fps, config: { damping: 24, mass: 0.9 } }),
    [0, 1],
    [0.92, 1]
  );
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineOpacity = interpolate(frame, [16, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(frame, [30, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoP})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
          }}
        >
          <AppIcon size={200} />
          <Wordmark size={62} />
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            fontWeight: 500,
            color: YELLOW_TEXT,
            opacity: taglineOpacity,
            borderBottom: `2px solid ${YELLOW}`,
            paddingBottom: 4,
          }}
        >
          설치 없이 웹에서 바로 시작
        </div>
      </AbsoluteFill>

      <RevealText top={1330} delay={30} size={50}>
        버리는 식재료 0원 도전
        <br />
        <span style={{ color: "#D99A00" }}>쿡매치</span>
      </RevealText>

      <div
        style={{
          position: "absolute",
          bottom: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 32,
          fontWeight: 500,
          color: INK_SOFT,
          opacity: ctaOpacity,
        }}
      >
        프로필 링크에서 시작하기
      </div>
    </AbsoluteFill>
  );
};
