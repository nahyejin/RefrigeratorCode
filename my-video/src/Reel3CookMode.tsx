import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps) — 주방에서 요리하다 폰을 만지려는 여성
const HOOK_VIDEO = "reel3_hook_gemini.mp4";
// 데모: 실제 쿡매치 요리모드 음성 읽어주기 화면(28.1s, 880x1920, 120fps)
const DEMO_VIDEO = "reel3_cookmode_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) — 10s 중 세 순간만 발췌 ----
const HOOK_RAW = {
  cooking: [0, 45], // 0:00–1.5 팬 젓는 모습
  reach: [210, 255], // 0:07–8.5 물 묻은 손으로 폰 만지려는 순간
  settle: [270, 300], // 0:09–10.0 다시 조리로 돌아감
};
const HB1 = HOOK_RAW.cooking[1] - HOOK_RAW.cooking[0]; // 45f
const HB2 = HOOK_RAW.reach[1] - HOOK_RAW.reach[0]; // 45f
const HB3 = HOOK_RAW.settle[1] - HOOK_RAW.settle[0]; // 30f
const HOOK_LEN = HB1 + HB2 + HB3; // 120f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  reading: [240, 300], // 0:08–10.0 "읽어주기" 활성 상태(멈추기 버튼) + 1단계 하이라이트
  advance: [489, 549], // 0:16.3–18.3 1단계→2단계로 자동 하이라이트 전환(마지막 0.5s는 펄스)
};
const rateReading = 1.2;

const D1 = Math.round((DEMO_RAW.reading[1] - DEMO_RAW.reading[0]) / rateReading); // 50f
const D2 = DEMO_RAW.advance[1] - DEMO_RAW.advance[0]; // 60f
const PULSE = 15; // D2의 마지막 0.5s는 정지 없이 펄스만 강조(reel2와 동일한 이유로 프리즈 트릭은 피함)
const DEMO_LEN = D1 + D2; // 110f

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL3_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel3CookMode: React.FC = () => {
  useCustomFont();
  return (
    // 무음 마스터 — 음원은 업로드 시 릴스 자체 기능으로 얹는 걸 전제로 함(01~02편과 동일 방침)
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
              이제 손으론 요리하고,
              <br />
              <span style={{ color: "#D99A00" }}>레시피는 귀로 들으세요</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// 서브클립 공용 — 원본 특정 구간을 트리밍해서 보여준다.
// fade=true면 시작/끝에 살짝 화이트 디졸브(흰 배경 앱 화면끼리는 안 보이지만,
// 사람 얼굴 같은 실사 위에서는 "깜빡"거리는 것처럼 도드라져서 훅에는 끈다).
const SubClip: React.FC<{
  src: string;
  rawFrom: number;
  rawTo: number;
  rate: number;
  len: number;
  width: number;
  height: number;
  left: number;
  zoom?: number; // 특정 화면 요소를 더 크게 강조하거나(대체재료처럼), 화면 일부(상태표시줄 등)를 크롭할 때 확대 배율
  origin?: string; // 확대 중심점(transform-origin)
  fade?: boolean;
}> = ({ src, rawFrom, rawTo, rate, len, width, height, left, zoom = 1, origin = "center", fade = true }) => {
  const frame = useCurrentFrame();
  const fadeIn = fade
    ? interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const fadeOut = fade
    ? interpolate(frame, [len - 5, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          transformOrigin: origin,
        }}
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
      <Sequence from={b1From} durationInFrames={HB1} name="cooking">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.cooking[0]} rawTo={HOOK_RAW.cooking[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="reach">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.reach[0]} rawTo={HOOK_RAW.reach[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} />
      </Sequence>
      <Sequence from={b3From} durationInFrames={HB3} name="settle">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.settle[0]} rawTo={HOOK_RAW.settle[1]} rate={1} len={HB3} width={1080} height={1920} left={0} fade={false} />
      </Sequence>

      <Caption from={b1From} len={HB1} text={"요리할 땐 손에 뭐가\n많이 묻어있는데"} />
      <Caption from={b2From} len={HB2 + HB3} text={"블로그 보면서 손으로\n순서 따라가기 힘들잖아요"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 880x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 880;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 100
// 화면 맨 위 상태표시줄(녹화 표시 등)을 가리기 위해, 아래를 기준점 삼아 살짝 확대해서 위쪽만 크롭한다.
const TOP_CROP_ZOOM = 1.08;
const TOP_CROP_ORIGIN = "center bottom";

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const d1From = 0;
  const d2From = d1From + D1;
  const pulseFrom = d2From + D2 - PULSE;

  // 페이오프 강조 — 2단계로 자동 전환된 순간 살짝 확대 펄스(프리즈 없이, 실사 재생 그대로)
  const pulseLocal = frame - pulseFrom;
  const pulseScale =
    pulseLocal >= 0
      ? interpolate(spring({ frame: pulseLocal, fps, config: { damping: 10, mass: 0.6 } }), [0, 1], [1, 1.05])
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
          transform: frame >= pulseFrom ? `scale(${pulseScale})` : undefined,
        }}
      >
        <Sequence from={d1From} durationInFrames={D1} name="reading">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.reading[0]}
            rawTo={DEMO_RAW.reading[1]}
            rate={rateReading}
            len={D1}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={TOP_CROP_ZOOM}
            origin={TOP_CROP_ORIGIN}
          />
        </Sequence>
        <Sequence from={d2From} durationInFrames={D2} name="advance">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.advance[0]}
            rawTo={DEMO_RAW.advance[1]}
            rate={1}
            len={D2}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={TOP_CROP_ZOOM}
            origin={TOP_CROP_ORIGIN}
          />
        </Sequence>
      </div>

      <Caption from={d1From} len={D1} text={"손 안 대도 돼요\n요리 끝날 때까지 읽어드려요"} />
      <Caption from={d2From} len={D2} text={"이제 손으론 요리하고\n레시피는 귀로 들으세요"} />
    </AbsoluteFill>
  );
};
