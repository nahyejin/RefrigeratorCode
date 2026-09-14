import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10.0s, 720x1280, 24fps, 대사 포함) — 부부가 나란히 배달앱 결제내역을
// 스크롤하다 아내가 "헐, 이번 달에 배달비가 벌써 이만큼이야?"를 말하며 둘 다 눈이 커지고, 서로 마주
// 보며 한숨까지 한 컷으로 이어짐. silencedetect로 실측한 결과 대사는 3.1~6.3s, 짧은 리액션이
// 6.8~7.9s, 마지막 한숨이 8.9s 근처까지 — storyboard 지시대로 하드컷 없이 파일 전체를 한 테이크로
// 그대로 사용(오디오도 무음 처리 안 함).
const HOOK_VIDEO = "reel8_hook_gemini.mp4";
const HOOK_RAW = {
  line: [0, 299], // 0:00–9.97 부부가 배달비 확인하고 놀라는 리액션 + 한숨까지 파일 끝까지 이어지는 한 컷
};
const HOOK_LEN = HOOK_RAW.line[1] - HOOK_RAW.line[0]; // 299f

// 데모: 실제 쿡매치 요리 캘린더 화면 녹화본(42.7s, 880x1920, 30fps) — 이번 달 요리 목표를
// 10회→15회로 직접 수정하는 장면(목표 설정) → 수정된 달성률·절약 예상액이 바뀌는 장면(절약액 확인)
// → 월간/주간 캘린더에 아빠·엄마 색으로 구분된 기록 → "우리 식구 요리" 탭에서 가족이 각각 만든
// 요리를 날짜별로 확인하는 장면까지 이어지는 4비트로 구성.
// 사용자가 "가족과 즐겨찾기한 요리를 공유하고 기록을 나누는" 자막을 요청하면서 실제 화면에 월간·
// 주간 캘린더가 있는지 물어봐서, 프레임 단위로 재확인한 결과 원래 2비트 플랜(목표 설정→절약액 확인)
// 뒤에 캘린더·가족기록 내용이 더 있는 것을 확인 — 3번째 비트로 추가.
const DEMO_VIDEO = "reel8_family_demo.mp4";

// 데모 화면 최상단에 화면 녹화 표시(빨간 점 + 검은 알약 배지)가 찍혀 있어서 위쪽 180px을
// 크롭해서 뺀다(Reel4/5/6/7과 동일한 patturn — 스케일 없이 position만 이동해서 가로폭·비율을
// 전혀 안 건드리고, 잘려나간 만큼 위아래에 똑같이 여백을 남긴다).
const TOPCROP_PX = 180;

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  goalSet: [210, 306], // 0:07.0–10.2 "목표수정" 탭 → 10회를 지우고 15회로 새로 입력
  savingsCheck: [306, 408], // 0:10.2–13.6 적용 직후 "15회 달성 47%" · "목표까지 약 360,000원"으로 바뀐 결과
  familyCal: [420, 504], // 0:14.0–16.8 월간 캘린더 — 날짜별 아빠(주황)·엄마(파랑) 색 점으로 구분된 기록
  familyShare: [642, 738], // 0:21.4–24.6 "우리 식구 요리" 탭 — 식구들 것만 필터링해 날짜·시간과 함께 보기
};
const rateDemo = 1;

const GOAL_LEN = DEMO_RAW.goalSet[1] - DEMO_RAW.goalSet[0]; // 96f
// 확대 배율(1.35)까지 키워봐도 영상 위 CSS 확대라 화질이 흐려 보인다는 피드백 — 라이브 영상
// 재생 대신, 정착된 순간의 프레임을 사진으로 뽑아 텍스트만 선명하게 크게 보여주는 정지 컷으로
// 교체(SavingsFreeze). 자막이 타이핑되는 동안 포함해 2.0초 유지.
const SAVE_LEN = 60; // 2.0s (정지 컷 고정 길이 — 더 이상 raw 트림 길이와 무관)
const CAL_LEN = DEMO_RAW.familyCal[1] - DEMO_RAW.familyCal[0]; // 84f
const SHARE_LEN = DEMO_RAW.familyShare[1] - DEMO_RAW.familyShare[0]; // 96f
const PULSE = 15; // 마지막 비트(가족 기록) 뒷부분 확대 펄스(페이오프로 넘어가기 전 강조)

const DEMO_LEN = GOAL_LEN + SAVE_LEN + CAL_LEN + SHARE_LEN;

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL8_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel8FamilySavings: React.FC = () => {
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
              목표부터 식단, 절약까지
              <br />
              가족과 함께 <span style={{ color: "#D99A00" }}>확인해요</span>
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
  cropTop?: number;
  fade?: boolean;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  punchZoom?: number;
  punchOrigin?: string;
  muted?: boolean;
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
  fadeInFrames = 4,
  fadeOutFrames = 4,
  punchZoom,
  punchOrigin,
  muted = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn =
    fade && fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  const fadeOut =
    fade && fadeOutFrames > 0
      ? interpolate(frame, [len - fadeOutFrames - 1, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  // 캡션이 뜨는 순간 해당 화면 영역이 확대되며 나타나는 강조 효과(펀치인) — 비트 시작 시점에
  // 스프링으로 배율을 밀어올린 뒤 그대로 유지(정적인 zoom과 달리 애니메이션으로 등장).
  const punchScale = punchZoom
    ? interpolate(spring({ frame, fps, config: { damping: 14, mass: 0.7 } }), [0, 1], [1, punchZoom])
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
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: punchScale !== 1 ? `scale(${punchScale})` : undefined,
          transformOrigin: punchZoom ? punchOrigin ?? origin : origin,
        }}
      >
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

// ---------- ③ 절약액 정지 컷 — "이번달 절약액" 결과 화면을 캡처한 사진 두 장(전체·크롭)으로 구성.
// reel8_savings_bg.png는 흐리게·어둡게 딤 처리한 배경, reel8_savings_card.png는 "이번달 절약액
// 168,000원 / 목표 15회를 다 채우면 약 360,000원" 두 줄만 타이트하게 크롭한 카드 — 이 카드를
// 화면 중앙에 큼직하게 팝인시켜서 라이브 영상 확대(CSS scale)보다 훨씬 선명하게 강조한다. ----------
const SavingsFreeze: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const cardScale = interpolate(pop, [0, 1], [0.82, 1]);
  const fadeIn = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [SAVE_LEN - 8, SAVE_LEN - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
      <Img
        src={staticFile("reel8_savings_bg.png")}
        style={{
          position: "absolute",
          top: -TOPCROP_PX / 2,
          left: 0,
          width: "100%",
          height: `calc(100% + ${TOPCROP_PX}px)`,
          objectFit: "cover",
          filter: "blur(14px) brightness(0.42)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          width: "88%",
          transform: `translate(-50%, -50%) scale(${cardScale})`,
        }}
      >
        <Img
          src={staticFile("reel8_savings_card.png")}
          style={{ width: "100%", display: "block", borderRadius: 20, boxShadow: "0 16px 40px rgba(0,0,0,0.45)" }}
        />
      </div>
    </div>
  );
};

// ---------- ①② 훅 (제미나이 생성 실사, 720x1280 — 캔버스와 같은 9:16이라 크롭 없이 꽉 참) ----------
const Hook: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HOOK_LEN} name="line">
        {/* 훅 끝(한숨 쉬는 순간)에서 데모로 바로 하드컷되면 "뚝 끊기는" 느낌이 든다는 피드백 —
            시작은 그대로 즉시(fadeInFrames=0), 끝만 0.8초(24f) 동안 천천히 흰 화면으로
            페이드아웃해서 다음 비트로 부드럽게 이어지게 함. */}
        <SubClip
          src={HOOK_VIDEO}
          rawFrom={HOOK_RAW.line[0]}
          rawTo={HOOK_RAW.line[1]}
          rate={1}
          len={HOOK_LEN}
          width={1080}
          height={1920}
          left={0}
          fade={true}
          fadeInFrames={0}
          fadeOutFrames={24}
          muted={false}
        />
      </Sequence>

      <Caption from={0} len={HOOK_LEN} text={"이번 달 배달비,\n얼마인지 볼 용기 있어요?"} />
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

  const goalFrom = 0;
  const saveFrom = goalFrom + GOAL_LEN;
  const calFrom = saveFrom + SAVE_LEN;
  const shareFrom = calFrom + CAL_LEN;
  const pulseFrom = shareFrom + SHARE_LEN - PULSE;

  // 페이오프 강조 — 마지막 비트(가족 기록) 뒷부분에서 살짝 확대 펄스(정지 없이, 실사 재생 그대로)
  const pulseLocal = frame - pulseFrom;
  const pulseScale =
    pulseLocal >= 0
      ? interpolate(spring({ frame: pulseLocal, fps, config: { damping: 10, mass: 0.6 } }), [0, 1], [1, 1.05])
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={goalFrom} durationInFrames={GOAL_LEN} name="goal-set">
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.goalSet[0]}
          rawTo={DEMO_RAW.goalSet[1]}
          rate={rateDemo}
          len={GOAL_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          cropTop={TOPCROP_PX}
          fade={false}
        />
      </Sequence>
      <Sequence from={saveFrom} durationInFrames={SAVE_LEN} name="savings-check">
        <SavingsFreeze />
      </Sequence>
      <Sequence from={calFrom} durationInFrames={CAL_LEN} name="family-calendar">
        {/* "캘린더에 기록으로 남아요" 자막이 뜨는 순간 월간 캘린더 영역이 확대되며 나타나도록
            punchZoom 적용. */}
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.familyCal[0]}
          rawTo={DEMO_RAW.familyCal[1]}
          rate={rateDemo}
          len={CAL_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          cropTop={TOPCROP_PX}
          punchZoom={1.14}
          punchOrigin="50% 45%"
        />
      </Sequence>

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: frame >= pulseFrom ? `scale(${pulseScale})` : undefined }}>
        <Sequence from={shareFrom} durationInFrames={SHARE_LEN} name="family-share">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.familyShare[0]}
            rawTo={DEMO_RAW.familyShare[1]}
            rate={rateDemo}
            len={SHARE_LEN}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            cropTop={TOPCROP_PX}
            fade={false}
          />
        </Sequence>
      </div>

      <Caption from={goalFrom} len={GOAL_LEN} text={"가족과 함께\n이번 달 요리 목표를 정해요"} />
      <Caption from={saveFrom} len={SAVE_LEN} text={"요리할 때마다\n아낀 돈이 얼마인지 바로 보여요"} />
      <Caption from={calFrom} len={CAL_LEN + SHARE_LEN} text={"가족이 언제 뭘 만들었는지\n캘린더에 기록으로 남아요"} />
    </AbsoluteFill>
  );
};
