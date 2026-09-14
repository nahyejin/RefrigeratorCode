import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { fitToNarration } from "./narrationFrames";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps, 대사 포함) — 턱 괴고 검색창 앞에서 썼다 지웠다
// 반복하다 "아, 레시피 찾는 것도 너무 일이고 귀찮네" 혼잣말 후 다시 폰으로 시선 내리는 리액션.
//
// 오디오 페이드/컷 타이밍을 여러 차례(1~5차) 정밀하게 맞춰봐도 "버벅거린다"는 지적이 계속돼서
// 다시 보니, 문제는 오디오가 아니라 "컷 지점에서 0.6초 정지 홀드"로 얼려둔 화면 자체였음 — 하필
// 그 프레임이 반쯤 감긴 눈에 입이 어정쩡하게 벌어진 "말하는 도중" 표정이라, 그걸 0.6초간 얼려서
// 보여주니 "화면이 멈췄는데 표정도 이상하다"는 위화감을 만든 것("표정도 그렇고"라는 지적과 일치).
// 그래서 정지 홀드를 아예 없애고, 대사 클립 끝에서 리액션 클립으로 바로 하드컷한다 — 두 클립 다
// 같은 촬영본의 서로 다른 시점이라 원래도 이어붙이는 게 자연스럽고, 얼린 표정이 없으니 위화감의
// 원인 자체가 사라진다. 오디오는 여전히 ffmpeg afade로 미리 곱게 죽여둔 clean 파일을 그대로 씀.
const HOOK_LINE_VIDEO = "reel6_hook_line_clean.mp4"; // 5.6s, 168f — 대사("...일이고"까지), afade(exp, 0.25s)로 이미 끝을 죽여둠
const HOOK_TURN_VIDEO = "reel6_hook_turn_clean.mp4"; // 1.7s, 51f — 리액션(무음, -an으로 오디오 트랙 자체를 제거)
// 데모: 실제 쿡매치 요리 챗봇 흐름(36s, 880x1920, 30fps) — 질문 입력 → 로딩 → AI 답변(이유 설명) + 레시피 카드
const DEMO_VIDEO = "reel6_chatbot_demo.mp4";

// 데모 화면 녹화본 최상단에 iOS 상태바 + 화면 녹화 표시가 그대로 찍혀 있어서 위쪽 180px을 크롭해서
// 뺀다. 스케일(확대) 기반 크롭은 가로가 잘리거나(scale) 세로가 찌그러 보이는(scaleY) 부작용이 있어서,
// 콘텐츠를 위로 cropTop만큼 밀어 올리는 position 이동 방식으로 처리 — 비율·가로폭을 전혀 안 건드린다.
const TOPCROP_PX = 180;

const HB1 = 168; // reel6_hook_line_clean.mp4 전체 프레임 수
const HB2 = 51; // reel6_hook_turn_clean.mp4 전체 프레임 수
const HOOK_LEN = HB1 + HB2; // 219f — 정지 홀드 없이 바로 하드컷

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

// CTA 나레이션("검색 대신, 말 한마디면 충분해요. 쿡매치. 지금 프로필 링크에서 시작하세요.")이 끝난 뒤
// 15f 여유를 두고 끝낸다(원래 3.0s). 데모 자막 두 비트(5.4s·6.2s)는 나레이션보다 충분히 길어서 그대로 둔다.
const CTA_LEN = fitToNarration(90, "reel6_narration_cta", 15);

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
        <Audio src={staticFile("reel6_narration_cta.mp3")} />
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
  cropTop?: number;
  fade?: boolean;
  muted?: boolean;
  punchZoom?: number; // 비트 시작 시점(또는 punchDelay 이후)에 스프링으로 이 배율까지 확대되어 강조
  punchOrigin?: string;
  punchDelay?: number; // 확대가 시작되는 시점을 늦춘다(예: 채팅 말풍선이 뒤늦게 뜨는 비트)
}> = ({
  src,
  rawFrom,
  rawTo,
  rate,
  len,
  width,
  height,
  left,
  zoom = 1,
  origin = "center",
  cropTop = 0,
  fade = true,
  muted = true,
  punchZoom,
  punchOrigin,
  punchDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = fade
    ? interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const fadeOut = fade
    ? interpolate(frame, [len - 5, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const scale = punchZoom
    ? interpolate(spring({ frame: frame - punchDelay, fps, config: { damping: 14, mass: 0.7 } }), [0, 1], [1, punchZoom])
    : zoom;
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
      <div style={{ width: "100%", height: "100%", transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: punchZoom ? punchOrigin ?? origin : origin }}>
        {/* 위쪽 cropTop px를 잘라내되, 잘려나간 만큼 위아래에 똑같이 여백이 남도록 창 자체를
            중앙에 놓는다(top: cropTop/2) — 가로 폭·비율은 전혀 안 건드림. */}
        <div style={{ position: "absolute", top: cropTop / 2, left: 0, width: "100%", height: `calc(100% - ${cropTop}px)`, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -cropTop, left: 0, width: "100%", height: `calc(100% + ${cropTop}px)` }}>
            <OffthreadVideo
              src={staticFile(src)}
              trimBefore={rawFrom}
              trimAfter={rawTo}
              playbackRate={rate}
              muted={muted}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// 미리 구워둔(pre-baked) 클린 클립 전용 — 트리밍·볼륨 조작 없이 파일 전체를 그대로 재생한다.
// fadeOutFrames를 주면 끝부분만 천천히 흰 화면으로 페이드아웃(훅 마지막 컷 → 데모 전환용, 08편에서
// "뚝 끊기는" 느낌이 든다는 피드백을 받아 확인한 처리).
const CleanClip: React.FC<{ src: string; width: number; height: number; left: number; muted?: boolean; fadeOutFrames?: number; len?: number }> = ({
  src,
  width,
  height,
  left,
  muted = true,
  fadeOutFrames = 0,
  len = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity =
    fadeOutFrames > 0 && len > 0
      ? interpolate(frame, [len - fadeOutFrames - 1, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  return (
    <div style={{ position: "absolute", top: 0, left, width, height, overflow: "hidden", border: `1px solid ${LINE}`, opacity }}>
      <OffthreadVideo src={staticFile(src)} muted={muted} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

// ---------- ①② 훅 (제미나이 생성 실사, 720x1280 — 캔버스와 같은 9:16이라 크롭 없이 꽉 참) ----------
const Hook: React.FC = () => {
  const b2From = HB1;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HB1} name="line">
        <CleanClip src={HOOK_LINE_VIDEO} width={1080} height={1920} left={0} muted={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="turn">
        <CleanClip src={HOOK_TURN_VIDEO} width={1080} height={1920} left={0} len={HB2} fadeOutFrames={24} />
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
        {/* 질문을 입력해 전송하는 비트 — 말풍선("아이가 잘 먹는 음식 추천")이 뜨는 건 비트 끝
            무렵이라, punchDelay로 확대 시작을 늦춰서 말풍선이 뜬 뒤에 그쪽으로 확대되게 함. */}
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.ask[0]}
          rawTo={DEMO_RAW.ask[1]}
          rate={rateAsk}
          len={ASK_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          cropTop={TOPCROP_PX}
          fade={false}
          punchZoom={1.3}
          punchOrigin="73% 30%"
          punchDelay={ASK_LEN - 30}
        />
      </Sequence>
      <Sequence from={loadingFrom} durationInFrames={LOADING_LEN} name="loading">
        <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.loading[0]} rawTo={DEMO_RAW.loading[1]} rate={rateLoading} len={LOADING_LEN} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} cropTop={TOPCROP_PX} />
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
            cropTop={TOPCROP_PX}
            fade={false}
          />
        </Sequence>
      </div>

      <Caption from={askFrom} len={ASK_LEN + LOADING_LEN} text={"말하듯 물어보면\n딱 맞는 레시피를 찾아줘요"} />
      <Caption from={revealFrom} len={REVEAL_LEN} text={"내 재료, 내 취향까지\n반영해서 골라줘요"} />

      {/* 데모 자막 음성 나레이션(제미나이 TTS, Kore) — 자막 타이핑 시작 프레임에 맞춰 재생 */}
      <Sequence from={askFrom} durationInFrames={fitToNarration(ASK_LEN + LOADING_LEN, "reel6_narration_1")} name="narration-1">
        <Audio src={staticFile("reel6_narration_1.mp3")} />
      </Sequence>
      <Sequence from={revealFrom} durationInFrames={fitToNarration(REVEAL_LEN, "reel6_narration_2")} name="narration-2">
        <Audio src={staticFile("reel6_narration_2.mp3")} />
      </Sequence>
    </AbsoluteFill>
  );
};
