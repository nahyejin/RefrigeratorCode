import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FONT_FAMILY, WHITE, useCustomFont } from "./shared";
import { CTA_LEN, INTRO, Intro, OverviewCta } from "./ReelOverview";
import { FeatureSegmentsV2, LABELS_V2, SEGS_V2_LEN } from "./FeatureDemosV2";
import { SPLASH_LEN, SplashIntro } from "./SplashIntro";

// 「기능 총정리」 릴스 v2 (2026-11-08 사용자) — 처음 쿡매치를 소개할 때 만든 ReelOverview 와 같은 형식으로,
// 훅 없이 기능만: 인트로(「냉장고 앱 쿡매치 하나로」 + 새 이름 칩 8개) → 새 UI 기능 8개(FeatureDemosV2, 스토어 v3 순서) → 대표 슬로건 CTA(새 로고).
// 음성 없음 — 옛 총정리와 같은 무음 마스터(릴스 음원을 얹는 전제).
// 2026-11-08: 맨 앞에 앱 스플래시 인트로(SplashIntro, 3초)를 붙였다.
export const REEL_OVERVIEW_V2_LEN = SPLASH_LEN + INTRO + SEGS_V2_LEN + CTA_LEN;

export const ReelOverviewV2: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Sequence from={0} durationInFrames={SPLASH_LEN} name="Splash">
        <SplashIntro />
      </Sequence>
      <Sequence from={SPLASH_LEN} durationInFrames={INTRO} name="Intro">
        <Intro labels={LABELS_V2} />
      </Sequence>
      <Sequence from={SPLASH_LEN + INTRO} durationInFrames={SEGS_V2_LEN} name="Features">
        <FeatureSegmentsV2 />
      </Sequence>
      <Sequence from={SPLASH_LEN + INTRO + SEGS_V2_LEN} durationInFrames={CTA_LEN} name="CTA">
        <OverviewCta />
      </Sequence>
    </AbsoluteFill>
  );
};
