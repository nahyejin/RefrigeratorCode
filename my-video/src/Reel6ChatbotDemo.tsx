import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps, 대사 포함) — 턱 괴고 검색창 앞에서 썼다 지웠다
// 반복하다 "아, 레시피 찾는 것도 너무 일이고 귀찮네" 혼잣말 후 다시 폰으로 시선 내리는 리액션
const HOOK_VIDEO = "reel6_hook_gemini.mp4";
// 데모: 실제 쿡매치 요리 챗봇 흐름(36s, 880x1920, 30fps) — 질문 입력 → 로딩 → AI 답변(이유 설명) + 레시피 카드
const DEMO_VIDEO = "reel6_chatbot_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) ----
// silencedetect + 파형 확인으로 실측: 대사 전체("아, 레시피 찾는 것도 너무 일이고 귀찮네")는 4.5~7.6s에서
// 들리지만, "귀찮네"까지 다 들으면 문장이 길고 어색하다는 지적으로 "일이고" 뒤 자연스러운 숨쉬기 간격
// (약 6.6~6.9s에 실제로 파형이 끊기는 지점 있음)에서 끊고 "귀찮네"는 들리지 않게 컷.
// 1차 수정(정지 프레임 1초 홀드)에도 "그냥 잘린 느낌이 난다"는 재지적 — 원인은 화면이 아니라 오디오가
// 볼륨 그대로 뚝 끊겨서 생기는 위화감이었음. AUDIO_FADE_OUT 프레임만큼 볼륨을 서서히 줄이고(자연스러운
// 말끝 트레일링오프 느낌), 컷 지점도 6.6s→6.8s로 살짝 늦춰 원본 자체에 있는 여유(숨쉬는 간격)를 더
// 살리고, 홀드도 1.0s→1.2s로 늘려 리액션으로 넘어가기 전 여유를 더 줌.
const HOOK_RAW = {
  line: [0, 204], // 0:00–6.8 턱 괴고 검색창 보며 대사("...일이고"까지만, "귀찮네" 전에 컷)
  turn: [249, 300], // 0:08.3–10.0 다시 폰으로 시선을 내리는 리액션(무음)
};
const AUDIO_FADE_OUT = 10; // 0.33s — 컷 직전 볼륨을 서서히 줄여서 뚝 끊기는 느낌을 없앤다
const HOLD_LEN = 36; // 1.2s — 컷 지점에서 바로 안 끊기고 잠깐 멈춘 느낌을 주는 정지 홀드
const HB1 = HOOK_RAW.line[1] - HOOK_RAW.line[0]; // 204f
const HB2 = HOOK_RAW.turn[1] - HOOK_RAW.turn[0]; // 51f
const HOOK_LEN = HB1 + HOLD_LEN + HB2; // 291f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  ask: [360, 510], // 0:12.0–17.0 챗봇 진입(추천 질문 칩) → "아이가 잘 먹는 음식 추천" 입력 → 전송
  loading: [510, 699], // 0:17.0–23.3 로딩 스켈레톤 2단계("찾는 중" → "이유를 정리하는 중")
  reveal: [699, 885], // 0:23.3–29.5 AI 답변 스트리밍("유통기한 임박한 돼지고기 활용" 등) + 레시피 카드 4장
};
const rateAsk = 1.3;
const rateLoading = 4.0; // 로딩 6초를 짧게 압축
const rateReveal = 1;

const ASK_LEN = Math.round((DEMO_RAW.ask[1] - DEMO_RAW.ask[0]) / rateAsk); // 115f
const LOADING_LEN = Math.round((DEMO_RAW.loading[1] - DEMO_RAW.loading[0]) / rateLoading); // 47f
const REVEAL_LEN = Math.round((DEMO_RAW.reveal[1] - DEMO_RAW.reveal[0]) / rateReveal); // 186f
const PULSE = 15; // 레시피 카드 뒷부분 확대 펄스(페이오프)

const DEMO_LEN = ASK_LEN + LOADING_LEN + REVEAL_LEN;

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL6_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel6ChatbotDemo: React.FC = () => {
  useCustomFont();
  return (
    // 무음 마스터가 원칙이지만, 훅의 실제 대사 음성만은 예외로 살려서 씀 — 데모는 계속 무음
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
              검색 대신, <span style={{ color: "#D99A00" }}>말 한마디면 충분해요</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// 서브클립 공용 — 원본 특정 구간을 트리밍해서 보여준다(다른 릴스와 동일 패턴, 파일마다 로컬 정의).
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
  audioFadeOutFrames?: number;
}> = ({ src, rawFrom, rawTo, rate, len, width, height, left, zoom = 1, origin = "center", fade = true, muted = true, audioFadeOutFrames = 0 }) => {
  const frame = useCurrentFrame();
  const fadeIn = fade
    ? interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const fadeOut = fade
    ? interpolate(frame, [len - 5, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  // 오디오를 볼륨 그대로 뚝 끊지 않고 마지막 audioFadeOutFrames 구간에서 서서히 줄인다(하드컷 클릭/뚝
  // 끊김 방지). muted일 땐 어차피 소리가 없으니 무시.
  const audioVolume = audioFadeOutFrames
    ? interpolate(frame, [len - audioFadeOutFrames, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
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
        volume={audioVolume}
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

// 컷 지점에서 바로 안 끊기고 살짝 멈춘 느낌을 주는 정지 프레임 — 대사를 자른 자리에 삽입.
const HookFreeze: React.FC = () => (
  <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, overflow: "hidden", border: `1px solid ${LINE}` }}>
    <Img src={staticFile("reel6_hook_freeze.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

// ---------- ①② 훅 (제미나이 생성 실사, 720x1280 — 캔버스와 같은 9:16이라 크롭 없이 꽉 참) ----------
const Hook: React.FC = () => {
  const holdFrom = HB1;
  const b2From = holdFrom + HOLD_LEN;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HB1} name="line">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.line[0]} rawTo={HOOK_RAW.line[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} muted={false} audioFadeOutFrames={AUDIO_FADE_OUT} />
      </Sequence>
      <Sequence from={holdFrom} durationInFrames={HOLD_LEN} name="hold">
        <HookFreeze />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="turn">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.turn[0]} rawTo={HOOK_RAW.turn[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} />
      </Sequence>

      <Caption from={0} len={HOOK_LEN} text={"오늘 뭐 해먹지,\n검색창 앞에서 멍—"} />
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

  const askFrom = 0;
  const loadingFrom = askFrom + ASK_LEN;
  const revealFrom = loadingFrom + LOADING_LEN;
  const pulseFrom = revealFrom + REVEAL_LEN - PULSE;

  // 페이오프 강조 — 레시피 카드 리빌 뒷부분에서 살짝 확대 펄스(정지 없이, 실사 재생 그대로)
  const pulseLocal = frame - pulseFrom;
  const pulseScale =
    pulseLocal >= 0
      ? interpolate(spring({ frame: pulseLocal, fps, config: { damping: 10, mass: 0.6 } }), [0, 1], [1, 1.05])
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={askFrom} durationInFrames={ASK_LEN} name="ask">
        <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.ask[0]} rawTo={DEMO_RAW.ask[1]} rate={rateAsk} len={ASK_LEN} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} fade={false} />
      </Sequence>
      <Sequence from={loadingFrom} durationInFrames={LOADING_LEN} name="loading">
        <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.loading[0]} rawTo={DEMO_RAW.loading[1]} rate={rateLoading} len={LOADING_LEN} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
      </Sequence>

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: frame >= pulseFrom ? `scale(${pulseScale})` : undefined }}>
        <Sequence from={revealFrom} durationInFrames={REVEAL_LEN} name="reveal">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.reveal[0]}
            rawTo={DEMO_RAW.reveal[1]}
            rate={rateReveal}
            len={REVEAL_LEN}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={1.1}
            origin="50% 55%"
            fade={false}
          />
        </Sequence>
      </div>

      <Caption from={askFrom} len={ASK_LEN + LOADING_LEN} text={"말하듯 물어보면\n딱 맞는 레시피를 찾아줘요"} />
      <Caption from={revealFrom} len={REVEAL_LEN} text={"내 재료, 내 취향까지\n반영해서 골라줘요"} />
    </AbsoluteFill>
  );
};
