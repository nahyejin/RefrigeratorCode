import React from "react";
import "./index.css";
import { Composition } from "remotion";
import { CookMatchTeaser } from "./CookMatchTeaser";
import { Reel1Receipt, REEL1_TOTAL_FRAMES } from "./Reel1Receipt";
import { Reel2Match, REEL2_TOTAL_FRAMES } from "./Reel2Match";
import { Reel3CookMode, REEL3_TOTAL_FRAMES } from "./Reel3CookMode";
import { Reel4AiDiet, REEL4_TOTAL_FRAMES } from "./Reel4AiDiet";
import { Reel5ExpiryAlert, REEL5_TOTAL_FRAMES } from "./Reel5ExpiryAlert";
import { Reel6ChatbotDemo, REEL6_TOTAL_FRAMES } from "./Reel6ChatbotDemo";
import { Reel7RealRecipe, REEL7_TOTAL_FRAMES } from "./Reel7RealRecipe";
import { Reel8FamilySavings, REEL8_TOTAL_FRAMES } from "./Reel8FamilySavings";
import { ReelOverview, REEL_OVERVIEW_TOTAL_FRAMES } from "./ReelOverview";
import { CookingSausage, COOKING_SAUSAGE_TOTAL } from "./CookingSausage";
import { CookingMiyeok, COOKING_MIYEOK_TOTAL } from "./CookingMiyeok";
import { CookingCampPasta, COOKING_CAMP_PASTA_TOTAL } from "./CookingCampPasta";
import { CookingCookie, COOKING_COOKIE_TOTAL } from "./CookingCookie";
import { CookieHookFix, COOKIE_HOOK_FIX_LEN } from "./CookieHookFix";
import { ReelOverviewV2, REEL_OVERVIEW_V2_LEN } from "./ReelOverviewV2";
import { FeatureTailV2, FEATURE_TAIL_V2_LEN, FeatureOneV2, SEGS_V2, segLenV2 } from "./FeatureDemosV2";
import { CookieTailV2, COOKIE_TAIL_V2_LEN } from "./CookieTailV2";
import { CookingMilkCookie, COOKING_MILK_COOKIE_TOTAL } from "./CookingMilkCookie";
import { REELS_HOOK_V2 } from "./ReelHooksV2";
import { REELS_HOOK_V4 } from "./ReelHooksV4";
import { REELS_HOOK_V3 } from "./ReelHooksV3";
import { REELS_HOOK_V6 } from "./ReelHooksV6";
import { REELS_TALK, SearchBanner } from "./TalkReels";
import { AbsoluteFill } from "remotion";
import { useCustomFont } from "./shared";

// 이미 완성된 옛 영상에 하단 검색 안내만 얹을 때 쓰는 투명 PNG(후킹 릴스 데모와 같은 위치·모양) — 2026-11-01 옛 훅 8편에 적용.
// npx remotion still SearchBannerOverlay out.png --image-format=png → ffmpeg overlay(enable=데모 구간)
const SearchBannerOverlay: React.FC = () => {
  useCustomFont();
  return <AbsoluteFill><SearchBanner bottom={120} scale={0.82} panel /></AbsoluteFill>;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CookMatchTeaser"
        component={CookMatchTeaser}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel1Receipt"
        component={Reel1Receipt}
        durationInFrames={REEL1_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel2Match"
        component={Reel2Match}
        durationInFrames={REEL2_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel3CookMode"
        component={Reel3CookMode}
        durationInFrames={REEL3_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel4AiDiet"
        component={Reel4AiDiet}
        durationInFrames={REEL4_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel5ExpiryAlert"
        component={Reel5ExpiryAlert}
        durationInFrames={REEL5_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel6ChatbotDemo"
        component={Reel6ChatbotDemo}
        durationInFrames={REEL6_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel7RealRecipe"
        component={Reel7RealRecipe}
        durationInFrames={REEL7_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel8FamilySavings"
        component={Reel8FamilySavings}
        durationInFrames={REEL8_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ReelOverview"
        component={ReelOverview}
        durationInFrames={REEL_OVERVIEW_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition id="SearchBannerOverlay" component={SearchBannerOverlay} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="CookingCampPasta" component={CookingCampPasta} durationInFrames={COOKING_CAMP_PASTA_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="CookingCookie" component={CookingCookie} durationInFrames={COOKING_COOKIE_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="CookieHookFix" component={CookieHookFix} durationInFrames={COOKIE_HOOK_FIX_LEN} fps={30} width={1080} height={1920} />
      {/* 기능영상 v2(2026-11-08): 새 로고·새 이름·새 UI. 요리·후킹 릴스 뒤에 붙이는 묶음 + 기능 하나씩 */}
      <Composition id="ReelOverviewV2" component={ReelOverviewV2} durationInFrames={REEL_OVERVIEW_V2_LEN} fps={30} width={1080} height={1920} />
      <Composition id="FeatureTailV2" component={FeatureTailV2} durationInFrames={FEATURE_TAIL_V2_LEN} fps={30} width={1080} height={1920} />
      {SEGS_V2.map((s, i) => (
        <Composition key={`fv2-${i}`} id={`FeatureV2-${i + 1}`} component={FeatureOneV2} defaultProps={{ index: i }} durationInFrames={segLenV2(s)} fps={30} width={1080} height={1920} />
      ))}
      <Composition id="CookingMilkCookie" component={CookingMilkCookie} durationInFrames={COOKING_MILK_COOKIE_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="CookieTailV2" component={CookieTailV2} durationInFrames={COOKIE_TAIL_V2_LEN} fps={30} width={1080} height={1920} />
      <Composition id="CookingMiyeok" component={CookingMiyeok} durationInFrames={COOKING_MIYEOK_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="CookingSausage" component={CookingSausage} durationInFrames={COOKING_SAUSAGE_TOTAL} fps={30} width={1080} height={1920} />
      {REELS_HOOK_V3.map((r) => (
        <Composition key={r.id} id={r.id} component={r.Comp} durationInFrames={r.total} fps={30} width={1080} height={1920} />
      ))}
      {REELS_TALK.map((r) => (
        <Composition key={r.id} id={r.id} component={r.Comp} durationInFrames={r.total} fps={30} width={1080} height={1920} />
      ))}
      {REELS_HOOK_V6.map((r) => (
        <Composition key={r.id} id={r.id} component={r.Comp} durationInFrames={r.total} fps={30} width={1080} height={1920} />
      ))}
      {REELS_HOOK_V4.map((r) => (
        <Composition key={r.id} id={r.id} component={r.Comp} durationInFrames={r.total} fps={30} width={1080} height={1920} />
      ))}
      {REELS_HOOK_V2.map((r) => (
        <Composition key={r.id} id={r.id} component={r.Comp} durationInFrames={r.total} fps={30} width={1080} height={1920} />
      ))}
    </>
  );
};
