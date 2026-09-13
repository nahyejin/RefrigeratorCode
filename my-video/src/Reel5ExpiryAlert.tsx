import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(8.93s, 720x1280, 24fps, 대사 포함) — 냉장고 뒤적이다 물러진 채소를 꺼내 보며
// "아, 이것도 결국 못 먹고 버리네..." 혼잣말 후 쓰레기통 쪽으로 돌아서는 리액션
const HOOK_VIDEO = "reel5_hook_gemini.mov";
// 데모: 실제 쿡매치 유통기한 알림 흐름(56s, 884x1920, 30fps) — 푸시 알림 → 유통기한 자동계산 → 임박재료 레시피 추천
const DEMO_VIDEO = "reel5_expiry_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) ----
// silencedetect로 실측한 결과 진짜 대사("아, 이것도 결국 못 먹고 버리네...")는 2.65~4.87s 구간에서만
// 들린다(그 앞 0.46~2.03s의 소리는 대사가 아닌 다른 잡음). 대사 뒤 멍하니 있는 정적 구간(5~7.5s)은
// 하드컷으로 건너뛰고, 쓰레기통 쪽으로 돌아서는 리액션(7.5~8.8s)으로 바로 이어붙인다.
const HOOK_RAW = {
  line: [0, 147], // 0:00–4.9 냉장고 뒤적여 채소 꺼내 보며 대사
  turn: [225, 264], // 0:07.5–8.8 한숨 쉬고 쓰레기통 쪽으로 돌아서는 리액션(무음)
};
const HB1 = HOOK_RAW.line[1] - HOOK_RAW.line[0]; // 147f
const HB2 = HOOK_RAW.turn[1] - HOOK_RAW.turn[0]; // 39f
const HOOK_LEN = HB1 + HB2; // 186f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  addSpinach: [1179, 1395], // 0:39.3–46.5 "시금치" 입력 → 보관공간·유통기한 모름 선택 → 구매시점 선택 → 확인
  recipe: [381, 495], // 0:12.7–16.5 냉장고요리, 임박순 필터 켠 상태로 복숭아 우유 100% 매칭 카드
};
const rateAddSpinach = 2.5; // 입력~확인까지 여러 스텝이라 배속 압축(1보다 큰 배속은 OffthreadVideo 흰 화면 버그와 무관 — 안전)
const rateRecipe = 1;

const ADD_LEN = Math.round((DEMO_RAW.addSpinach[1] - DEMO_RAW.addSpinach[0]) / rateAddSpinach); // 86f
const SPINACH_HOLD = 45; // 1.5s — "시금치 약 D-7" 등록 직후 확대 강조(사용자 피드백: 화면이 작아서 눈에 안 띔)
const ALERT_LEN = 75; // 2.5s — 잠금화면 알림 정지 이미지(다른 개인 알림·배경사진은 블러 처리)
const RECIPE_LEN = Math.round((DEMO_RAW.recipe[1] - DEMO_RAW.recipe[0]) / rateRecipe); // 114f
const PULSE = 15; // 레시피 카드 뒷부분 확대 펄스(페이오프)

const DEMO_LEN = ALERT_LEN + ADD_LEN + SPINACH_HOLD + RECIPE_LEN;

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL5_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel5ExpiryAlert: React.FC = () => {
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
              버리기 전에, <span style={{ color: "#D99A00" }}>있는 재료부터 요리하세요</span>
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
  const b2From = HB1;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HB1} name="line">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.line[0]} rawTo={HOOK_RAW.line[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} muted={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="turn">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.turn[0]} rawTo={HOOK_RAW.turn[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} />
      </Sequence>

      <Caption from={0} len={HOOK_LEN} text={"사놓고 유통기한 놓쳐서,\n결국 버린 적 있죠?"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 884x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 884;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 98

// 잠금화면 알림 정지 이미지 — 원본에 쿡매치 알림 말고도 다른 개인 알림(실명·채용정보·금융앱 등)과
// 배경사진이 같이 찍혀 있어서, ffmpeg로 미리 블러를 구워 넣은 배경(reel5_notif_full.png, gblur=18)
// 위에 쿡매치 알림 카드만 선명하게 얹는다. 블러를 렌더 시점 CSS가 아니라 에셋 자체에 미리 적용한
// 이유: 저장소(git)에는 블러된 결과물만 올라가야 하고, 원본 미블러 프레임은 커밋하지 않기 위함.
const AlertFreeze: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 4, len - 5, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pop = interpolate(spring({ frame, fps, config: { damping: 14, mass: 0.6 } }), [0, 1], [0.94, 1]);
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: VIDEO_H, overflow: "hidden", border: `1px solid ${LINE}`, opacity }}>
      <Img src={staticFile("reel5_notif_full.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${pop})`, width: "84%" }}>
        <Img
          src={staticFile("reel5_notif_card.png")}
          style={{ width: "100%", borderRadius: 26, boxShadow: "0 24px 60px rgba(0,0,0,0.4)", display: "block" }}
        />
      </div>
    </div>
  );
};

// 유통기한 자동계산 리빌 — 새로 등록된 "시금치 약 D-7" 알약이 목록 속에 묻혀 눈에 안 띈다는 피드백으로,
// 등록 직후 정지 화면을 그 위치로 확대해서 명확히 보여준다.
const SPINACH_ORIGIN = "66% 70%"; // 목록에서 "시금치 약 D-7" 알약이 위치한 지점
const SpinachReveal: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 4, len - 5, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(spring({ frame, fps, config: { damping: 13, mass: 0.7 } }), [0, 1], [1, 1.8]);
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: VIDEO_H, overflow: "hidden", border: `1px solid ${LINE}`, opacity }}>
      <Img
        src={staticFile("reel5_spinach_freeze.png")}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, transformOrigin: SPINACH_ORIGIN }}
      />
    </div>
  );
};

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const alertFrom = 0;
  const addFrom = alertFrom + ALERT_LEN;
  const spinachHoldFrom = addFrom + ADD_LEN;
  const recipeFrom = spinachHoldFrom + SPINACH_HOLD;
  const pulseFrom = recipeFrom + RECIPE_LEN - PULSE;

  // 페이오프 강조 — 레시피 카드 리빌 뒷부분에서 살짝 확대 펄스(정지 없이, 실사 재생 그대로)
  const pulseLocal = frame - pulseFrom;
  const pulseScale =
    pulseLocal >= 0
      ? interpolate(spring({ frame: pulseLocal, fps, config: { damping: 10, mass: 0.6 } }), [0, 1], [1, 1.05])
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={alertFrom} durationInFrames={ALERT_LEN} name="alert">
        <AlertFreeze len={ALERT_LEN} />
      </Sequence>

      <Sequence from={addFrom} durationInFrames={ADD_LEN} name="add-spinach">
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.addSpinach[0]}
          rawTo={DEMO_RAW.addSpinach[1]}
          rate={rateAddSpinach}
          len={ADD_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
        />
      </Sequence>

      <Sequence from={spinachHoldFrom} durationInFrames={SPINACH_HOLD} name="spinach-reveal">
        <SpinachReveal len={SPINACH_HOLD} />
      </Sequence>

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: frame >= pulseFrom ? `scale(${pulseScale})` : undefined }}>
        <Sequence from={recipeFrom} durationInFrames={RECIPE_LEN} name="recipe">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.recipe[0]}
            rawTo={DEMO_RAW.recipe[1]}
            rate={rateRecipe}
            len={RECIPE_LEN}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={1.15}
            origin="50% 42%"
            fade={false}
          />
        </Sequence>
      </div>

      <Caption from={alertFrom} len={ALERT_LEN} text={"앱을 안 켜도\n유통기한 임박하면 알려드려요"} />
      <Caption from={addFrom} len={ADD_LEN + SPINACH_HOLD} text={"유통기한도 직접 안 적어도\n자동으로 계산해드려요"} />
      <Caption from={recipeFrom} len={RECIPE_LEN} text={"임박한 재료 순으로\n바로 레시피까지 추천해드려요"} />
    </AbsoluteFill>
  );
};
