import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT_FAMILY, WHITE, LINE, useCustomFont, Caption } from "./shared";
import { FeatureTag, Intro, Mark, PhotoShots, SpeakerBadge, fade } from "./ReelOverview";

// 기능영상 v2 (2026-11-08) — 새 로고·새 이름(쿡 픽·식단 짜기·쿡 코치)·새 UI로 다시 녹화한 8가지 기능 데모.
// 순서·문구 = 스토어 스크린샷 v3(store/make_store_assets_v3.py · STORE_LISTING.md)와 같다:
// ① 인기 레시피 4만 개 ② 매칭률 순 ③ 쿡 픽·식단 짜기(AI 개요) ④ 쿡 코치(대체·계량) ⑤ 사진 등록 ⑥ 소비기한 자동 ⑦ 요약·읽어 주기 ⑧ 가족·아낀 돈.
// 녹화: 안드로이드 에뮬레이터 + 앱 1.0.14 디버그 빌드(scripts/rec_v2_*.py). AI 화면(쿡 픽·식단 짜기·쿡 코치·사진 인식)은 가짜 응답
// (fetch 가로채기, 크레딧·AI 호출 없음), 가족 화면은 가짜 로그인·가족 응답 — 스토어 v3 캡처와 같은 방식. 레시피는 실제 서버 데이터.
// 요리·후킹 릴스 뒤에 붙일 때는 <FeatureTailV2 /> (「그 밖에도 이런 기능이 있어요」 + 8개), 하나만 쓸 때는 FeatureV2-<번호> 컴포지션.

const f = (s: number) => Math.round(s * 30);

// 클립: 녹화본(940x1920·30fps)의 [from, to]초. rate 배속. focus 가 있으면 그 지점(녹화본 px)으로 천천히 다가간다.
export type PartV2 =
  | { kind: "clip"; src: string; from: number; to: number; rate?: number; focus?: { x: number; y: number; z: number; at?: number } }
  | { kind: "photos"; len: number };

export type SegV2 = { label: string; caption: string; speaker?: boolean; parts: PartV2[] };

export const SEGS_V2: SegV2[] = [
  {
    label: "인기 레시피 4만 개",
    caption: "인기 레시피만 4만 개\n뭘 골라도 맛집",
    parts: [
      { kind: "clip", src: "v2_popular.mp4", from: 4.0, to: 7.4, rate: 1.5 }, // 냉장고요리(총 3만 8천여 건) 훑기
      { kind: "clip", src: "v2_popular.mp4", from: 11.0, to: 14.4, rate: 1.4 }, // 요즘인기 순위
      { kind: "clip", src: "v2_popular.mp4", from: 16.6, to: 19.8, rate: 1.4 }, // 유튜브 인기
    ],
  },
  {
    label: "매칭률 순",
    caption: "재료 매칭률 높은 순으로\n만들 수 있는 요리 찾기",
    parts: [
      { kind: "clip", src: "reel2_matching_demo_v2.mp4", from: 6.8, to: 12.6, rate: 2 }, // 매칭도 설정 60~99% → 적용
      { kind: "clip", src: "reel2_matching_demo_v2.mp4", from: 12.6, to: 16.4, rate: 2 }, // 결과 훑기
      { kind: "clip", src: "reel2_matching_demo_v2.mp4", from: 19.8, to: 22.0 }, // 대체 재료 칩(들기름 → 참기름)
    ],
  },
  {
    label: "AI 메뉴·식단 추천",
    caption: "먹고 싶은 걸 물어보면\nAI가 레시피·식단까지",
    parts: [
      { kind: "clip", src: "v2_pick.mp4", from: 5.4, to: 9.6, rate: 2.2 }, // 쿡 픽 열기 → 「오늘 매운 거 먹고 싶어」
      { kind: "clip", src: "v2_pick.mp4", from: 11.2, to: 13.8 }, // 답 + 레시피 카드
      { kind: "clip", src: "v2_plan.mp4", from: 6.4, to: 8.4, rate: 1.8 }, // 식단 짜기: 조건 입력 → 짜기
      { kind: "clip", src: "v2_plan.mp4", from: 11.6, to: 13.4 }, // 일주일 식단
    ],
  },
  {
    label: "요리 중 AI 질문",
    caption: "요리하다 막히면\nAI 쿡 코치에게 물어보기",
    parts: [
      { kind: "clip", src: "v2_coach.mp4", from: 5.2, to: 9.6, rate: 2.6 }, // 레시피 창 → 쿡 코치
      { kind: "clip", src: "v2_coach.mp4", from: 9.6, to: 11.6, rate: 1.6 }, // 「당근이 없으면 뭐로 바꿔요?」
      { kind: "clip", src: "v2_coach.mp4", from: 13.0, to: 15.0 }, // 대체 답
      { kind: "clip", src: "v2_coach.mp4", from: 17.9, to: 20.3 }, // 계량 답(소금 10꼬집)
    ],
  },
  {
    label: "사진으로 재료 등록",
    caption: "사진 한 장으로\n재료 등록 끝",
    parts: [
      { kind: "photos", len: 40 }, // 영수증·음식 사진·장본 목록을 찍는 장면
      { kind: "clip", src: "v2_photo.mp4", from: 5.6, to: 7.4, rate: 1.3 }, // 사진으로 재료 담기 → 영수증
      { kind: "clip", src: "v2_photo.mp4", from: 8.0, to: 10.6, rate: 2.2 }, // 읽는 중
      { kind: "clip", src: "v2_photo.mp4", from: 10.7, to: 12.3 }, // 사진에서 찾은 재료 → 3개 담기
      { kind: "clip", src: "v2_photo.mp4", from: 12.4, to: 14.4, rate: 1.2 }, // 담았어요
    ],
  },
  {
    label: "소비기한 자동",
    caption: "소비기한은 자동으로\n곧 상할 재료부터 먼저",
    parts: [
      { kind: "clip", src: "v2_expiry.mp4", from: 5.2, to: 7.4, rate: 1.4 }, // 「우유」 입력
      { kind: "clip", src: "v2_expiry.mp4", from: 7.4, to: 12.2, rate: 2.8 }, // 냉장 · 몰라요 → 구매일 오늘
      { kind: "clip", src: "v2_expiry.mp4", from: 12.6, to: 15.0, focus: { x: 250, y: 1080, z: 1.75, at: 0.15 } }, // 우유 「약 D-10」 자동
      { kind: "clip", src: "v2_expiry.mp4", from: 16.4, to: 18.6, rate: 1.2 }, // 임박 재료 → 이 재료로 식단
    ],
  },
  {
    label: "요약 · 읽어 주기",
    caption: "단계별로 요약해서\n손 안 대고 귀로 듣기",
    speaker: true,
    parts: [
      { kind: "clip", src: "v2_listen.mp4", from: 5.0, to: 9.0, rate: 2.2 }, // 레시피 창 → 조리 순서(요약)
      { kind: "clip", src: "v2_listen.mp4", from: 9.0, to: 10.4 }, // 읽어 주기
      { kind: "clip", src: "v2_listen.mp4", from: 10.4, to: 18.4, rate: 1.9 }, // 단계마다 읽어 줌
    ],
  },
  {
    label: "가족 · 아낀 돈",
    caption: "가족과 함께 쓰고\n아낀 돈도 한눈에",
    parts: [
      { kind: "clip", src: "v2_family.mp4", from: 3.2, to: 7.2, focus: { x: 470, y: 470, z: 1.22, at: 0.1 } }, // 이번 달 목표 · 엄마/아빠 · 절약
      { kind: "clip", src: "v2_family.mp4", from: 12.8, to: 16.2, rate: 1.3 }, // 가족 달력
    ],
  },
];

export const partLenV2 = (p: PartV2) => (p.kind === "clip" ? Math.round((f(p.to) - f(p.from)) / (p.rate ?? 1)) : p.len);
export const segLenV2 = (s: SegV2) => s.parts.reduce((a, p) => a + partLenV2(p), 0);
export const SEGS_V2_LEN = SEGS_V2.reduce((a, s) => a + segLenV2(s), 0);

const VIDEO_W = 940;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2;

const ClipV2: React.FC<{ part: Extract<PartV2, { kind: "clip" }>; len: number }> = ({ part, len }) => {
  const frame = useCurrentFrame();
  const fo = part.focus;
  const z = fo ? interpolate(frame, [len * (fo.at ?? 0), len * 0.85], [1, fo.z], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) : 1;
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: 1920, overflow: "hidden", border: `1px solid ${LINE}`, opacity: fade(frame, len) }}>
      <OffthreadVideo
        src={staticFile(part.src)}
        trimBefore={f(part.from)}
        trimAfter={f(part.to)}
        playbackRate={part.rate ?? 1}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: fo ? `${fo.x}px ${fo.y}px` : undefined }}
      />
    </div>
  );
};

// 기능 하나(위쪽 기능 이름·진행 점 + 아래 한 줄 자막)
export const FeatureSegV2: React.FC<{ index: number }> = ({ index }) => {
  const s = SEGS_V2[index];
  const total = segLenV2(s);
  let acc = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      {s.parts.map((p, k) => {
        const start = acc;
        const len = partLenV2(p);
        acc += len;
        return (
          <Sequence key={k} from={start} durationInFrames={len}>
            {p.kind === "clip" ? <ClipV2 part={p} len={len} /> : <PhotoShots len={len} />}
          </Sequence>
        );
      })}
      <FeatureTag index={index} label={s.label} len={total} count={SEGS_V2.length} />
      {s.speaker && <SpeakerBadge />}
      <Caption from={4} len={total - 6} text={s.caption} />
    </AbsoluteFill>
  );
};

// 8개 기능 장면만(0프레임부터) — 마지막 기능 끝 0.8초는 흰 화면으로 사라진다(끝 장면으로 쓸 때 갑자기 끊기지 않게)
export const FeatureSegmentsV2: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [SEGS_V2_LEN - 24, SEGS_V2_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <AbsoluteFill style={{ opacity: out }}>
        {SEGS_V2.map((s, i) => {
          const from = cursor;
          const total = segLenV2(s);
          cursor += total;
          return (
            <Sequence key={s.label} from={from} durationInFrames={total} name={`${i + 1}-${s.label}`}>
              <FeatureSegV2 index={i} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const LABELS_V2 = SEGS_V2.map((s) => s.label);
export const TRANSITION_V2 = 105; // 3.5s — 「그 밖에도 이런 기능이 있어요」 + 새 이름 칩 8개

// 「그 밖에도 이런 기능이 있어요」(새 로고·새 이름 칩) → 8개 기능. 요리·후킹 릴스 뒤에 붙인다.
export const FeatureTailBody: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
    <Sequence from={0} durationInFrames={TRANSITION_V2} name="그 밖에도">
      <Intro
        line1="그 밖에도"
        line2={
          <>
            이런 <Mark>기능</Mark>이 있어요
          </>
        }
        labels={LABELS_V2}
      />
    </Sequence>
    <Sequence from={TRANSITION_V2} durationInFrames={SEGS_V2_LEN} name="기능 8개">
      <FeatureSegmentsV2 />
    </Sequence>
  </AbsoluteFill>
);
export const FEATURE_TAIL_V2_LEN = TRANSITION_V2 + SEGS_V2_LEN;

export const FeatureTailV2: React.FC = () => {
  useCustomFont();
  return <FeatureTailBody />;
};

export const FeatureOneV2: React.FC<{ index: number }> = ({ index }) => {
  useCustomFont();
  return <FeatureSegV2 index={index} />;
};
