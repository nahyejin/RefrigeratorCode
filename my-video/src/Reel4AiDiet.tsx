import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(8s, 720x1280, 24fps, 대사 포함) — 마트 계산대에서 영수증이 과장되게 길게 나옴
const HOOK_VIDEO = "reel4_hook_gemini.mp4";
// 데모: 실제 쿡매치 AI 식단 추천(쓸 재료 30개 → 장보기 목록 4개) + 부족재료 쿠팡 연결(52s, 880x1920, 30fps)
const DEMO_VIDEO = "reel4_diet_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) ----
// silencedetect로 확인한 발화 구간이 0~6.2s 사이 거의 이어져 있어서(짧은 숨쉬기 정도만 끊김),
// 문장이 잘리지 않도록 앞부분을 통으로 쓰고, 뒤쪽 무음 구간(헛웃음)만 따로 하드컷.
const HOOK_RAW = {
  // 실제 대사가 4.4~6.0s에 걸쳐 한 번 더 이어지는데 이전 버전은 0~4.0s에서 끊어서
  // 뒷부분 대사가 통째로 잘려나갔었음 — 진짜 마지막 무음 구간(5.98~6.17s)까지 통으로 늘림
  shock: [0, 183], // 0:00–6.1 영수증이 길게 나오는 걸 보며 놀라서 말하는 대사 전체(끊지 않고 통짜)
  laugh: [207, 237], // 0:06.9–7.9 헛웃음 지으며 고개 젓는 순간(무음)
};
const HB1 = HOOK_RAW.shock[1] - HOOK_RAW.shock[0]; // 120f
const HB2 = HOOK_RAW.laugh[1] - HOOK_RAW.laugh[0]; // 30f
const HOOK_LEN = HB1 + HB2; // 150f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  prompt: [30, 90], // 0:01.0–3.0 "쓸 재료 30개" 인사 + "아이 먹을 것 위주로" 빠른 답장 칩
  loading: [90, 540], // 0:03.0–18.0 로딩 3단계(냉장고 보는 중 → 요일 나눠 담는 중 → 거의 다 됐어요)
  reveal: [570, 660], // 0:19.0–22.0 "쓸 재료 30개" + AI 답변 + 앱이 직접 보여주는 "장보기 4개면 7일치가 돼요" 헤드라인(페이오프)
  // "사러 가기" 탭 → 쿠팡으로 전환: 중간에 앱 업데이트 팝업/추석 프로모 스플래시가 껴 있어서
  // 그 부분만 건너뛰고 전환 애니메이션 → 깨끗한 검색 결과 화면 두 조각만 하드컷으로 이어붙임
  coupangGo: [924, 954], // 0:30.8–31.8 "쿠팡으로 이동중" 전환 화면(탭 직후는 아직 리스트라 살짝 뒤로 밈)
  coupangResult: [1068, 1098], // 0:35.6–36.6 "애호박" 검색 결과(팝업 사라진 뒤 깨끗한 상태)
};
const ratePrompt = 1;
const rateLoading = 4.0; // 로딩 15초를 배속으로 압축
const rateReveal = 1;

const D1 = Math.round((DEMO_RAW.prompt[1] - DEMO_RAW.prompt[0]) / ratePrompt); // 60f
const D2 = Math.round((DEMO_RAW.loading[1] - DEMO_RAW.loading[0]) / rateLoading); // 113f
const D3 = Math.round((DEMO_RAW.reveal[1] - DEMO_RAW.reveal[0]) / rateReveal); // 90f
const D4a = DEMO_RAW.coupangGo[1] - DEMO_RAW.coupangGo[0]; // 30f
const D4b = DEMO_RAW.coupangResult[1] - DEMO_RAW.coupangResult[0]; // 30f
const D4 = D4a + D4b; // 60f
const PULSE = 15; // D4 뒷부분에서 정지 없이 살짝 확대 펄스로 마지막 강조
const DEMO_LEN = D1 + D2 + D3 + D4; // 323f

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL4_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel4AiDiet: React.FC = () => {
  useCustomFont();
  return (
    // 무음 마스터가 원칙이지만, 훅의 실제 대사 음성만은 예외로 살려서 씀(01·02편과 동일 방침) — 데모는 계속 무음
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
              이제 장보기도, <span style={{ color: "#D99A00" }}>가장 효율적으로</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// 서브클립 공용 — 원본 특정 구간을 트리밍해서 보여준다.
const SubClip: React.FC<{
  src: string;
  rawFrom: number;
  rawTo: number;
  rate: number;
  len: number;
  width: number;
  height: number;
  left: number;
  zoom?: number;
  origin?: string;
  fade?: boolean;
  muted?: boolean;
}> = ({ src, rawFrom, rawTo, rate, len, width, height, left, zoom = 1, origin = "center", fade = true, muted = true }) => {
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
        muted={muted}
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
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={b1From} durationInFrames={HB1} name="shock">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.shock[0]} rawTo={HOOK_RAW.shock[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} muted={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="laugh">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.laugh[0]} rawTo={HOOK_RAW.laugh[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} />
      </Sequence>

      <Caption from={b1From} len={HB1 + HB2} text={"계획 없이 장 보다가\n카트가 한가득 찬 적 있죠?"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 880x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 880;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 100

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const d1From = 0;
  const d2From = d1From + D1;
  const d3From = d2From + D2;
  const d4From = d3From + D3;
  const d4bFrom = d4From + D4a;
  const holdFrom = d4From + D4 - PULSE;

  // 페이오프 강조 — 쿠팡 연결 화면이 뜨는 마지막 순간 살짝 확대 펄스(프리즈 없이, 실사 재생 그대로)
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
        <Sequence from={d1From} durationInFrames={D1} name="prompt">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.prompt[0]} rawTo={DEMO_RAW.prompt[1]} rate={ratePrompt} len={D1} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
        </Sequence>
        <Sequence from={d2From} durationInFrames={D2} name="loading">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.loading[0]} rawTo={DEMO_RAW.loading[1]} rate={rateLoading} len={D2} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
        </Sequence>
        <Sequence from={d3From} durationInFrames={D3} name="reveal">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.reveal[0]}
            rawTo={DEMO_RAW.reveal[1]}
            rate={rateReveal}
            len={D3}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={1.1}
            origin="50% 55%"
          />
        </Sequence>
        <Sequence from={d4From} durationInFrames={D4a} name="coupang-go">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.coupangGo[0]} rawTo={DEMO_RAW.coupangGo[1]} rate={1} len={D4a} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} fade={false} />
        </Sequence>
        <Sequence from={d4bFrom} durationInFrames={D4b} name="coupang-result">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.coupangResult[0]} rawTo={DEMO_RAW.coupangResult[1]} rate={1} len={D4b} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} fade={false} />
        </Sequence>
      </div>

      <Caption from={d1From} len={D1 + D2} text={"있는 재료를 효율적으로 써서\n장은 조금만 봐도 돼요"} />
      <Caption from={d3From} len={D3} text={"이번 주 장보기는\n딱 4개면 끝나요"} />
      <Caption from={d4From} len={D4} text={"그래도 없는 재료는\n한 번에 구매까지 연결돼요"} />
    </AbsoluteFill>
  );
};
