import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(8s, 720x1280, 24fps, 대사 포함) — 마트 계산대에서 영수증이 과장되게 길게 나옴
const HOOK_VIDEO = "reel4_hook_gemini.mp4";
// 데모: 실제 쿡매치 AI 식단 추천 전체 흐름(43s, 880x1920, 30fps) — 버튼 탭부터 캘린더(월/주) 반영까지
// 재촬영본. 이전 버전(reel4_diet_demo.mp4, 쿠팡 연결까지 있던 52s짜리)은 "AI 식단 추천 버튼을 누르는
// 순간"과 "캘린더에 월별/주별로 반영된 화면"이 빠져 있어서, 그 두 가지가 포함된 새 녹화본으로 교체.
const DEMO_VIDEO = "reel4_diet_demo2.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) ----
// silencedetect로 확인한 발화 구간이 0~6.2s 사이 거의 이어져 있어서(짧은 숨쉬기 정도만 끊김),
// 문장이 잘리지 않도록 앞부분을 통으로 쓰고, 뒤쪽 무음 구간(헛웃음)만 따로 하드컷.
const HOOK_RAW = {
  shock: [0, 183], // 0:00–6.1 영수증이 길게 나오는 걸 보며 놀라서 말하는 대사 전체(끊지 않고 통짜)
  laugh: [207, 237], // 0:06.9–7.9 헛웃음 지으며 고개 젓는 순간(무음)
};
const HB1 = HOOK_RAW.shock[1] - HOOK_RAW.shock[0]; // 183f
const HB2 = HOOK_RAW.laugh[1] - HOOK_RAW.laugh[0]; // 30f
const HOOK_LEN = HB1 + HB2; // 213f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  tapButton: [0, 40], // 0:00–1.33 "이번 주 AI 식단 추천" 버튼이 눌리는 순간까지(홈 화면)
  prompt: [45, 100], // 0:01.5–3.33 AI 식단 추천 화면 진입 + "아이 먹을 것 위주로" 요청 전송
  loading: [100, 540], // 0:03.33–18.0 로딩 3단계(냉장고 보는 중 → 조건 맞는 요리 찾는 중 → 거의 다 됐어요)
  revealShopping: [570, 660], // 0:19.0–22.0 AI 답변 + "장보기 4개면 7일치가 돼요" 헤드라인
};
const ratePrompt = 1;
const rateTapButton = 1;
const rateLoading = 4.0; // 로딩 15초를 배속으로 압축
const rateRevealShopping = 1;

// 아래 세 장면(일주일 목록, 월별 캘린더, 주별 캘린더)은 전부 "화면을 멈춰서 읽는" 정지 이미지.
// 이전에 이 구간을 배속(rate<1)으로 늘리려 했더니 파일 끝 근처가 아닌데도 OffthreadVideo가 흰 화면을
// 뱉는 버그가 났어서(02·04편에서 반복 확인), 애초에 비디오 디코딩 자체가 없는 PNG 정지 이미지로 처리.
const CALENDAR_LIST_FREEZE = "reel4_calendar_freeze2.png"; // 0:23 — 9/14~9/20 목록 + "요리 캘린더에 담기" 버튼
const MONTH_VIEW_FREEZE = "reel4_month_freeze.png"; // 0:33.3 — 월별 캘린더, 9/14~9/20이 노란 점으로 표시됨
const WEEK_VIEW_FREEZE = "reel4_week_freeze.png"; // 0:39.5 — 주별 캘린더, 요일마다 만들 요리가 나열됨

const D0 = Math.round((DEMO_RAW.tapButton[1] - DEMO_RAW.tapButton[0]) / rateTapButton); // 40f
const D1 = Math.round((DEMO_RAW.prompt[1] - DEMO_RAW.prompt[0]) / ratePrompt); // 55f
const D2 = Math.round((DEMO_RAW.loading[1] - DEMO_RAW.loading[0]) / rateLoading); // 110f
const D3 = Math.round((DEMO_RAW.revealShopping[1] - DEMO_RAW.revealShopping[0]) / rateRevealShopping); // 90f
const D4 = 90; // 3.0s — 일주일 목록 정지 이미지
const D5 = 90; // 3.0s — 월별 캘린더 정지 이미지
const D6 = 120; // 4.0s — 주별 캘린더 정지 이미지
const PULSE = 15; // 마지막 정지 화면 뒷부분에서 살짝 확대 펄스로 강조
const DEMO_LEN = D0 + D1 + D2 + D3 + D4 + D5 + D6;

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

// 정지 화면(PNG) 전용 — 비디오 디코딩이 없어 분수 배속 버그를 원천적으로 피한다.
const FreezeImg: React.FC<{ src: string; width: number; height: number; left: number; zoom?: number; origin?: string }> = ({
  src,
  width,
  height,
  left,
  zoom = 1,
  origin = "center",
}) => (
  <div style={{ position: "absolute", top: 0, left, width, height, overflow: "hidden", border: `1px solid ${LINE}` }}>
    <Img
      src={staticFile(src)}
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

  // 순서 재배치: "AI가 재료+요청사항 반영해서 효율적으로 일주일 식단을 짠다" → "그게 캘린더에 그대로
  // 반영된다"는 원인이 "그래서 장보기도 최소화된다"는 결과보다 앞에 와야 논리가 맞는다는 지적 반영 —
  // 캘린더 반영 3화면(목록·월별·주별)을 먼저 보여주고, "장보기 4개" 리빌은 맨 뒤로 옮김.
  const d0From = 0;
  const d1From = d0From + D0;
  const d2From = d1From + D1;
  const d3From = d2From + D2; // 캘린더 목록(구 4번)
  const d4From = d3From + D4; // 월별 캘린더(구 5번)
  const d5From = d4From + D5; // 주별 캘린더(구 6번)
  const d6From = d5From + D6; // 장보기 리빌(구 3번) — 이제 마지막
  const holdFrom = d6From + D3 - PULSE;

  // 페이오프 강조 — "장보기 4개" 리빌 뒷부분에서 살짝 확대 펄스(정지 없이, 실사 재생 그대로)
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
        <Sequence from={d0From} durationInFrames={D0} name="tap-button">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.tapButton[0]} rawTo={DEMO_RAW.tapButton[1]} rate={rateTapButton} len={D0} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} fade={false} />
        </Sequence>
        <Sequence from={d1From} durationInFrames={D1} name="prompt">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.prompt[0]} rawTo={DEMO_RAW.prompt[1]} rate={ratePrompt} len={D1} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
        </Sequence>
        <Sequence from={d2From} durationInFrames={D2} name="loading">
          <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.loading[0]} rawTo={DEMO_RAW.loading[1]} rate={rateLoading} len={D2} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
        </Sequence>
        <Sequence from={d3From} durationInFrames={D4} name="calendar-list-freeze">
          <FreezeImg src={CALENDAR_LIST_FREEZE} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} zoom={1.1} origin="50% 55%" />
        </Sequence>
        <Sequence from={d4From} durationInFrames={D5} name="month-view-freeze">
          <FreezeImg src={MONTH_VIEW_FREEZE} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} zoom={1.15} origin="50% 45%" />
        </Sequence>
        <Sequence from={d5From} durationInFrames={D6} name="week-view-freeze">
          <FreezeImg src={WEEK_VIEW_FREEZE} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} zoom={1.1} origin="50% 55%" />
        </Sequence>
        <Sequence from={d6From} durationInFrames={D3} name="reveal-shopping">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.revealShopping[0]}
            rawTo={DEMO_RAW.revealShopping[1]}
            rate={rateRevealShopping}
            len={D3}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={1.1}
            origin="50% 55%"
            fade={false}
          />
        </Sequence>
      </div>

      <Caption from={d0From} len={D0 + D1 + D2} text={"원하는 요구사항만 말하면\n있는 재료로 효율적인 일주일 식단을 짜요"} />
      <Caption from={d3From} len={D4} text={"그렇게 짠 일주일 식단이\n그대로 캘린더에 담겨요"} />
      <Caption from={d6From} len={D3} text={"냉장고에 있는 재료로 최대한 채웠으니\n장보기는 이제 최소한이면 돼요"} />
    </AbsoluteFill>
  );
};
