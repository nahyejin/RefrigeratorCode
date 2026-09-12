import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps) — 소파에서 레시피 보다 설레었다가 실망하는 여성
const HOOK_VIDEO = "reel2_hook_gemini.mp4";
// 데모: 실제 쿡매치 매칭률 필터 + 대체 재료 추천 화면(20.5s, 940x1920, 30fps)
const DEMO_VIDEO = "reel2_matching_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) — 10s 중 감정 곡선의 세 순간만 발췌 ----
const HOOK_RAW = {
  smile: [0, 39], // 0:00–1.3 설레며 폰 보는 순간
  disappoint: [180, 219], // 0:06–7.3 재료 없는 걸 알아챈 순간
  putDown: [246, 285], // 0:08.2–9.5 폰 내려놓는 순간
};
const HB1 = HOOK_RAW.smile[1] - HOOK_RAW.smile[0]; // 39f
const HB2 = HOOK_RAW.disappoint[1] - HOOK_RAW.disappoint[0]; // 39f
const HB3 = HOOK_RAW.putDown[1] - HOOK_RAW.putDown[0]; // 39f
const HOOK_LEN = HB1 + HB2 + HB3; // 117f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  filter: [60, 180], // 0:02–6.0 매칭률 필터 열고 슬라이더·부족허용 조정
  results: [210, 330], // 0:07–11.0 필터링된 결과 스크롤(매칭도 배지·재료 칩)
  substitute: [489, 528], // 0:16.3–17.6 "당근→양파" 대체 가능 칩 노출(원속도로 또렷하게)
};
const rateFilter = 1.2;
const rateResults = 1.2;

const D1 = Math.round((DEMO_RAW.filter[1] - DEMO_RAW.filter[0]) / rateFilter); // 100f
const D2 = Math.round((DEMO_RAW.results[1] - DEMO_RAW.results[0]) / rateResults); // 100f
const D3 = DEMO_RAW.substitute[1] - DEMO_RAW.substitute[0]; // 39f
const PULSE = 15; // D3의 마지막 0.5s 동안 프리즈 없이 그냥 살짝 확대 펄스만 얹는다(정지 프레임 트릭이 이 소스에서 불안정해서)
const DEMO_LEN = D1 + D2 + D3; // 239f

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL2_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel2Match: React.FC = () => {
  useCustomFont();
  return (
    // 무음 마스터 — 음원은 업로드 시 릴스 자체 기능으로 얹는 걸 전제로 함(01편과 동일 방침)
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Sequence from={HOOK_FROM} durationInFrames={HOOK_LEN} name="Hook">
        <Hook />
      </Sequence>
      <Sequence from={DEMO_FROM} durationInFrames={DEMO_LEN} name="Demo">
        <Demo />
      </Sequence>
      <Sequence from={CTA_FROM} durationInFrames={CTA_LEN} name="CTA">
        <CtaOutro
          payoffLine={
            <>
              없는 재료 대신, <span style={{ color: "#D99A00" }}>있는 걸로 바꿔드려요</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// 서브클립 공용 — 원본 특정 구간을 트리밍해서 보여주고, 시작/끝에 살짝 화이트 디졸브를 준다.
const SubClip: React.FC<{
  src: string;
  rawFrom: number;
  rawTo: number;
  rate: number;
  len: number;
  width: number;
  height: number;
  left: number;
  shiftY?: number; // 화면 속 특정 요소가 자막 자리와 겹칠 때, 그만큼 위로 밀어서 피한다
}> = ({ src, rawFrom, rawTo, rate, len, width, height, left, shiftY = 0 }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [len - 5, len - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left,
        width,
        height,
        overflow: "hidden",
        border: `1px solid ${LINE}`,
        opacity: Math.min(fadeIn, fadeOut),
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={rawFrom}
        trimAfter={rawTo}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: shiftY ? `translateY(${shiftY}px)` : undefined }}
      />
    </div>
  );
};

// ---------- ①② 훅 (제미나이 생성 실사, 720x1280 — 캔버스와 같은 9:16이라 크롭 없이 꽉 참) ----------
const Hook: React.FC = () => {
  const b1From = 0;
  const b2From = b1From + HB1;
  const b3From = b2From + HB2;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={b1From} durationInFrames={HB1} name="smile">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.smile[0]} rawTo={HOOK_RAW.smile[1]} rate={1} len={HB1} width={1080} height={1920} left={0} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="disappoint">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.disappoint[0]} rawTo={HOOK_RAW.disappoint[1]} rate={1} len={HB2} width={1080} height={1920} left={0} />
      </Sequence>
      <Sequence from={b3From} durationInFrames={HB3} name="putDown">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.putDown[0]} rawTo={HOOK_RAW.putDown[1]} rate={1} len={HB3} width={1080} height={1920} left={0} />
      </Sequence>

      <Caption from={b1From} len={HB1} text="재료 3개 없어서, 레시피 포기한 적 있죠?" />
      <Caption from={b2From} len={HB2 + HB3} text={"레시피는 맛있어 보이는데\n재료가 없어서 못 만든 적 많죠"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 940x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 940;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 70

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const d1From = 0;
  const d2From = d1From + D1;
  const d3From = d2From + D2;
  const holdFrom = d3From + D3 - PULSE; // D3 뒷부분(마지막 0.5s)에서 펄스 강조

  // 페이오프 강조 — "당근→양파" 대체 가능 칩이 보일 때 살짝 확대 펄스(프리즈 없이, 실사 재생 그대로)
  const holdLocal = frame - holdFrom;
  const holdScale =
    holdLocal >= 0
      ? interpolate(spring({ frame: holdLocal, fps, config: { damping: 10, mass: 0.6 } }), [0, 1], [1, 1.05])
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: frame >= holdFrom ? `scale(${holdScale})` : undefined,
        }}
      >
        <Sequence from={d1From} durationInFrames={D1} name="filter">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.filter[0]}
            rawTo={DEMO_RAW.filter[1]}
            rate={rateFilter}
            len={D1}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
          />
        </Sequence>
        <Sequence from={d2From} durationInFrames={D2} name="results">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.results[0]}
            rawTo={DEMO_RAW.results[1]}
            rate={rateResults}
            len={D2}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
          />
        </Sequence>
        <Sequence from={d3From} durationInFrames={D3} name="substitute">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.substitute[0]}
            rawTo={DEMO_RAW.substitute[1]}
            rate={1}
            len={D3}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            shiftY={-210}
          />
        </Sequence>
      </div>

      <Caption from={d1From} len={D1 + D2} text={"내 냉장고 기준으로\n매칭률 순으로 정렬"} />
      <Caption from={d3From} len={D3} text={"없는 재료 대신\n있는 걸로 바꿔드려요"} />
    </AbsoluteFill>
  );
};
