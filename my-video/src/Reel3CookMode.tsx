import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, CAPTION_TOP, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps) — 주방에서 요리하다 폰을 만지려는 여성
const HOOK_VIDEO = "reel3_hook_gemini.mp4";
// 데모: 실제 쿡매치 요리모드 음성 읽어주기 화면(28.1s, 880x1920, 120fps)
const DEMO_VIDEO = "reel3_cookmode_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) — 10s 중 세 순간만 발췌 ----
const HOOK_RAW = {
  cooking: [0, 45], // 0:00–1.5 팬 젓는 모습
  tap: [69, 129], // 0:02.3–4.3 손가락으로 화면을 반복해서 톡톡 두드리다 미간을 찌푸리는 순간 — 사용자가 "이 부분이 포인트"라고 짚은 구간
  reach: [210, 255], // 0:07–8.5 물 묻은 손으로 폰 만지려는 순간
  settle: [270, 300], // 0:09–10.0 다시 조리로 돌아감
};
const HB1 = HOOK_RAW.cooking[1] - HOOK_RAW.cooking[0]; // 45f
const HBTAP = HOOK_RAW.tap[1] - HOOK_RAW.tap[0]; // 60f
const HB2 = HOOK_RAW.reach[1] - HOOK_RAW.reach[0]; // 45f
const HB3 = HOOK_RAW.settle[1] - HOOK_RAW.settle[0]; // 30f
const HOOK_LEN = HB1 + HBTAP + HB2 + HB3; // 180f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  reading: [240, 300], // 0:08–10.0 "읽어주기" 활성 상태(멈추기 버튼) + 1단계 하이라이트
  advance: [489, 549], // 0:16.3–18.3 1단계→2단계로 자동 하이라이트 전환(마지막 0.5s는 펄스)
};
// "손 안 대도 돼요" 자막이 나오는 화면이 조리 순서만 나열된 정적인 화면이라, 실제로 음성이
// 나오고 있는 기능인지 잘 인식이 안 된다는 피드백 — (1) 우측 상단 "멈추기"·"1×" 버튼으로
// 점점 줌인되는 연출(ReadingZoom)과 (2) 자막 위에 음성 재생 중임을 보여주는 웨이브 인디케이터를
// 추가. 줌인이 자연스럽게 보일 시간을 주려고 배속을 1.2배→1.0배로 늦춰 비트 길이를 늘림.
const rateReading = 1.0;

const D1 = Math.round((DEMO_RAW.reading[1] - DEMO_RAW.reading[0]) / rateReading); // 60f
const D2 = DEMO_RAW.advance[1] - DEMO_RAW.advance[0]; // 60f
const PULSE = 15; // D2의 마지막 0.5s는 정지 없이 펄스만 강조(reel2와 동일한 이유로 프리즈 트릭은 피함)
const DEMO_LEN = D1 + D2; // 120f

const CTA_LEN = 90; // 3.0s — 자막 텍스트 길이(1줄/2줄)에 따라 CTA 카드가 다 뜬 뒤 남는 정지 시간이 제각각으로 느껴진다는 피드백으로, 모든 릴스에서 균일하게 늘림(2.0s→3.0s)

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
  fadeInFrames?: number;
  fadeOutFrames?: number;
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
  fade = true,
  fadeInFrames = 4,
  fadeOutFrames = 4,
}) => {
  const frame = useCurrentFrame();
  const fadeIn =
    fade && fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  const fadeOut =
    fade && fadeOutFrames > 0
      ? interpolate(frame, [len - fadeOutFrames - 1, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
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
  const tapFrom = b1From + HB1;
  const b2From = tapFrom + HBTAP;
  const b3From = b2From + HB2;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={b1From} durationInFrames={HB1} name="cooking">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.cooking[0]} rawTo={HOOK_RAW.cooking[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} />
      </Sequence>
      <Sequence from={tapFrom} durationInFrames={HBTAP} name="tap">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.tap[0]} rawTo={HOOK_RAW.tap[1]} rate={1} len={HBTAP} width={1080} height={1920} left={0} fade={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="reach">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.reach[0]} rawTo={HOOK_RAW.reach[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} />
      </Sequence>
      <Sequence from={b3From} durationInFrames={HB3} name="settle">
        {/* 훅 끝(다시 조리로 돌아가는 순간)에서 데모로 하드컷되면 "뚝 끊기는" 느낌이 든다는 피드백
            (08편에서 확인) — 끝만 0.8초(24f) 동안 천천히 흰 화면으로 페이드아웃. */}
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.settle[0]} rawTo={HOOK_RAW.settle[1]} rate={1} len={HB3} width={1080} height={1920} left={0} fade={true} fadeInFrames={0} fadeOutFrames={24} />
      </Sequence>

      <Caption from={b1From} len={HB1} text={"요리할 땐 손에 뭐가\n많이 묻어있는데"} />
      <Caption from={tapFrom} len={HBTAP + HB2 + HB3} text={"블로그 보면서 손으로\n순서 따라가기 힘들잖아요"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 880x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 880;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 100
// 화면 맨 위 상태표시줄(녹화 표시 등)을 가리기 위해, 아래를 기준점 삼아 살짝 확대해서 위쪽만 크롭한다.
const TOP_CROP_ZOOM = 1.08;
const TOP_CROP_ORIGIN_X = 50;
const TOP_CROP_ORIGIN_Y = 100;

// 우측 상단 "멈추기"/"1×" 버튼이 있는 지점(880x1920 기준 픽셀 좌표) — 프레임을 직접 뽑아서
// 두 버튼을 감싸는 영역(x:520~850, y:870~955)의 중심을 확인해서 잡았다.
// scale()에 transform-origin만 주는 방식은 그 점을 화면 중앙으로 "옮겨"주는 게 아니라 그 점을
// 원래 있던 화면상 위치에 고정한 채로 나머지가 그 주위로 늘어나는 방식이라(원점이 오른쪽으로
// 치우쳐 있으면 확대 시 왼쪽만 잔뜩 보이고 오른쪽은 금방 프레임 밖으로 밀려남), 버튼이 화면
// 가장자리에 가까운 이 경우엔 버튼이 잘려 보이는 문제가 있었음 — translate+scale 조합으로
// "그 지점을 화면 중앙으로 이동시키면서 확대"하는 표준 팬앤줌 공식으로 교체.
const BUTTON_ZOOM = 2.3;
const BUTTON_CENTER_X = 685;
const BUTTON_CENTER_Y = 912;
const ZOOM_HOLD = 15; // 0.5s — 조리 순서 전체가 보이는 화면을 먼저 보여준 뒤
const ZOOM_ANIM = 20; // 이후 0.67s 동안 버튼 쪽으로 확대 이동

// translate+scale(origin 0 0) 조합으로 "원본 좌표의 anchor 지점이 화면의 target 지점에 오도록"
// 이동·확대하는 일반식: translate(targetX - anchorX*z, targetY - anchorY*z) scale(z).
// 시작 상태는 anchor=target=하단 중앙(기존 TOP_CROP 방식과 동일 — 그 점이 화면에서 안 움직임),
// 끝 상태는 anchor=버튼 중심, target=화면 중앙(그 점을 화면 가운데로 이동)으로 각각 계산한 뒤
// translate 값 자체를 보간해서, 시작 프레임이 기존 크롭과 완전히 같게 나오도록 보장한다.
const zoomTranslate = (anchorX: number, anchorY: number, targetX: number, targetY: number, z: number) => ({
  tx: targetX - anchorX * z,
  ty: targetY - anchorY * z,
});
const START = zoomTranslate(VIDEO_W / 2, VIDEO_H, VIDEO_W / 2, VIDEO_H, TOP_CROP_ZOOM);
const END = zoomTranslate(BUTTON_CENTER_X, BUTTON_CENTER_Y, VIDEO_W / 2, VIDEO_H / 2, BUTTON_ZOOM);

// "손 안 대도 돼요" 비트 전용 — 처음엔 조리 순서 전체가 보이는 화면(TOP_CROP_ZOOM, 하단 중앙
// 기준 크롭)으로 시작해서, 잠시 후 "멈추기"·"1×" 버튼이 화면 중앙에 오도록 확대 이동되어 그대로
// 유지된다.
const ReadingZoom: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [len - 5, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t = interpolate(frame, [ZOOM_HOLD, ZOOM_HOLD + ZOOM_ANIM], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const zoom = interpolate(t, [0, 1], [TOP_CROP_ZOOM, BUTTON_ZOOM]);
  const tx = interpolate(t, [0, 1], [START.tx, END.tx]);
  const ty = interpolate(t, [0, 1], [START.ty, END.ty]);
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
        src={staticFile(DEMO_VIDEO)}
        trimBefore={DEMO_RAW.reading[0]}
        trimAfter={DEMO_RAW.reading[1]}
        playbackRate={rateReading}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      />
    </div>
  );
};

// 음성이 실제로 재생 중이라는 걸 알려주는 인디케이터 — 자막 바로 위에 작은 이퀄라이저 바를 얹어
// 계속 오르내리게 한다("정지 화면인데 음성이 나오는 건지 알기 힘들다"는 피드백 반영).
const VoiceWave: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = [0, 1, 2, 3, 4];
  return (
    <div style={{ position: "absolute", top: CAPTION_TOP - 78, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          backgroundColor: "rgba(17,17,19,0.88)",
          borderRadius: 999,
          padding: "12px 20px",
        }}
      >
        {bars.map((i) => {
          const h = 7 + Math.abs(Math.sin((frame + i * 6) / 4.2)) * 24;
          return <div key={i} style={{ width: 6, height: h, borderRadius: 3, backgroundColor: "#FFD600" }} />;
        })}
      </div>
    </div>
  );
};

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
          <ReadingZoom len={D1} />
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
            origin={`${TOP_CROP_ORIGIN_X}% ${TOP_CROP_ORIGIN_Y}%`}
          />
        </Sequence>
      </div>

      <VoiceWave />
      <Caption from={d1From} len={D1} text={"손 안 대도 돼요\n요리 끝날 때까지 읽어드려요"} />
      <Caption from={d2From} len={D2} text={"이제 손으론 요리하고\n레시피는 귀로 들으세요"} />
    </AbsoluteFill>
  );
};
