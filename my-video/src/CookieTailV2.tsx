import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { Mark, CTA_LEN, fade } from "./ReelOverview";
import { SearchBanner } from "./TalkReels";
import { FeatureTailBody, FEATURE_TAIL_V2_LEN } from "./FeatureDemosV2";

// 요리 릴스 6편(쿠키, 도아랑 같이 만드는 곰돌이·토끼 쿠키) 뒷부분 v2 — 2026-11-08.
// 사용자가 확정한 완성본(쿠키_20261105_v1, 124.8초)의 0~98.33초(이야기)는 그대로 두고, 그 뒤를 이것으로 갈아 끼운다:
//   쿡매치 구간(옛 UI → 새 UI 재녹화, 자막 문구는 완성본과 같음) → 이 편 슬로건 CTA(새 로고) → 「그 밖에도 이런 기능이 있어요」(새 이름) → 새 기능영상 8개.
// 붙이기·음악은 scripts/make_cookie_v2.py (완성본의 쿠키 음악을 이어 붙인다 — 새 곡을 받지 않음).

const f = (s: number) => Math.round(s * 30);

type AppShot = { from: number; to: number; rate?: number; text: string };
const APP: AppShot[] = [
  { from: 4.8, to: 8.0, text: "아이랑 만들 쿠키는\n쿡매치에서 「쿠키」 검색" },
  { from: 12.8, to: 17.0, rate: 1.2, text: "인기 쿠키 레시피가\n한가득" },
  { from: 19.6, to: 23.0, text: "필터에서 「오븐」\n테마 고르면" },
  { from: 26.9, to: 30.4, text: "집에서 구울 수 있는\n오븐 쿠키만 쏙" },
];
const appLen = (s: AppShot) => Math.round((f(s.to) - f(s.from)) / (s.rate ?? 1));
const APP_LEN = APP.reduce((a, s) => a + appLen(s), 0);
export const COOKIE_TAIL_V2_LEN = APP_LEN + CTA_LEN + FEATURE_TAIL_V2_LEN;

const AppClip: React.FC<{ s: AppShot; len: number }> = ({ s, len }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <div style={{ position: "absolute", top: 0, left: (1080 - 940) / 2, width: 940, height: 1920, overflow: "hidden", border: `1px solid ${LINE}`, opacity: fade(frame, len) }}>
        <OffthreadVideo src={staticFile("v2_cookie_app.mp4")} trimBefore={f(s.from)} trimAfter={f(s.to)} playbackRate={s.rate ?? 1} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <Caption from={4} len={len - 6} text={s.text} />
    </AbsoluteFill>
  );
};

export const CookieTailV2: React.FC = () => {
  useCustomFont();
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      {APP.map((s, i) => {
        const from = cursor;
        const len = appLen(s);
        cursor += len;
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`앱-${i + 1}`}>
            <AppClip s={s} len={len} />
          </Sequence>
        );
      })}
      <Sequence from={0} durationInFrames={APP_LEN} name="검색 안내">
        <SearchBanner bottom={120} scale={0.82} panel />
      </Sequence>
      <Sequence from={APP_LEN} durationInFrames={CTA_LEN} name="CTA">
        <CtaOutro
          payoffLine={
            <>
              아이랑 만들 간식도, <Mark>쿡매치에서</Mark>
            </>
          }
        />
      </Sequence>
      <Sequence from={APP_LEN + CTA_LEN} durationInFrames={FEATURE_TAIL_V2_LEN} name="그 밖에도 + 기능 8개">
        <FeatureTailBody />
      </Sequence>
    </AbsoluteFill>
  );
};
