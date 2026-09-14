import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";
import { fitToNarration } from "./narrationFrames";

// 원본: VID_20260911180601731.mp4 (15.2s, 632x1280, 30fps) — 실제 쿡매치 사진 인식 데모
const RAW_VIDEO = "reel1_photo_recognition.mp4";
// 훅 비주얼: 제미나이로 생성한 실사풍 클립(4.625s, 632x1124, 24fps) — "이거 저번에도 샀나?"
const HOOK_VIDEO = "reel1_hook_gemini.mov";

// ---- 원본 타임코드(30fps 기준 프레임) — 콘티 "원본 매핑" 표와 동일 ----
const RAW = {
  modal: [120, 150], // 0:04–0:05 "어떤 사진을 고르실 건가요?" 모달
  browse: [150, 240], // 0:05–0:08 사진첩에서 쿠팡 캡처 탐색(사용자 확인 후 그대로 사용)
  select: [255, 270], // 0:08.5–0:09 쿠팡 캡처 선택 확정(로고 노출 구간 → 블러)
  loading: [270, 336], // 0:09–0:11.2 인식 로딩 (11.4~12.05s 부근 "아기방 소리 감지" 알림 배너 회피)
  result: [369, 390], // 0:12.3–0:13 "3개를 읽었어요" 결과
  done: [390, 450], // 0:13–0:15 냉장고 반영 + 토스트
};

const rateC1 = 1.2;
const rateBrowse = 1.2;
const rateC3 = 1.2;

const C1 = Math.round((RAW.modal[1] - RAW.modal[0]) / rateC1); // 25f
const CBrowse = Math.round((RAW.browse[1] - RAW.browse[0]) / rateBrowse); // 75f
const C2 = RAW.select[1] - RAW.select[0]; // 15f (원속도, 블러)
const C3 = Math.round((RAW.loading[1] - RAW.loading[0]) / rateC3); // 75f
const C4 = RAW.result[1] - RAW.result[0]; // 30f
const C5 = RAW.done[1] - RAW.done[0]; // 60f
const HOLD = 21; // 0.7s 페이오프 홀드(나레이션이 더 길면 아래 PAYOFF_HOLD로 늘어남)

// 데모 자막 나레이션(제미나이 TTS)이 비트보다 길면 비트를 나레이션 끝까지 늘린다 — 길이는
// narrationFrames.ts(실제 mp3 길이에서 자동 생성)에서 가져와서, 음성을 다시 뽑아도 손으로 안 고친다.
// 1번 자막 비트는 로딩 마지막 프레임을 정지 이미지로, 2번 자막 비트는 기존 페이오프 홀드를 늘려서 채움.
const BEAT1_BASE = C1 + CBrowse + C2 + C3; // 170f
const BEAT1 = fitToNarration(BEAT1_BASE, "reel1_narration_1");
const LOADING_FREEZE = BEAT1 - BEAT1_BASE;
const BEAT2 = fitToNarration(C4 + C5 + HOLD, "reel1_narration_2");
const PAYOFF_HOLD = BEAT2 - C4 - C5;

const HOOK_VIDEO_LEN = 135; // 4.5s — 원본 4.625s 중 여유를 두고 사용
const DEMO_LEN = BEAT1 + BEAT2;
// CTA 나레이션("냉장고, 기억 안 해도 돼요. 쿡매치. 지금 프로필 링크에서 시작하세요.")이 끝난 뒤에도
// 살짝 정지 유지 구간(20f)을 남긴다.
const CTA_LEN = fitToNarration(90, "reel1_narration_cta", 20);

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_VIDEO_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL1_TOTAL_FRAMES = CTA_FROM + CTA_LEN; // ≈ 14.0s

export const Reel1Receipt: React.FC = () => {
  useCustomFont();
  return (
    // 무음 마스터 — BGM은 업로드 시 릴스 자체 음원 기능으로 얹는 걸 전제로 뺐다.
    // 7편을 전부 같은 트랙으로 깔면 지루해지고, 릴스 트렌드 음원을 쓰는 쪽이 노출에도 유리하다.
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Sequence from={HOOK_FROM} durationInFrames={HOOK_VIDEO_LEN} name="Hook">
        <HookVideo />
      </Sequence>
      <Sequence from={DEMO_FROM} durationInFrames={DEMO_LEN} name="Demo">
        <Demo />
      </Sequence>
      <Sequence from={CTA_FROM} durationInFrames={CTA_LEN} name="CTA">
        <CtaOutro
          payoffLine={
            <>
              냉장고, <span style={{ color: "#D99A00" }}>기억 안 해도 돼요</span>
            </>
          }
        />
        <Audio src={staticFile("reel1_narration_cta.mp3")} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- ①② 훅 (제미나이 생성 실사 클립 + 자막) ----------
// 원본 하단(영수증 밑부분 상호명 자리)에 깨진 한글이 찍혀 있어서, 화면을 살짝
// 확대해 top 기준으로 크롭한다 — 사람·손·영수증 본문은 그대로 두고 맨 아래만 잘려나간다.
const HOOK_FADE_OUT = 24; // 0.8s — 훅 끝에서 데모로 하드컷되면 "뚝 끊기는" 느낌이 든다는 피드백(08편에서 확인) 반영, 끝만 천천히 흰 화면으로
const HookVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [HOOK_VIDEO_LEN - HOOK_FADE_OUT - 1, HOOK_VIDEO_LEN - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: fadeOut }}>
        <OffthreadVideo
          src={staticFile(HOOK_VIDEO)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.14)",
            transformOrigin: "top center",
          }}
        />
      </div>
      <Caption from={0} len={HOOK_VIDEO_LEN - 10} text="이거 저번에도 샀나?" />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사) ----------
const VIDEO_W = 948; // 632x1280 원본을 캔버스 높이(1920)에 맞춰 스케일(x1.5)
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2;

// 서브클립 하나 = 원본 특정 구간을 트리밍해서 보여주는 레이어.
// 시작/끝에 살짝 오페시티를 낮춰서(화이트로 디졸브) 배속·컷 경계가 뚝뚝 끊기지 않게 한다.
// punchZoom을 주면 비트 시작 시점에 스프링으로 그 지점까지 확대되어 그대로 유지된다("결과 숫자
// 같은 핵심 정보가 뜨는 순간 확대되어 강조돼야 한다"는 피드백으로 03편에서 쓴 패턴을 이식).
const DemoClip: React.FC<{
  rawFrom: number;
  rawTo: number;
  rate: number;
  len: number;
  blur?: boolean;
  punchZoom?: number;
  punchOrigin?: string;
  fadeOut?: boolean; // 바로 뒤에 같은 화면의 정지 컷이 이어지면 false — 이음매에서 깜빡이지 않게
}> = ({ rawFrom, rawTo, rate, len, blur, punchZoom, punchOrigin = "center", fadeOut: withFadeOut = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = withFadeOut
    ? interpolate(frame, [len - 5, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const scale = punchZoom
    ? interpolate(spring({ frame, fps, config: { damping: 14, mass: 0.7 } }), [0, 1], [1, punchZoom])
    : 1;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: VIDEO_LEFT,
        width: VIDEO_W,
        height: VIDEO_H,
        overflow: "hidden",
        border: `1px solid ${LINE}`,
        opacity: Math.min(fadeIn, fadeOut),
      }}
    >
      <OffthreadVideo
        src={staticFile(RAW_VIDEO)}
        trimBefore={rawFrom}
        trimAfter={rawTo}
        playbackRate={rate}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: blur ? "blur(14px)" : undefined,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: punchOrigin,
        }}
      />
    </div>
  );
};

// 비트를 나레이션 끝까지 늘릴 때 쓰는 정지 컷 — 앞 클립의 마지막 프레임을 PNG로 뽑아 같은 박스에 고정
// (분수 배속으로 얼리는 트릭은 흰 화면 버그 위험이 있어 새로 늘리는 구간엔 쓰지 않는다).
const FreezeFrame: React.FC<{ src: string; len: number }> = ({ src, len }) => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [len - 5, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: VIDEO_H, overflow: "hidden", border: `1px solid ${LINE}`, opacity: fadeOut }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const c1From = 0;
  const browseFrom = c1From + C1;
  const c2From = browseFrom + CBrowse;
  const c3From = c2From + C2;
  const c4From = c3From + C3 + LOADING_FREEZE;
  const c5From = c4From + C4;
  const holdFrom = c5From + C5;

  // 페이오프 홀드 — "3개를 담았어요" 토스트 순간에서 살짝 확대 펄스
  const holdLocal = frame - holdFrom;
  const holdScale =
    holdLocal >= 0
      ? interpolate(
          spring({ frame: holdLocal, fps, config: { damping: 10, mass: 0.6 } }),
          [0, 1],
          [1, 1.05]
        )
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
        <Sequence from={c1From} durationInFrames={C1} name="modal">
          <DemoClip rawFrom={RAW.modal[0]} rawTo={RAW.modal[1]} rate={rateC1} len={C1} />
        </Sequence>
        <Sequence from={browseFrom} durationInFrames={CBrowse} name="browse">
          <DemoClip rawFrom={RAW.browse[0]} rawTo={RAW.browse[1]} rate={rateBrowse} len={CBrowse} />
        </Sequence>
        <Sequence from={c2From} durationInFrames={C2} name="select(blur)">
          <DemoClip rawFrom={RAW.select[0]} rawTo={RAW.select[1]} rate={1} len={C2} blur />
        </Sequence>
        <Sequence from={c3From} durationInFrames={C3} name="loading">
          <DemoClip rawFrom={RAW.loading[0]} rawTo={RAW.loading[1]} rate={rateC3} len={C3} fadeOut={LOADING_FREEZE === 0} />
        </Sequence>
        {LOADING_FREEZE > 0 && (
          <Sequence from={c3From + C3} durationInFrames={LOADING_FREEZE} name="loading-freeze">
            <FreezeFrame src="reel1_loading_freeze.png" len={LOADING_FREEZE} />
          </Sequence>
        )}
        <Sequence from={c4From} durationInFrames={C4} name="result">
          {/* "3개를 담았어요" 토스트가 뜨는 순간 확대되어 강조 — 토스트가 화면 하단 중앙에 뜨는
              자리라 좌우로 잘릴 걱정 없이 그 자리 기준으로 그냥 확대해도 된다. */}
          <DemoClip rawFrom={RAW.result[0]} rawTo={RAW.result[1]} rate={1} len={C4} punchZoom={1.3} punchOrigin="50% 85%" />
        </Sequence>
        <Sequence from={c5From} durationInFrames={C5} name="done">
          <DemoClip rawFrom={RAW.done[0]} rawTo={RAW.done[1]} rate={1} len={C5} />
        </Sequence>
        <Sequence from={holdFrom} durationInFrames={PAYOFF_HOLD} name="hold">
          <DemoClip rawFrom={RAW.done[1] - 1} rawTo={RAW.done[1]} rate={0.02} len={PAYOFF_HOLD} />
        </Sequence>
      </div>

      <Caption from={c1From} len={BEAT1} text={"영수증이든 음식 사진이든\n한 장이면 자동 인식"} />
      <Caption from={c4From} len={BEAT2} text={"재료랑 유통기한까지\n자동으로"} />

      {/* 데모 자막 음성 나레이션(제미나이 TTS, Kore) — 자막 타이핑 시작 프레임에 맞춰 재생.
          화면 자막은 명사구로 끝나지만, TTS에 명사구를 넣으면 끝 발음이 뭉개지는 사고가 있어서
          음성은 동사로 끝나는 완전한 문장("…자동으로 인식돼요", "…자동으로 등록돼요")으로 뽑았다. */}
      <Sequence from={c1From} durationInFrames={BEAT1} name="narration-1">
        <Audio src={staticFile("reel1_narration_1.mp3")} />
      </Sequence>
      <Sequence from={c4From} durationInFrames={BEAT2} name="narration-2">
        <Audio src={staticFile("reel1_narration_2.mp3")} />
      </Sequence>
    </AbsoluteFill>
  );
};
