import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandMark } from "./brand/BrandMark";
import { BRAND_MOTION_CSS } from "./brand/brandMotionCss";

// 영상 맨 앞 스플래시 인트로(2026-11-08 사용자: 「맨 앞에 쿡매치 로고만 중앙에, 스플래시 애니메이션 그대로」).
// 앱 SplashScreen 과 같은 마크(BrandMark ball·onYellow·intro 모션)와 같은 CSS 키프레임을 쓰고,
// 브라우저 CSS 애니메이션을 멈춘(paused) 채 프레임마다 음수 지연(원래 지연 - 현재 시각)을 줘서 그 시각의 모습을 프레임 정확하게 그린다.
// 누적 레시피 수는 빼고 로고(마크 + 워드마크)만 화면 가운데에.
export const SPLASH_LEN = 90; // 3초 — 받침 → 재료 낙하·통통 → 잎 → 워드마크(1.95초) 뒤 한 번 살짝 뜨고 앉음
const FADE = 10;

export const SplashIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const d = (x: number) => `${(x - t).toFixed(4)}s`;
  // 지연값은 앱 index.css 의 intro 모션·SplashScreen 워드마크와 같다
  const seek = `
.splash-seek * { animation-play-state: paused !important; }
.splash-seek .brand-mark--intro .brand-mark__bowl { animation-delay: ${d(0)} !important; }
.splash-seek .brand-mark--intro .brand-mark__ingredient { animation-delay: ${d(0.3)}, ${d(2.1)} !important; }
.splash-seek .brand-mark--intro .brand-mark__leaves { animation-delay: ${d(1.2)}, ${d(2.1)} !important; }
.splash-seek .splash-wordmark { animation-delay: ${d(1.6)} !important; }`;

  const out = interpolate(frame, [SPLASH_LEN - FADE, SPLASH_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      <style>{BRAND_MOTION_CSS + seek}</style>
      <AbsoluteFill style={{ backgroundColor: "#FFD600", opacity: out }}>
        <div
          className="splash-seek"
          style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <BrandMark ingredient="ball" tone="onYellow" size={500} motion="intro" />
          <div className="splash-wordmark" style={{ marginTop: 40, animation: "brand-wordmark-in .35s ease-out 1.6s both" }}>
            <Img src={staticFile("wordmark_on_yellow.png")} style={{ height: 92, width: "auto", display: "block" }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
