import React from "react";
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro } from "./shared";

// 원본: VID_20260911180601731.mp4 (15.2s, 632x1280, 30fps) — 실제 쿡매치 사진 인식 데모
const RAW_VIDEO = "reel1_photo_recognition.mp4";
// 훅 비주얼: 제미나이로 생성한 실사풍 클립(4.625s, 632x1124, 24fps) — "이거 저번에도 샀나?"
const HOOK_VIDEO = "reel1_hook_gemini.mov";

// ---- 원본 타임코드(30fps 기준 프레임) — 콘티 "원본 매핑" 표와 동일 ----
const RAW = {
  modal: [120, 150], // 0:04–0:05 "어떤 사진을 고르실 건가요?" 모달
  select: [255, 270], // 0:08.5–0:09 쿠팡 캡처 선택 확정(로고 노출 구간 → 블러)
  loading: [270, 360], // 0:09–0:12 인식 로딩
  result: [360, 390], // 0:12–0:13 "3개를 읽었어요" 결과
  done: [390, 450], // 0:13–0:15 냉장고 반영 + 토스트
};
// ※ 0:05–0:08(사진첩 스크롤 — 아이 사진 노출)은 완전히 컷.

const rateC1 = 1.2;
const rateC3 = 1.2;

const C1 = Math.round((RAW.modal[1] - RAW.modal[0]) / rateC1); // 25f
const C2 = RAW.select[1] - RAW.select[0]; // 15f (원속도, 블러)
const C3 = Math.round((RAW.loading[1] - RAW.loading[0]) / rateC3); // 75f
const C4 = RAW.result[1] - RAW.result[0]; // 30f
const C5 = RAW.done[1] - RAW.done[0]; // 60f
const HOLD = 21; // 0.7s 페이오프 홀드

const HOOK_VIDEO_LEN = 135; // 4.5s — 원본 4.625s 중 여유를 두고 사용
const DEMO_LEN = C1 + C2 + C3 + C4 + C5 + HOLD; // 226f
const CTA_LEN = 60; // 2.0s

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
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- ①② 훅 (제미나이 생성 실사 클립 + 자막) ----------
// 원본 하단(영수증 밑부분 상호명 자리)에 깨진 한글이 찍혀 있어서, 화면을 살짝
// 확대해 top 기준으로 크롭한다 — 사람·손·영수증 본문은 그대로 두고 맨 아래만 잘려나간다.
const HookVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: WHITE }}>
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(HOOK_VIDEO)}
        style={{ position: "absolute", top: 0, left: "-5%", width: "110%", height: "110%", objectFit: "cover" }}
      />
    </div>
    <DemoCaption from={0} len={HOOK_VIDEO_LEN - 10} text="이거 저번에도 샀나?" />
  </AbsoluteFill>
);

// ---------- ③ 데모 (실사) ----------
const VIDEO_W = 948; // 632x1280 원본을 캔버스 높이(1920)에 맞춰 스케일(x1.5)
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2;

// 서브클립 하나 = 원본 특정 구간을 트리밍해서 보여주는 레이어.
// 시작/끝에 살짝 오페시티를 낮춰서(화이트로 디졸브) 배속·컷 경계가 뚝뚝 끊기지 않게 한다.
const DemoClip: React.FC<{
  rawFrom: number;
  rawTo: number;
  rate: number;
  len: number;
  blur?: boolean;
}> = ({ rawFrom, rawTo, rate, len, blur }) => {
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
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: blur ? "blur(14px)" : undefined }}
      />
    </div>
  );
};

const TYPE_FRAMES = 16; // 타이핑 효과 — 이 프레임 안에 전체 글자가 다 찍힌다

// 릴스에서 흔히 보는 "타이핑되는 자막" 스타일: 검정 필 배경 + 굵은 흰 글자,
// 화면 중앙에 가깝게 둔다(뒤 화면이 좀 가려지더라도 가독성을 우선).
const DemoCaption: React.FC<{ text: string; from: number; len: number }> = ({ text, from, len }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < -4 || local > len + 4) return null;

  const boxOpacity = interpolate(local, [0, 4, len - 5, len], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typeProgress = interpolate(local, [0, TYPE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const chars = Math.round(text.length * typeProgress);
  const shown = text.slice(0, chars);
  const cursorOn = chars < text.length && Math.floor(local / 4) % 2 === 0;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 44,
          right: 44,
          top: 840,
          textAlign: "center",
          opacity: boxOpacity,
        }}
      >
        <div
          style={{
            display: "inline-block",
            maxWidth: 940,
            backgroundColor: "rgba(17,17,19,0.88)",
            borderRadius: 22,
            padding: "22px 34px",
            fontSize: 58,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.32,
            whiteSpace: "pre-line", // 줄바꿈은 브라우저 자동 랩에 맡기지 않고 text의 \n으로 직접 지정한다
          }}
        >
          {shown}
          {cursorOn ? "▏" : ""}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const c1From = 0;
  const c2From = c1From + C1;
  const c3From = c2From + C2;
  const c4From = c3From + C3;
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
        <Sequence from={c2From} durationInFrames={C2} name="select(blur)">
          <DemoClip rawFrom={RAW.select[0]} rawTo={RAW.select[1]} rate={1} len={C2} blur />
        </Sequence>
        <Sequence from={c3From} durationInFrames={C3} name="loading">
          <DemoClip rawFrom={RAW.loading[0]} rawTo={RAW.loading[1]} rate={rateC3} len={C3} />
        </Sequence>
        <Sequence from={c4From} durationInFrames={C4} name="result">
          <DemoClip rawFrom={RAW.result[0]} rawTo={RAW.result[1]} rate={1} len={C4} />
        </Sequence>
        <Sequence from={c5From} durationInFrames={C5} name="done">
          <DemoClip rawFrom={RAW.done[0]} rawTo={RAW.done[1]} rate={1} len={C5} />
        </Sequence>
        <Sequence from={holdFrom} durationInFrames={HOLD} name="hold">
          <DemoClip rawFrom={RAW.done[1] - 1} rawTo={RAW.done[1]} rate={0.02} len={HOLD} />
        </Sequence>
      </div>

      <DemoCaption from={c1From} len={c1From + C1 + C2 + C3 - c1From} text={"영수증이든 음식 사진이든\n한 장이면 자동 인식"} />
      <DemoCaption from={c4From} len={C4 + C5 + HOLD} text={"재료랑 유통기한까지\n자동으로"} />
    </AbsoluteFill>
  );
};
