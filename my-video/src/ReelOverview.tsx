import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, INK, INK_SOFT, YELLOW, LINE, useCustomFont, CtaOutro, Caption, AppIcon, RevealText } from "./shared";

// 「기능 총정리」 30초 소개 영상 (2026-10-12 사용자 아이디어) — 프로필에 들어온 사람이 「아, 이런 8가지 기능이 메인이구나」를
// 한눈에 알아보게 하는 영상. 8편 릴스의 화면 녹화(무음)에서 장면을 뽑아 기능당 3초씩 잇고, 위쪽에 기능 이름·진행 점,
// 아래에 한 줄 자막. 음성 없음(릴스 음원을 얹는 전제 — 다른 편과 같은 무음 마스터 방침).
// 구간은 각 편 컴포지션의 DEMO_RAW(원본 프레임, 30fps 기준)에서 가져왔다.

type Seg = { label: string; caption: string; clips: { src: string; from: number; to: number; zoom?: number }[] };

const SEGS: Seg[] = [
  {
    label: "사진 인식",
    caption: "영수증·음식 사진 한 장이면\n재료 등록 끝",
    clips: [
      { src: "reel1_photo_demo_new.mp4", from: 780, to: 840 }, // 인식 로딩
      { src: "reel1_photo_demo_new.mp4", from: 1020, to: 1050 }, // 사진에서 찾은 재료
    ],
  },
  { label: "레시피 매칭", caption: "냉장고 재료로 만들 수 있는\n레시피를 매칭률 순으로", clips: [{ src: "reel2_matching_demo_new.mp4", from: 363, to: 453 }] },
  {
    label: "요리 모드",
    caption: "손 안 대고 단계별로\n읽어 주는 요리 모드",
    clips: [
      // 옛 녹화(880x1920)라 맨 위에 폰 상태바(시각·배터리)가 찍혀 있다 → 아래 기준으로 4% 확대해 윗부분을 밀어낸다
      { src: "reel3_cookmode_demo.mp4", from: 240, to: 300, zoom: 1.045 },
      { src: "reel3_cookmode_demo.mp4", from: 489, to: 519, zoom: 1.045 },
    ],
  },
  { label: "AI 식단", caption: "AI가 냉장고 재료로\n일주일 식단과 장보기까지", clips: [{ src: "reel4_diet_demo_new.mp4", from: 590, to: 680 }] },
  { label: "유통기한 알림", caption: "유통기한이 다가오면 알림,\n임박 재료 레시피까지", clips: [{ src: "reel5_recipe_demo_new.mp4", from: 366, to: 456 }] },
  { label: "요리 AI", caption: "말하듯 물어보면\n내 냉장고에 맞는 레시피 추천", clips: [{ src: "reel6_chatbot_demo_new.mp4", from: 639, to: 729 }] },
  { label: "진짜 레시피", caption: "유튜브·네이버 인기순,\n검증된 레시피만", clips: [{ src: "reel7_sort_demo_new.mp4", from: 0, to: 90 }] },
  { label: "가족·아낀 돈", caption: "가족과 집밥 목표,\n아낀 돈(예상)까지", clips: [{ src: "reel8_family_demo_new.mp4", from: 558, to: 648 }] },
];

const SEG_LEN = 90; // 3s
const INTRO = 105; // 3.5s
const CTA_LEN = 135; // 4.5s
const TOTAL = INTRO + SEG_LEN * SEGS.length + CTA_LEN; // 960f = 32s

export const REEL_OVERVIEW_TOTAL_FRAMES = TOTAL;

const VIDEO_W = 940;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2;

// 화면 녹화는 940(또는 880) x 1920 — 가로가 880인 옛 녹화(요리 모드)는 같은 자리에 가운데 정렬로 둔다.
const Clip: React.FC<{ src: string; from: number; to: number; len: number; zoom?: number }> = ({ src, from, to, len, zoom }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [len - 4, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: 1920, overflow: "hidden", border: `1px solid ${LINE}`, opacity: Math.min(fadeIn, fadeOut) }}>
      <OffthreadVideo src={staticFile(src)} trimBefore={from} trimAfter={to} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: zoom ? `scale(${zoom})` : undefined, transformOrigin: "50% 100%" }} />
    </div>
  );
};

// 위쪽 기능 이름 + 진행 점(8개 중 몇 번째인지)
const FeatureTag: React.FC<{ index: number; label: string; len: number }> = ({ index, label, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, mass: 0.6 } });
  const out = interpolate(frame, [len - 4, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 170, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * -14}px)` }}>
      <div style={{ backgroundColor: YELLOW, color: INK, fontSize: 56, fontWeight: 800, padding: "12px 38px", borderRadius: 999, boxShadow: "0 10px 26px rgba(255,214,0,0.35)" }}>{label}</div>
      <div style={{ display: "flex", gap: 12 }}>
        {SEGS.map((_, i) => (
          <div key={i} style={{ width: i === index ? 44 : 14, height: 14, borderRadius: 7, backgroundColor: i === index ? INK : "rgba(26,26,30,0.22)" }} />
        ))}
      </div>
    </div>
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <AppIcon size={190} />
      </div>
      <RevealText top={520} delay={4} size={84}>
        냉장고 앱 하나로
      </RevealText>
      <RevealText top={640} delay={14} size={84}>
        <span style={{ color: "#D99A00" }}>이 8가지</span>가 다 돼요
      </RevealText>
      <div style={{ position: "absolute", top: 870, left: 90, right: 90, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
        {SEGS.map((s, i) => {
          const p = spring({ frame: frame - (30 + i * 5), fps, config: { damping: 15, mass: 0.6 } });
          return (
            <div key={s.label} style={{ opacity: p, transform: `scale(${0.85 + 0.15 * p})`, fontSize: 46, fontWeight: 800, color: INK, backgroundColor: "rgba(255,214,0,0.28)", border: `2px solid ${YELLOW}`, padding: "12px 30px", borderRadius: 999 }}>
              {s.label}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1250, left: 0, right: 0, textAlign: "center", fontSize: 42, fontWeight: 700, color: INK_SOFT }}>차례로 보여 드릴게요</div>
    </AbsoluteFill>
  );
};

export const ReelOverview: React.FC = () => {
  useCustomFont();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Sequence from={0} durationInFrames={INTRO} name="Intro">
        <Intro />
      </Sequence>
      {SEGS.map((s, i) => {
        const from = INTRO + i * SEG_LEN;
        // 한 기능에 클립이 둘이면 앞뒤로 반씩(길이 합이 3초가 되도록 마지막 클립이 남는 만큼 차지)
        const lens = s.clips.map((c) => c.to - c.from);
        const total = lens.reduce((a, b) => a + b, 0);
        let acc = 0;
        return (
          <Sequence key={s.label} from={from} durationInFrames={SEG_LEN} name={`${i + 1}-${s.label}`}>
            <AbsoluteFill style={{ backgroundColor: WHITE }}>
              {s.clips.map((c, k) => {
                const start = acc;
                const len = k === s.clips.length - 1 ? SEG_LEN - start : Math.round((lens[k] / total) * SEG_LEN);
                acc += len;
                return (
                  <Sequence key={k} from={start} durationInFrames={len}>
                    <Clip src={c.src} from={c.from} to={c.to} len={len} zoom={c.zoom} />
                  </Sequence>
                );
              })}
              <FeatureTag index={i} label={s.label} len={SEG_LEN} />
              <Caption from={4} len={SEG_LEN - 6} text={s.caption} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Sequence from={INTRO + SEG_LEN * SEGS.length} durationInFrames={CTA_LEN} name="CTA">
        <CtaOutro
          payoffLine={
            <>
              기능 8가지, <span style={{ color: "#D99A00" }}>앱 하나로</span>
            </>
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};
