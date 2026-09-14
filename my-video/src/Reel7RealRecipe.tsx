import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(9.45s, 720x1280, 24fps, 대사 포함) — 집밥을 먹으며 "분명 레시피대로
// 했는데... 이 레시피도 요리 초보가 쓴 거 아니야?"를 망설이듯(자연스러운 끊어 말하기 포함) 혼잣말
// 하고, 대사 직후 접시를 다시 만지는 리액션까지 한 컷에 이어짐.
// 사용자가 "제미나이 영상을 잘못 줬었다"며 같은 대사의 정정본으로 교체(직전 20s 버전은 실수로 보낸
// 파일이었음). silencedetect로 실측한 결과 이번에도 대사가 두 번의 짧은 끊김(1.7~2.1s, 2.33~4.03s,
// 5.68~7.27s)을 두고 망설이듯 이어짐 — 자연스러운 호흡이라 그대로 통째로 살리고, 파일 끝(9.45s)까지
// 이어지는 리액션도 같은 컷 안에서 하드컷 없이 그대로 사용.
const HOOK_VIDEO = "reel7_hook_gemini.mov";
const HOOK_RAW = {
  line: [0, 283], // 0:00–9.43 밥 먹으며 망설이듯 대사 + 파일 끝까지 이어지는 리액션
};
const HB1 = HOOK_RAW.line[1] - HOOK_RAW.line[0]; // 283f
const HOOK_LEN = HB1; // 283f
// 화면 왼쪽 아래에 촬영용 트라이포드가 계속 걸려 나와서(제미나이 생성 특유의 배경 소품 오류로 보임),
// 살짝 확대해 크롭해서 프레임 밖으로 뺀다.
const HOOK_ZOOM = 1.35;
const HOOK_ORIGIN = "72% 38%";

// 데모: 실제 쿡매치 냉장고요리 흐름(23.6s, 880x1920, 30fps) — 로딩(레시피 수만 건) → 인기순 정렬 →
// 레시피 상세 → 원문(실제 유튜브 영상)까지 연결
const DEMO_VIDEO = "reel7_recipe_demo.mp4";
// 스플래시: 실제 쿡매치 앱 시작 화면 녹화본(원본 1.0s, 1206x2622, 60fps) — "누적 레시피 수"가
// 0부터 빠르게 올라가는 카운터 애니메이션. 숫자는 앞으로도 계속 늘어날 값이라 특정 숫자에서 멈춘
// 것처럼 보이면 안 되므로, 애니메이션이 끝나기 전(파일 자체가 카운트 도중에 끝남) 구간을 그대로 써서
// "계속 올라가는 중"인 느낌을 유지.
// 원본 그대로(1.0s) 쓰니 "너무 빨리 넘어간다"는 지적으로 ffmpeg `setpts`로 재생 타임라인을 늘렸는데
// (Remotion의 `playbackRate`로 늦추면 분수 배속 흰 화면 버그를 다시 밟을 위험이 있어서, 소스 파일
// 자체를 미리 늘려두고 Remotion에는 항상 rate=1로만 재생), 처음 시도(원본 전체 1.0s를 2.3배)는
// 오히려 "0에서 너무 오래 멈춰있다"는 재지적을 받음 — 확인해보니 원본 자체가 처음 0.5초 가량은
// "0"에 멈춰있다가 나머지 0.5초에 몰아서 카운트하는 구조라, 늘리기 전에 그 정지 구간(0~0.45s)부터
// 먼저 잘라내고 실제로 숫자가 움직이는 구간(0.45~1.0s, 0.55s)만 남긴 뒤 4배 늘림(0.55s→2.15s) —
// 이러면 늘어난 시간 전체가 "실제로 올라가는 중"인 구간이 되어 정지처럼 보이는 구간이 없어진다.
// 그래도 "조금 더 빨리 넘어가도 될 것 같다"는 피드백으로 배율을 4.0배→2.8배로 낮춤(0.55s→1.52s).
const SPLASH_VIDEO = "reel7_splash.mp4";
const SPLASH_LEN = 46; // 1.52s — 정지 구간을 뺀 뒤 2.8배로 늘린 파일 전체(카운터가 계속 올라가는 채로 끝남)

// 데모·스플래시 화면 전부 최상단에 화면 녹화 표시(빨간 점 + 검은 알약 배지)가 찍혀 있어서 위쪽
// 180px을 크롭해서 뺀다. 처음엔 CSS scale()로 확대-크롭했더니 가로 폭까지 같이 늘어나 양옆이
// 잘렸고, scaleY로 바꿨더니 이번엔 세로만 늘어나서 화면이 찌그러 보이는 문제가 있었음(둘 다 지적) —
// 최종적으로 스케일을 아예 쓰지 않고, 콘텐츠를 위로 cropTop만큼 밀어 올리는 position 이동 방식으로
// 교체. 비율·가로폭 전혀 안 건드리고, 밀려난 만큼 아래쪽에 남는 여백은 흰 캔버스 배경과 자연스럽게
// 섞인다.
const TOPCROP_PX = 180;

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
// 컨티 원안은 "정렬 드롭다운 조작"만 계획했지만, 실촬영본에 더 설득력 있는 소재(로딩 화면에 실제로
// "레시피 4만여 개" 문구가 뜨는 순간 + 레시피 상세 화면 + 실제 유튜브 원본으로 연결되는 장면)가 있어서
// 그걸 살리는 4비트로 재구성. 사용자 피드백으로 "수만 건 엄선" 비트를 맨 앞으로 재배치(신뢰도 있는 다른
// 비트들보다 이 임팩트 있는 숫자를 먼저 보여주는 게 설득력 있다는 판단), 그 앞에 스플래시 화면도 추가.
const DEMO_RAW = {
  claim40k: [18, 84], // 0:00.6–2.8 로딩 카드에 "레시피 4만여 개를 하나씩 맞춰 보는 중" 문구
  popularSort: [165, 270], // 0:05.5–9.0 정렬 드롭다운(인기순 선택 표시) + 댓글 1237개인 인기 카드
  detail: [519, 624], // 0:17.3–20.8 레시피 상세(재료·조리순서 단계별 정리)
  sourceProof: [624, 707], // 0:20.8–23.57(끝) "원문에서 자세히 보기" 탭 → 실제 유튜브 영상(좋아요·조회수)
};
const rateDemo = 1;

const CLAIM_LEN = DEMO_RAW.claim40k[1] - DEMO_RAW.claim40k[0]; // 66f
const SORT_LEN = DEMO_RAW.popularSort[1] - DEMO_RAW.popularSort[0]; // 105f
const DETAIL_LEN = DEMO_RAW.detail[1] - DEMO_RAW.detail[0]; // 105f
const PROOF_LEN = DEMO_RAW.sourceProof[1] - DEMO_RAW.sourceProof[0]; // 83f
const PULSE = 15; // 원본 연결 화면 뒷부분 확대 펄스(페이오프)
// 유튜브 원본 화면 하단(채널명·구독자·좋아요 등 채널 정보 영역)은 특정 크리에이터를 과하게 특정해서
// 노출하지 않도록 블러 처리 — "진짜 영상으로 연결된다"는 사실 자체는 보이되 채널 세부정보는 가림.
const PROOF_BLUR_TOP = 1440; // 원본 영상 좌표 기준(크롭 전) — 영상 썸네일이 끝나고 채널 정보가 시작되는 지점
const PROOF_BLUR_HEIGHT = 1920 - PROOF_BLUR_TOP;
// 상단 크롭이 중앙 정렬(위아래 TOPCROP_PX/2씩 여백)이라, 블러 창의 화면상 위치도 그만큼만
// 당겨줘야 아래쪽 SubClip과 어긋나지 않는다.
const PROOF_BLUR_TOP_DISPLAY = PROOF_BLUR_TOP - TOPCROP_PX / 2;

const DEMO_LEN = SPLASH_LEN + CLAIM_LEN + SORT_LEN + DETAIL_LEN + PROOF_LEN;

const CTA_LEN = 90; // 3.0s — 자막 텍스트 길이(1줄/2줄)에 따라 CTA 카드가 다 뜬 뒤 남는 정지 시간이 제각각으로 느껴진다는 피드백으로, 모든 릴스에서 균일하게 늘림(2.0s→3.0s)

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL7_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel7RealRecipe: React.FC = () => {
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
              유튜브·네이버 상위 채널만 모았으니,
              <br />
              뭘 골라도 <span style={{ color: "#D99A00" }}>맛집이에요</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// 서브클립 공용 — 원본 특정 구간을 트리밍해서 보여준다(다른 릴스와 동일 패턴, 파일마다 로컬 정의).
// zoom/origin은 장면별 강조용 확대(바깥 래퍼에 적용), cropTop은 화면 상단 상태바를 잘라내는 고정
// 크롭(스케일 없이 position만 이동) — 둘을 분리해서 동시에 겹쳐 쓸 수 있게 한다.
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
  muted = true,
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
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          transformOrigin: origin,
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

// ---------- ①② 훅 (제미나이 생성 실사, 720x1280 — 캔버스와 같은 9:16이라 크롭 없이 꽉 참) ----------
const Hook: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HB1} name="line">
        {/* 훅 끝에서 데모로 하드컷되면 "뚝 끊기는" 느낌이 든다는 피드백(08편에서 확인) — 끝만
            0.8초(24f) 동안 천천히 흰 화면으로 페이드아웃. */}
        <SubClip
          src={HOOK_VIDEO}
          rawFrom={HOOK_RAW.line[0]}
          rawTo={HOOK_RAW.line[1]}
          rate={1}
          len={HB1}
          width={1080}
          height={1920}
          left={0}
          fade={true}
          fadeInFrames={0}
          fadeOutFrames={24}
          muted={false}
          zoom={HOOK_ZOOM}
          origin={HOOK_ORIGIN}
        />
      </Sequence>

      <Caption from={0} len={HOOK_LEN} text={"레시피 따라했는데,\n왜 제 것만 이상하죠?"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 880x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 880;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 100

// 유튜브 원본 화면 하단(채널 정보 영역)을 블러 처리 — 같은 구간을 한 번 더 그려서 블러만 입힌 걸
// 위에 겹치는 방식(비디오 두 개가 같은 트림·배속이라 프레임이 항상 동기화됨).
const ProofBottomBlur: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: PROOF_BLUR_TOP_DISPLAY,
      left: VIDEO_LEFT,
      width: VIDEO_W,
      height: PROOF_BLUR_HEIGHT,
      overflow: "hidden",
      filter: "blur(22px)",
    }}
  >
    {/* 원본(크롭 전) 좌표 기준으로 y=PROOF_BLUR_TOP 지점을 이 창의 맨 위(local y=0)에 맞춘다 —
        비디오를 원본 크기(VIDEO_H) 그대로, 스케일 없이 위로만 밀어서 위치만 맞춘다. */}
    <div style={{ position: "absolute", top: -PROOF_BLUR_TOP, left: 0, width: "100%", height: VIDEO_H }}>
      <OffthreadVideo
        src={staticFile(DEMO_VIDEO)}
        trimBefore={DEMO_RAW.sourceProof[0]}
        trimAfter={DEMO_RAW.sourceProof[1]}
        playbackRate={rateDemo}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  </div>
);

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const splashFrom = 0;
  const claimFrom = splashFrom + SPLASH_LEN;
  const sortFrom = claimFrom + CLAIM_LEN;
  const detailFrom = sortFrom + SORT_LEN;
  const proofFrom = detailFrom + DETAIL_LEN;
  const pulseFrom = proofFrom + PROOF_LEN - PULSE;

  // 페이오프 강조 — 원본(유튜브) 연결 화면 뒷부분에서 살짝 확대 펄스(정지 없이, 실사 재생 그대로)
  const pulseLocal = frame - pulseFrom;
  const pulseScale =
    pulseLocal >= 0
      ? interpolate(spring({ frame: pulseLocal, fps, config: { damping: 10, mass: 0.6 } }), [0, 1], [1, 1.05])
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={splashFrom} durationInFrames={SPLASH_LEN} name="splash">
        <SubClip
          src={SPLASH_VIDEO}
          rawFrom={0}
          rawTo={SPLASH_LEN}
          rate={rateDemo}
          len={SPLASH_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          cropTop={TOPCROP_PX}
          fade={false}
        />
      </Sequence>
      <Sequence from={claimFrom} durationInFrames={CLAIM_LEN} name="claim-40k">
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.claim40k[0]}
          rawTo={DEMO_RAW.claim40k[1]}
          rate={rateDemo}
          len={CLAIM_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          zoom={1.1}
          origin="50% 42%"
          cropTop={TOPCROP_PX}
          fade={false}
        />
      </Sequence>
      <Sequence from={sortFrom} durationInFrames={SORT_LEN} name="popular-sort">
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.popularSort[0]}
          rawTo={DEMO_RAW.popularSort[1]}
          rate={rateDemo}
          len={SORT_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          cropTop={TOPCROP_PX}
        />
      </Sequence>
      <Sequence from={detailFrom} durationInFrames={DETAIL_LEN} name="detail">
        <SubClip
          src={DEMO_VIDEO}
          rawFrom={DEMO_RAW.detail[0]}
          rawTo={DEMO_RAW.detail[1]}
          rate={rateDemo}
          len={DETAIL_LEN}
          width={VIDEO_W}
          height={VIDEO_H}
          left={VIDEO_LEFT}
          cropTop={TOPCROP_PX}
        />
      </Sequence>

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: frame >= pulseFrom ? `scale(${pulseScale})` : undefined }}>
        <Sequence from={proofFrom} durationInFrames={PROOF_LEN} name="source-proof">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.sourceProof[0]}
            rawTo={DEMO_RAW.sourceProof[1]}
            rate={rateDemo}
            len={PROOF_LEN}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            cropTop={TOPCROP_PX}
            fade={false}
          />
          <ProofBottomBlur />
        </Sequence>
      </div>

      {/* 스플래시 구간엔 캡션을 안 얹음 — 앱 자체 문구("검증된 레시피를 매일 수집하고 있어요")가
          같은 자리(화면 하단)에 있어서 우리 캡션 박스가 겹쳐 가리는 문제가 있었음. 늘어난 스플래시
          길이(2.3s) 동안 앱 자체 문구를 그대로 읽게 하고, 캡션은 다음 비트(로딩 카드)로 넘어가면서
          시작. */}
      <Caption from={claimFrom} len={CLAIM_LEN} text={"유튜브·네이버 상위 채널만\n매일 밤 엄선한 레시피 수만 건"} />
      <Caption from={sortFrom} len={SORT_LEN} text={"좋아요·댓글·조회수까지\n반영한 인기순으로"} />
      <Caption from={detailFrom} len={DETAIL_LEN} text={"맛있는 요리의 시작은\n좋은 레시피 찾는 게 반이에요"} />
      <Caption from={proofFrom} len={PROOF_LEN} text={"출처까지 확인되는\n진짜 레시피예요"} />
    </AbsoluteFill>
  );
};
