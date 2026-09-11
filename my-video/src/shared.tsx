import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
} from "remotion";

export const FONT_FAMILY = "'KyoboHandwriting2025', 'Noto Sans KR', sans-serif";

// 브랜드 컬러(AD_BRIEF 기준). 노란색은 매칭률·CTA 등 단 하나의 포인트로만 쓰고
// 배경 전체에 그라디언트로 깔지 않는다 — "너무 촌스럽다" 피드백 반영.
export const INK = "#1A1A1E";
export const INK_SOFT = "rgba(26,26,30,0.5)";
export const INK_FAINT = "rgba(26,26,30,0.06)";
export const LINE = "rgba(26,26,30,0.1)";
export const YELLOW = "#FFD600";
export const YELLOW_TEXT = "#6B5200";
export const WHITE = "#FFFFFF";

// BGM: "Positive Acoustic Guitar with Soft Beat" by JorisVermeer (Pixabay, 무료 라이선스, 출처 표시 불필요)
// https://pixabay.com/music/beats-positive-acoustic-guitar-with-soft-beat-526509/
export const BGM_FILE = "bgm_positive_acoustic_guitar.mp3";

export const useCustomFont = () => {
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

// 클립패스로 왼쪽에서 열리며 드러나는 헤드라인 — 흔한 fade+slide 대신 쓰는 시그니처 모션
export const RevealText: React.FC<{
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

export const AppIcon: React.FC<{ size: number }> = ({ size }) => (
  <Img
    src={staticFile("cookmatch_icon.png")}
    style={{ width: size, height: size, borderRadius: size * 0.22, display: "block" }}
  />
);

export const Wordmark: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <div style={{ fontSize: size, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
    Cook<span style={{ color: "#D99A00" }}>Match</span>
  </div>
);

// 7편 공통 엔딩 — 로고 + 워드마크 + 태그라인 + 편별 페이오프 한 줄 + CTA.
// 60프레임(2s) 길이의 Sequence 안에 넣는 걸 전제로 로컬 프레임 0부터 타이밍을 잡는다.
export const CtaOutro: React.FC<{ payoffLine: React.ReactNode }> = ({ payoffLine }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoP = interpolate(spring({ frame, fps, config: { damping: 24, mass: 0.9 } }), [0, 1], [0.92, 1]);
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [16, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
          <AppIcon size={260} />
          <Wordmark size={80} />
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 38,
            fontWeight: 600,
            color: YELLOW_TEXT,
            opacity: taglineOpacity,
            borderBottom: `3px solid ${YELLOW}`,
            paddingBottom: 6,
          }}
        >
          설치 없이 웹에서 바로 시작
        </div>
      </AbsoluteFill>

      <RevealText top={1290} delay={30} size={64}>
        {payoffLine}
      </RevealText>

      <div
        style={{
          position: "absolute",
          bottom: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 40,
          fontWeight: 600,
          color: INK_SOFT,
          opacity: ctaOpacity,
        }}
      >
        프로필 링크에서 시작하기
      </div>
    </AbsoluteFill>
  );
};
