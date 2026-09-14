import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(20s, 720x1280, 24fps, 대사 포함) — 집밥을 먹으며 "분명 레시피대로
// 했는데... 이 레시피도 요리 초보가 쓴 거 아니야?"를 망설이듯(자연스러운 끊어 말하기 포함) 혼잣말
// 하고, 말이 끝난 직후 스스로도 웃음이 나는 듯 미소 짓는 리액션까지 한 컷에 이어짐.
// 최초 버전(10s)의 "발연기"(어색한 연기) 지적으로 사용자가 같은 대사로 재생성한 버전(20s)으로 교체.
// silencedetect로 실측한 결과 이번 버전은 대사가 세 번의 짧은 끊김(2.4~3.37s, 3.67~4.8s,
// 5.12~8.34s)을 두고 이어지는데, 이건 잘못 잘린 게 아니라 망설이며 말하는 자연스러운 호흡으로 보여서
// (오히려 "발연기"를 해결하는 방향) 그대로 통째로 살림. 대사 직후(~8.3~9.5s) 미소 짓는 리액션까지
// 같은 컷 안에 있어서 별도로 하드컷할 필요 없이 한 클립으로 처리(06편에서 배운 "정지 홀드로 어설프게
// 잇지 말 것"의 연장선 — 애초에 안 끊으면 이어붙이기 문제 자체가 없다).
const HOOK_VIDEO = "reel7_hook_gemini.mp4";
const HOOK_RAW = {
  line: [0, 285], // 0:00–9.5 밥 먹으며 망설이듯 대사 + 직후 미소 리액션까지 한 컷
};
const HB1 = HOOK_RAW.line[1] - HOOK_RAW.line[0]; // 285f
const HOOK_LEN = HB1; // 285f
// 화면 왼쪽 아래에 촬영용 트라이포드가 계속 걸려 나와서(제미나이 생성 특유의 배경 소품 오류로 보임),
// 살짝 확대해 크롭해서 프레임 밖으로 뺀다.
const HOOK_ZOOM = 1.35;
const HOOK_ORIGIN = "72% 38%";

// 데모: 실제 쿡매치 냉장고요리 흐름(23.6s, 880x1920, 30fps) — 로딩(레시피 4만여개) → 인기순 정렬 →
// 레시피 상세 → 원문(실제 유튜브 영상)까지 연결
const DEMO_VIDEO = "reel7_recipe_demo.mp4";

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
// 컨티 원안은 "정렬 드롭다운 조작"만 계획했지만, 실촬영본에 더 설득력 있는 소재(로딩 화면에 실제로
// "레시피 4만여 개" 문구가 뜨는 순간 + 레시피 상세 화면 + 실제 유튜브 원본으로 연결되는 장면)가 있어서
// 그걸 살리는 4비트로 재구성. 사용자 피드백으로 "4만+ 엄선" 비트를 맨 앞으로 재배치(신뢰도 있는 다른
// 비트들보다 이 임팩트 있는 숫자를 먼저 보여주는 게 설득력 있다는 판단).
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

const DEMO_LEN = CLAIM_LEN + SORT_LEN + DETAIL_LEN + PROOF_LEN;

const CTA_LEN = 60; // 2.0s

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
              이미 검증된 레시피들만 모여있어서,
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
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HB1} name="line">
        <SubClip
          src={HOOK_VIDEO}
          rawFrom={HOOK_RAW.line[0]}
          rawTo={HOOK_RAW.line[1]}
          rate={1}
          len={HB1}
          width={1080}
          height={1920}
          left={0}
          fade={false}
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

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const claimFrom = 0;
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
      <Sequence from={claimFrom} durationInFrames={CLAIM_LEN} name="claim-40k">
        <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.claim40k[0]} rawTo={DEMO_RAW.claim40k[1]} rate={rateDemo} len={CLAIM_LEN} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} zoom={1.1} origin="50% 42%" fade={false} />
      </Sequence>
      <Sequence from={sortFrom} durationInFrames={SORT_LEN} name="popular-sort">
        <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.popularSort[0]} rawTo={DEMO_RAW.popularSort[1]} rate={rateDemo} len={SORT_LEN} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
      </Sequence>
      <Sequence from={detailFrom} durationInFrames={DETAIL_LEN} name="detail">
        <SubClip src={DEMO_VIDEO} rawFrom={DEMO_RAW.detail[0]} rawTo={DEMO_RAW.detail[1]} rate={rateDemo} len={DETAIL_LEN} width={VIDEO_W} height={VIDEO_H} left={VIDEO_LEFT} />
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
            fade={false}
          />
        </Sequence>
      </div>

      <Caption from={claimFrom} len={CLAIM_LEN} text={"매일 밤 엄선한\n진짜 맛집 레시피 4만+"} />
      <Caption from={sortFrom} len={SORT_LEN} text={"좋아요·댓글·조회수까지\n반영한 인기순으로"} />
      <Caption from={detailFrom} len={DETAIL_LEN} text={"맛있는 요리의 시작은\n좋은 레시피 찾는 게 반이에요"} />
      <Caption from={proofFrom} len={PROOF_LEN} text={"출처까지 확인되는\n진짜 레시피예요"} />
    </AbsoluteFill>
  );
};
