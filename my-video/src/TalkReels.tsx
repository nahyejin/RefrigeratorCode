import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { WHITE, useCustomFont, FONT_FAMILY } from "./shared";
import { RestFeatures, restLen, REST_EXCL } from "./RestFeatures";
import { Reel2Cta, REEL2_CTA_LEN } from "./Reel2Match";

// 릴스 형식 ③ 출연자 추천·후기형(store/REEL_FORMATS.md ③, 프롬프트 store/REEL_TALK_V2.md).
// 사용자가 보낸 참고 영상(재능 검사 앱 광고) 편집을 따른다:
//   화면 위 제목 자막 고정 + 말에 맞춰 아래쪽 말 자막(짧은 구절) + 기능 설명 구간(20초~)에 앱 실제 구동 화면을 얼굴 위 가운데 카드로.
// 끝: 출연자 영상 → 그 편 기능 슬로건·「프로필 링크에서 시작하세요」 끝 화면 → 그 밖의 기능 7가지 → 끝 화면 한 번 더.
// 출연자 영상은 ffmpeg 로 미리 이어 붙인 파일(클립 2·3 첫 프레임 = 같은 사진 표정이라 잘라 냄, 음성 잡음 정리, 표식 지움).

const f = (s: number) => Math.round(s * 30);
const SANS = "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const SHADOW = "0 2px 10px rgba(0,0,0,0.55), 0 0 3px rgba(0,0,0,0.6)";
const CTA2_LEN = 120;
const FADE = 15; // 출연자 영상 끝 0.5초 흰 화면으로

type Phrase = [number, number, string]; // 편집된 출연자 영상 기준 [시작초, 끝초, 구절]
type Overlay = { at: number; len: number; src: string; from: number; rate?: number; pos?: string };
type TalkSpec = { src: string; len: number; title: string; phrases: Phrase[]; overlays: Overlay[] };

// 01 레시피 매칭 — 「요리할수록 돈이 더 드는 이유」(출연자 W). 클립 경계: 0–9.85 / 9.85–19.30 / 19.30–29.25
// 말 자막 시각은 Whisper(medium) 단어 시각 실측(클립 2는 −0.2s, 클립 3은 −0.08s 잘라 낸 만큼 당김).
const T1 = 9.85;
const T2 = 19.3;
const TALK01: TalkSpec = {
  src: "talk01_presenter.mp4",
  len: 29.25,
  title: "요리할수록\n돈이 더 드는 이유",
  phrases: [
    [0.25, 1.14, "요리할수록"], [1.14, 2.36, "돈이 더 드는 사람"], [2.36, 3.76, "이유가 딱 하나예요"],
    [3.76, 4.82, "재료를 요리마다"], [4.82, 5.92, "새로 사거든요"], [5.92, 7.0, "한 번 쓰고 남은 건"],
    [7.0, 8.26, "버리고 또 사고"], [8.26, 9.14, "그러니까 배달보다"], [9.14, 9.85, "비싸요"],
    [T1 + 0.12, T1 + 1.0, "저도 그래서"], [T1 + 1.0, T1 + 2.68, "요리를 아예 놓았었어요"],
    [T1 + 3.08, T1 + 4.1, "맛없고 비싸고"], [T1 + 4.1, T1 + 5.28, "힘드니까요"],
    [T1 + 5.46, T1 + 6.5, "그러다 남은 재료부터"], [T1 + 6.5, T1 + 7.52, "쓰게 해 주는 앱을"],
    [T1 + 7.52, T1 + 8.2, "찾았는데"], [T1 + 8.2, T1 + 9.45, "그게 쿡매치예요"],
    [T2 + 0.06, T2 + 1.96, "냉장고 재료를 담아 두면"], [T2 + 1.96, T2 + 3.6, "지금 있는 재료로 만들 수 있는"],
    [T2 + 3.6, T2 + 4.52, "요리가"], [T2 + 4.52, T2 + 5.7, "몇 퍼센트 맞는지까지"], [T2 + 5.7, T2 + 7.1, "순서대로 떠요"],
    [T2 + 7.22, T2 + 8.08, "한두 개 없으면"], [T2 + 8.08, T2 + 9.6, "있는 재료로 바꿔 주고요"],
  ],
  // 기능 설명(클립 3) 동안 매칭 화면: 결과 목록(매칭률 배지) → 대체 재료 칩. 원본 reel2_matching_demo_new.mp4 시각.
  overlays: [
    { at: T2 + 0.3, len: 6.9, src: "reel2_matching_demo_new.mp4", from: 10.0, rate: 1.0 },
    { at: T2 + 7.2, len: 2.75, src: "reel2_matching_demo_new.mp4", from: 19.2, rate: 1.0, pos: "center 40%" },
  ],
};

const Title: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", top: 150, left: 40, right: 40, textAlign: "center", fontFamily: SANS }}>
    <span style={{ whiteSpace: "pre-line", fontSize: 78, fontWeight: 800, lineHeight: 1.22, color: WHITE, letterSpacing: "-0.01em", textShadow: SHADOW }}>{text}</span>
  </div>
);

const Said: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", top: 1190, left: 40, right: 40, textAlign: "center", fontFamily: SANS }}>
    <span style={{ fontSize: 76, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em", textShadow: SHADOW }}>{text}</span>
  </div>
);

// 얼굴 위 가운데 앱 화면 카드(참고 영상처럼 화면 너비의 약 56%)
const AppCard: React.FC<{ o: Overlay }> = ({ o }) => {
  const frame = useCurrentFrame();
  const len = f(o.len);
  const op = interpolate(frame, [0, 6, len - 6, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sc = interpolate(frame, [0, 8], [0.94, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: (1080 - 600) / 2, top: 360, width: 600, height: 780, borderRadius: 26, overflow: "hidden", opacity: op, transform: `scale(${sc})`, boxShadow: "0 18px 50px rgba(0,0,0,0.45)", background: "#fff" }}>
      <OffthreadVideo src={staticFile(o.src)} muted trimBefore={f(o.from)} playbackRate={o.rate ?? 1}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: o.pos ?? "center top" }} />
    </div>
  );
};

const Talk: React.FC<{ s: TalkSpec }> = ({ s }) => {
  const frame = useCurrentFrame();
  const total = f(s.len);
  const fade = interpolate(frame, [total - FADE, total - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <OffthreadVideo src={staticFile(s.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {s.overlays.map((o, i) => (
          <Sequence key={i} from={f(o.at)} durationInFrames={f(o.len)}>
            <AppCard o={o} />
          </Sequence>
        ))}
        <Title text={s.title} />
        {s.phrases.map(([a, b, t], i) => {
          // 다음 구절이 바로 이어지면 끝까지 붙여 깜빡임이 없게
          const next = s.phrases[i + 1];
          const end = next && next[0] - b < 0.35 ? next[0] : b + 0.15;
          return (
            <Sequence key={i} from={f(a)} durationInFrames={Math.max(1, f(end) - f(a))}>
              <Said text={t} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const make = (s: TalkSpec, Cta: React.FC<{ silent?: boolean }>, ctaLen: number, restIdx: number) => {
  const tLen = f(s.len);
  const rLen = restLen(restIdx);
  const Comp: React.FC = () => {
    useCustomFont();
    return (
      <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
        <Sequence from={0} durationInFrames={tLen} name="Talk">
          <Talk s={s} />
        </Sequence>
        <Sequence from={tLen} durationInFrames={ctaLen} name="CTA">
          <Cta />
        </Sequence>
        <Sequence from={tLen + ctaLen} durationInFrames={rLen} name="Rest">
          <RestFeatures excl={restIdx} />
        </Sequence>
        <Sequence from={tLen + ctaLen + rLen} durationInFrames={CTA2_LEN} name="CTA-again">
          <Cta silent />
        </Sequence>
      </AbsoluteFill>
    );
  };
  return { Comp, total: tLen + ctaLen + rLen + CTA2_LEN };
};

export const REELS_TALK = [
  { id: "Talk01Matching", ...make(TALK01, Reel2Cta, REEL2_CTA_LEN, REST_EXCL[1]) },
];
