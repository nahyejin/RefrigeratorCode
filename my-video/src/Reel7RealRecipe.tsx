import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps, 대사 포함) — 집밥을 먹다가 애매한 표정으로
// "분명 레시피대로 했는데... 이 레시피도 요리 초보가 쓴 거 아니야?" 혼잣말 후 접시를 밀어내는 리액션
const HOOK_VIDEO = "reel7_hook_gemini.mp4";
// 데모: 실제 쿡매치 냉장고요리 흐름(23.6s, 880x1920, 30fps) — 로딩(레시피 4만여개) → 인기순 정렬 →
// 레시피 상세 → 원문(실제 유튜브 영상)까지 연결
const DEMO_VIDEO = "reel7_recipe_demo.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) ----
// silencedetect로 실측: 대사("분명 레시피대로 했는데... 이 레시피도 요리 초보가 쓴 거 아니야?")는
// 3.77~6.52s에 이어져 있어서(06편과 달리 문장이 짧아 끊을 필요 없음) 통으로 살리고, 대사 뒤 정적을
// 건너뛰어 젓가락을 내려놓고 접시를 밀어내는 리액션(7.5~9.5s)으로 하드컷(06편에서 배운 대로 정지
// 프레임 없이 바로 컷 — 같은 촬영본이라 이어붙여도 위화감 없음).
const HOOK_RAW = {
  line: [0, 196], // 0:00–6.53 밥 먹으며 대사
  reaction: [225, 285], // 0:07.5–9.5 젓가락 내려놓고 접시 밀어내는 리액션(무음)
};
const HB1 = HOOK_RAW.line[1] - HOOK_RAW.line[0]; // 196f
const HB2 = HOOK_RAW.reaction[1] - HOOK_RAW.reaction[0]; // 60f
const HOOK_LEN = HB1 + HB2; // 256f

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
  const b2From = HB1;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={0} durationInFrames={HB1} name="line">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.line[0]} rawTo={HOOK_RAW.line[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} muted={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="reaction">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.reaction[0]} rawTo={HOOK_RAW.reaction[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} />
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
