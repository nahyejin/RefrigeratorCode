import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { WHITE, Caption, RevealText } from "./shared";
import { SEGS, partLen, segLen, Clip, PhotoShots, PushScene, SavingsZoom, SpeakerBadge, FeatureTag, Intro, Mark } from "./ReelOverview";

// 「이 밖의 기능」 구간 (2026-10-12 사용자 지시) — 각 릴스는 훅 → 기능 하나를 길게 설명 → 끝 화면(다운로드 안내) 순으로 가고,
// 끝 화면 뒤에 나머지 7가지 기능을 총정리 영상과 같은 순서·같은 구성으로 이어서 보여 준 뒤 끝 화면을 한 번 더(무음) 보여 준다.
// 중간에 이탈할 사람은 첫 끝 화면에서 이미 안내를 봤으니, 뒤에 붙는 7가지는 줄이지 않고 총정리 영상의 구간 그대로 쓴다
// (처음엔 기능당 2초로 줄여 만들었다가 이 이유로 되돌림). 무음(음원은 올릴 때).

// 릴스 번호(1~8) → 그 편이 이미 길게 보여 준 기능의 SEGS 인덱스
// (SEGS 순서: AI 재료인식, 레시피 매칭, AI 식단, 요리 AI, 유통기한 알림, 읽어주기 모드, 검증된 레시피, 가족이 아낀 돈)
export const REST_EXCL = [0, 1, 5, 2, 4, 3, 6, 7];

const INTRO = 45; // 1.5s
// badges: 「이 밖에도」 첫 장면을 로고 + 문구 + 아래 기능 배지(칩) 화면으로(셀카형, 사용자 요청 2026-10-24). 칩이 다 뜨고 읽을 시간까지 3초.
const INTRO_BADGES = 90;
const introLen = (badges?: boolean) => (badges ? INTRO_BADGES : INTRO);
const picked = (excl: number) => SEGS.filter((_, i) => i !== excl);

export const restLen = (excl: number, badges?: boolean) => introLen(badges) + picked(excl).reduce((a, s) => a + segLen(s), 0);

export const RestFeatures: React.FC<{ excl: number; badges?: boolean }> = ({ excl, badges }) => {
  const items = picked(excl);
  const INTRO_LEN = introLen(badges);
  let cursor = INTRO_LEN;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={INTRO_LEN} name="rest-intro">
        {badges ? (
          <Intro line1="이 밖에도 쿡매치는" line2={<>이런 <Mark>기능</Mark>이 있어요</>} labels={items.map((x) => x.label)} />
        ) : (
        <AbsoluteFill style={{ backgroundColor: WHITE }}>
          <RevealText top={800} delay={2} size={78}>
            이 밖에도 쿡매치는
          </RevealText>
          <RevealText top={920} delay={10} size={78}>
            이런 기능이 있어요
          </RevealText>
        </AbsoluteFill>
        )}
      </Sequence>
      {items.map((it, i) => {
        const from = cursor;
        const total = segLen(it);
        cursor += total;
        let acc = 0;
        return (
          <Sequence key={it.label} from={from} durationInFrames={total} name={`rest-${it.label}`}>
            <AbsoluteFill style={{ backgroundColor: WHITE }}>
              {it.parts.map((p, k) => {
                const start = acc;
                const len = partLen(p);
                acc += len;
                return (
                  <Sequence key={k} from={start} durationInFrames={len}>
                    {p.kind === "clip" ? <Clip part={p} len={len} /> : p.kind === "photos" ? <PhotoShots len={len} /> : p.kind === "savings" ? <SavingsZoom len={len} /> : <PushScene len={len} />}
                  </Sequence>
                );
              })}
              <FeatureTag index={i} label={it.label} len={total} count={items.length} />
              {it.speaker && <SpeakerBadge />}
              <Caption from={4} len={total - 6} text={it.caption} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
