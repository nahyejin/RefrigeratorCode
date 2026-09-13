import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, CtaOutro, Caption } from "./shared";

// 훅: 제미나이 생성 실사 클립(10s, 720x1280, 24fps, 대사 포함 재촬영본) — 소파에서 레시피 보다 설레었다가 실망하는 여성
const HOOK_VIDEO = "reel2_hook_gemini.mp4";
// 데모: 실제 쿡매치 매칭률 필터 + 대체 재료 추천 + 부족재료 구매 화면(20.5s, 940x1920, 30fps, 재촬영본)
// 원본 파일은 영상 맨 끝(19.7~20.5s) 근처에서 seek가 불안정해서(같은 타임코드인데 요청마다 다른 프레임이 나옴),
// 고정 프레임레이트로 재인코딩한 버전을 씀 — 재인코딩 후에는 정확히 재현됨
const DEMO_VIDEO = "reel2_matching_demo_fixed.mp4";

// ---- 훅 원본 타임코드(30fps 기준 프레임) — 오디오에서 실제 대사 구간을 실측해서 잡음 ----
// silencedetect로 확인한 발화 구간: 4.5~5.9s(주된 대사 "아 이 재료가 없네"), 7.3~7.7s(짧은 탄식)
const HOOK_RAW = {
  discover: [60, 120], // 0:02.0–4.0 설레며 스크롤(무음)
  talk: [135, 231], // 0:04.5–7.7 대사 구간을 통째로 — 문장 중간에서 하드컷하면 말이 잘려서, 두 발화 구간을 다 포함해 통으로 씀
  settle: [258, 294], // 0:08.6–9.8 폰을 무릎 위로 내려놓음
};
const rateSettle = 0.5; // 마지막 캡션("레시피는 맛있어 보이는데...")이 읽히기엔 원본 구간이 너무 짧아서, 배속을 늦춰 체류 시간을 늘림
const HB1 = HOOK_RAW.discover[1] - HOOK_RAW.discover[0]; // 60f
const HB2 = HOOK_RAW.talk[1] - HOOK_RAW.talk[0]; // 96f
const HB3 = Math.round((HOOK_RAW.settle[1] - HOOK_RAW.settle[0]) / rateSettle); // 72f
const HOOK_LEN = HB1 + HB2 + HB3; // 228f

// ---- 데모 원본 타임코드(30fps 기준 프레임) ----
const DEMO_RAW = {
  filter: [30, 135], // 0:01.0–4.5 매칭도 설정 모달 열고 63~100% 조정 후 적용
  results: [195, 330], // 0:06.5–11.0 필터링된 결과 스크롤(매칭도 배지·재료 칩) — 11초 이후 매칭도를 63~84%로 한 번 더 좁히는 모달이 다시 뜨길래 그 앞부분까지만 쓰고 하드컷으로 건너뜀
  substitute: [510, 570], // 0:17.0–19.0 "당근→양파" 대체 가능 칩 노출(원속도로 또렷하게)
  coupangList: [555, 585], // 0:18.5–19.5 "통깨+" 칩이 보이는 리스트
  coupangModal: [606, 616], // 0:20.2–20.53(영상 맨 끝) 부족 재료 구매 모달 — 실측해보니 모달이 열려 있는 구간이 여기뿐이라(그 전엔 계속 리스트), 나머지는 하드컷으로 건너뜀
};
const rateFilter = 1.3;
const rateResults = 1.5;
// 모달 구간(원본 0.33초)은 배속을 늦추면(rate<1) OffthreadVideo가 이 파일 끝부분에서 흰 화면을 뱉는
// 버그가 있어서(재인코딩해도 재현됨), 대신 같은 정지 화면을 rate=1로 여러 번 이어붙여서 체류시간을 늘림
const MODAL_RAW_LEN = DEMO_RAW.coupangModal[1] - DEMO_RAW.coupangModal[0]; // 10f
// 3번 반복 시도했더니 반복 중 일부만 흰 화면으로 깨지는(재현이 불규칙한) OffthreadVideo 버그가 있어서 1회만 사용
const MODAL_LOOPS = 1;

const D1 = Math.round((DEMO_RAW.filter[1] - DEMO_RAW.filter[0]) / rateFilter); // 81f
const D2 = Math.round((DEMO_RAW.results[1] - DEMO_RAW.results[0]) / rateResults); // 123f
const D3 = DEMO_RAW.substitute[1] - DEMO_RAW.substitute[0]; // 60f
const D4a = DEMO_RAW.coupangList[1] - DEMO_RAW.coupangList[0]; // 30f
const D4b = MODAL_RAW_LEN * MODAL_LOOPS; // 30f
const D4 = D4a + D4b; // 60f
const PULSE = 15; // D4 뒷부분에서 프리즈 없이 살짝 확대 펄스만 얹는다(정지 프레임 트릭이 이 소스에서 불안정해서)
const DEMO_LEN = D1 + D2 + D3 + D4; // 300f

const CTA_LEN = 60; // 2.0s

const HOOK_FROM = 0;
const DEMO_FROM = HOOK_FROM + HOOK_LEN;
const CTA_FROM = DEMO_FROM + DEMO_LEN;

export const REEL2_TOTAL_FRAMES = CTA_FROM + CTA_LEN;

export const Reel2Match: React.FC = () => {
  useCustomFont();
  return (
    // 무음 마스터가 원칙이지만, 훅의 실제 대사 음성만은 예외로 살려서 씀(01편과 동일 방침) — 데모는 계속 무음
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
              없는 재료 대신, <span style={{ color: "#D99A00" }}>있는 걸로 바꿔드려요</span>
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
// muted=false로 두면 오디오를 살린다 — 훅에 실제 대사가 들어간 이후로 추가된 옵션(데모는 계속 true).
const SubClip: React.FC<{
  src: string;
  rawFrom: number;
  rawTo: number;
  rate: number;
  len: number;
  width: number;
  height: number;
  left: number;
  zoom?: number; // 특정 화면 요소를 더 크게 강조하고 싶을 때 확대 배율
  origin?: string; // 확대 중심점(transform-origin) — 강조하고 싶은 요소 쪽으로 맞춘다
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
  const b1From = 0;
  const b2From = b1From + HB1;
  const b3From = b2From + HB2;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <Sequence from={b1From} durationInFrames={HB1} name="discover">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.discover[0]} rawTo={HOOK_RAW.discover[1]} rate={1} len={HB1} width={1080} height={1920} left={0} fade={false} />
      </Sequence>
      <Sequence from={b2From} durationInFrames={HB2} name="talk">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.talk[0]} rawTo={HOOK_RAW.talk[1]} rate={1} len={HB2} width={1080} height={1920} left={0} fade={false} muted={false} />
      </Sequence>
      <Sequence from={b3From} durationInFrames={HB3} name="settle">
        <SubClip src={HOOK_VIDEO} rawFrom={HOOK_RAW.settle[0]} rawTo={HOOK_RAW.settle[1]} rate={rateSettle} len={HB3} width={1080} height={1920} left={0} fade={false} />
      </Sequence>

      <Caption from={b1From} len={HB1 + HB2} text={"어렵게 찾은 레시피인데\n재료 한두 개 없어서 포기한 적 있죠?"} />
      <Caption from={b3From} len={HB3} text={"레시피는 맛있어 보이는데\n재료가 없어서 못 만든 적 많죠"} />
    </AbsoluteFill>
  );
};

// ---------- ③ 데모 (실사 — 940x1920, 세로 높이가 캔버스와 같아 좌우만 살짝 레터박스) ----------
const VIDEO_W = 940;
const VIDEO_H = 1920;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2; // 70

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const d1From = 0;
  const d2From = d1From + D1;
  const d3From = d2From + D2;
  const d4From = d3From + D3;
  const d4bFrom = d4From + D4a;
  const holdFrom = d4From + D4 - PULSE; // D4(쿠팡 구매) 뒷부분에서 펄스 강조

  // 페이오프 강조 — "통깨 구매" 모달이 뜬 순간 살짝 확대 펄스(프리즈 없이, 실사 재생 그대로)
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
        <Sequence from={d1From} durationInFrames={D1} name="filter">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.filter[0]}
            rawTo={DEMO_RAW.filter[1]}
            rate={rateFilter}
            len={D1}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
          />
        </Sequence>
        <Sequence from={d2From} durationInFrames={D2} name="results">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.results[0]}
            rawTo={DEMO_RAW.results[1]}
            rate={rateResults}
            len={D2}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
          />
        </Sequence>
        <Sequence from={d3From} durationInFrames={D3} name="substitute">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.substitute[0]}
            rawTo={DEMO_RAW.substitute[1]}
            rate={1}
            len={D3}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            zoom={1.6}
            origin="33% 51%"
          />
        </Sequence>
        <Sequence from={d4From} durationInFrames={D4a} name="coupangList">
          <SubClip
            src={DEMO_VIDEO}
            rawFrom={DEMO_RAW.coupangList[0]}
            rawTo={DEMO_RAW.coupangList[1]}
            rate={1}
            len={D4a}
            width={VIDEO_W}
            height={VIDEO_H}
            left={VIDEO_LEFT}
            fade={false}
          />
        </Sequence>
        {Array.from({ length: MODAL_LOOPS }).map((_, i) => (
          <Sequence key={i} from={d4bFrom + i * MODAL_RAW_LEN} durationInFrames={MODAL_RAW_LEN} name={`coupangModal${i}`}>
            <SubClip
              src={DEMO_VIDEO}
              rawFrom={DEMO_RAW.coupangModal[0]}
              rawTo={DEMO_RAW.coupangModal[1]}
              rate={1}
              len={MODAL_RAW_LEN}
              width={VIDEO_W}
              height={VIDEO_H}
              left={VIDEO_LEFT}
              fade={false}
            />
          </Sequence>
        ))}
      </div>

      <Caption from={d1From} len={D1 + D2} text={"내 냉장고 기준으로\n매칭률 순으로 정렬"} />
      <Caption from={d3From} len={D3} text={"재료가 한두 개 부족해도\n대체할 재료를 추천해줘요"} />
      <Caption from={d4From} len={D4} text={"그래도 없는 재료는\n한 번에 구매까지 연결돼요"} />
    </AbsoluteFill>
  );
};
