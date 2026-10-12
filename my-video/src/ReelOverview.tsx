import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, WHITE, INK, YELLOW, LINE, useCustomFont, CtaOutro, Caption, AppIcon, RevealText } from "./shared";

// 「기능 총정리」 릴스 (2026-10-12 사용자 아이디어) — 프로필에 들어온 사람이 「아, 이런 8가지 기능이 메인이구나」를 한눈에
// 알아보게 하는 영상. 8편 릴스의 화면 녹화(무음)에서 장면을 뽑아 기능마다 이어 붙이고, 위쪽에 기능 이름·진행 점, 아래에 한 줄 자막.
// 음성 없음(릴스 음원을 얹는 전제 — 다른 편과 같은 무음 마스터 방침).
// 구간은 각 편 컴포지션의 DEMO_RAW(원본 프레임, 30fps 기준)에서 가져왔다.
// 2차 수정(같은 날 사용자 피드백): 첫 장면 노란 칩·「차례로 보여 드릴게요」 삭제, 사진 인식은 촬영→선택→인식→등록 흐름,
// 매칭은 팝업 조정→적용→레시피, 요리 모드는 스피커 표시, AI 식단은 입력→결과, 유통기한은 푸시 알림→임박 재료 설정→레시피.

type Part =
  | { kind: "clip"; src: string; from: number; to: number; rate?: number; zoom?: number; cropTop?: number; blurFrom?: number }
  | { kind: "photos"; len: number }
  | { kind: "push"; len: number }
  | { kind: "savings"; len: number };

type Seg = { label: string; caption: string; speaker?: boolean; parts: Part[] };

// 푸시 알림 장면: true 면 에뮬레이터에서 진짜 FCM 푸시를 받아 녹화한 클립(`overview_push_demo.mp4`)을, false 면 같은 모양으로 그린 잠금화면을 쓴다.
const REAL_PUSH_CLIP = false;
const PUSH_CLIP_FRAMES = 150;

const SEGS: Seg[] = [
  {
    label: "사진 인식",
    caption: "영수증·음식 사진·장본 목록\n사진 한 장이면 재료 등록 끝",
    parts: [
      { kind: "photos", len: 66 }, // 영수증·음식·장본 목록을 카메라로 찍는 장면(셔터 플래시)
      { kind: "clip", src: "reel1_photo_demo_new.mp4", from: 410, to: 440, rate: 1.2 }, // 어떤 사진을 고르실 건가요?
      { kind: "clip", src: "reel1_photo_demo_new.mp4", from: 630, to: 720, rate: 2 }, // 사진 고르기
      { kind: "clip", src: "reel1_photo_demo_new.mp4", from: 780, to: 850, rate: 1.7 }, // 인식 로딩
      { kind: "clip", src: "reel1_photo_demo_new.mp4", from: 1020, to: 1050 }, // 사진에서 찾은 재료
      { kind: "clip", src: "reel1_photo_done_new.mp4", from: 175, to: 235 }, // 3개를 담았어요
    ],
  },
  {
    label: "레시피 매칭",
    caption: "매칭률을 조정하면\n내 냉장고에 맞는 레시피만",
    parts: [{ kind: "clip", src: "reel2_matching_demo_new.mp4", from: 165, to: 425, rate: 1.5 }], // 팝업 열기→60~99%→적용→레시피
  },
  {
    label: "요리 모드",
    caption: "손 안 대고 단계별로\n읽어 주는 요리 모드",
    speaker: true,
    parts: [
      // 옛 녹화(880x1920)라 맨 위에 폰 상태바(시각·배터리)가 찍혀 있다 → 아래 기준으로 4.5% 확대해 윗부분을 밀어낸다
      { kind: "clip", src: "reel3_cookmode_demo.mp4", from: 240, to: 300, zoom: 1.045 },
      { kind: "clip", src: "reel3_cookmode_demo.mp4", from: 489, to: 549, zoom: 1.045 },
    ],
  },
  {
    label: "AI 식단",
    caption: "원하는 걸 입력하면\nAI가 일주일 식단을 짜 줘요",
    parts: [
      { kind: "clip", src: "reel4_diet_demo_new.mp4", from: 162, to: 202 }, // 식단 추천 버튼
      { kind: "clip", src: "reel4_diet_demo_new.mp4", from: 225, to: 280 }, // 요청 입력·전송
      { kind: "clip", src: "reel4_diet_demo_new.mp4", from: 273, to: 590, rate: 4 }, // 로딩(빨리감기)
      { kind: "clip", src: "reel4_diet_demo_new.mp4", from: 590, to: 680 }, // 결과 + 장보기
    ],
  },
  {
    label: "유통기한 알림",
    caption: "유통기한이 다가오면 푸시 알림,\n임박 재료로 바로 레시피 확인",
    parts: [
      { kind: "push", len: REAL_PUSH_CLIP ? PUSH_CLIP_FRAMES : 120 },
      { kind: "clip", src: "reel5_recipe_demo_new.mp4", from: 180, to: 420, rate: 1.5 }, // 임박 재료 설정 → 적용 → 레시피
    ],
  },
  {
    label: "요리 AI",
    caption: "말하듯 물어보면\n내 냉장고에 맞는 레시피 추천",
    parts: [
      { kind: "clip", src: "reel6_chatbot_demo_new.mp4", from: 180, to: 324, rate: 1.3 }, // 챗봇 열기 → 질문 입력 → 전송
      { kind: "clip", src: "reel6_chatbot_demo_new.mp4", from: 324, to: 636, rate: 5 }, // 로딩(빨리감기)
      { kind: "clip", src: "reel6_chatbot_demo_new.mp4", from: 639, to: 739 }, // 답변 + 레시피 카드
    ],
  },
  {
    label: "진짜 레시피",
    caption: "유튜브·네이버 인기순 레시피,\n원문 영상까지 바로 확인",
    parts: [
      { kind: "clip", src: "reel7_sort_demo_new.mp4", from: 0, to: 90 }, // 인기순 정렬
      // 옛 녹화(아이폰 화면, 880x1920)라 맨 위 상태바를 7편과 똑같이 180px 잘라 내고, 유튜브 하단 채널 정보(원본 y 1440~)는 흐린다
      { kind: "clip", src: "reel7_recipe_demo.mp4", from: 519, to: 624, rate: 1.5, cropTop: 180 }, // 레시피 상세
      { kind: "clip", src: "reel7_recipe_demo.mp4", from: 624, to: 707, cropTop: 180, blurFrom: 1440 }, // 원문 보기 → 실제 유튜브 영상(좋아요·조회수)
    ],
  },
  {
    label: "가족·아낀 돈",
    caption: "가족과 집밥 목표를 정하면\n아낀 돈(예상)이 바로 보여요",
    parts: [
      { kind: "clip", src: "reel8_family_demo_new.mp4", from: 215, to: 311, rate: 1.5 }, // 목표 수정
      { kind: "savings", len: 96 }, // 아낀 돈 표시 줌인
      { kind: "clip", src: "reel8_family_demo_new.mp4", from: 558, to: 642 }, // 가족 캘린더
    ],
  },
];

const INTRO = 66; // 2.2s
const CTA_LEN = 135; // 4.5s

const partLen = (p: Part) => (p.kind === "clip" ? Math.round((p.to - p.from) / (p.rate ?? 1)) : p.len);
const segLen = (s: Seg) => s.parts.reduce((a, p) => a + partLen(p), 0);
const TOTAL = INTRO + SEGS.reduce((a, s) => a + segLen(s), 0) + CTA_LEN;

export const REEL_OVERVIEW_TOTAL_FRAMES = TOTAL;

const VIDEO_W = 940;
const VIDEO_LEFT = (1080 - VIDEO_W) / 2;

const fade = (frame: number, len: number) =>
  Math.min(
    interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [len - 4, len - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

// 화면 녹화는 940(또는 880) x 1920 — 가로가 880인 옛 녹화(요리 모드)는 같은 자리에 가운데 정렬로 둔다.
const Clip: React.FC<{ part: Extract<Part, { kind: "clip" }>; len: number }> = ({ part, len }) => {
  const frame = useCurrentFrame();
  const crop = part.cropTop ?? 0;
  const video = (
    <OffthreadVideo
      src={staticFile(part.src)}
      trimBefore={part.from}
      trimAfter={part.to}
      playbackRate={part.rate ?? 1}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover", transform: part.zoom ? `scale(${part.zoom})` : undefined, transformOrigin: "50% 100%" }}
    />
  );
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: 1920, overflow: "hidden", border: `1px solid ${LINE}`, opacity: fade(frame, len) }}>
      {crop > 0 ? (
        <div style={{ position: "absolute", top: crop / 2, left: 0, width: "100%", height: `calc(100% - ${crop}px)`, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -crop, left: 0, width: "100%", height: `calc(100% + ${crop}px)` }}>{video}</div>
        </div>
      ) : (
        video
      )}
      {part.blurFrom != null && (
        <div style={{ position: "absolute", top: part.blurFrom - crop / 2, left: 0, right: 0, bottom: 0, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }} />
      )}
    </div>
  );
};

// 영수증·음식 사진·장본 목록을 카메라로 찍는 장면 — 스토어 미리보기 03번과 같은 카메라 화면 3장(실제 폰 카메라 화면 캡처)에 셔터 플래시.
const SHOTS = [
  { img: "reel1_src_receipt.jpg", label: "영수증", x: 0.19, angle: -8, w: 340, top: 470, at: 0, flash: 24 },
  { img: "reel1_src_pizza_cheese.jpg", label: "음식 사진", x: 0.5, angle: 0, w: 400, top: 400, at: 8, flash: 38 },
  { img: "reel1_src_coupang.jpg", label: "장본 목록", x: 0.81, angle: 8, w: 340, top: 470, at: 16, flash: 52 },
];

const PhotoShots: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, opacity: fade(frame, len) }}>
      {SHOTS.map((c) => {
        const p = spring({ frame: frame - c.at, fps, config: { damping: 16, mass: 0.7 } });
        const h = Math.round(c.w * (2399 / 1206));
        const flash = interpolate(frame, [c.flash, c.flash + 2, c.flash + 8], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={c.label} style={{ position: "absolute", left: 1080 * c.x - c.w / 2, top: c.top + (1 - p) * 120, width: c.w, opacity: p, transform: `rotate(${c.angle * p}deg)` }}>
            <div style={{ position: "relative", width: c.w, height: h }}>
              <Img src={staticFile(c.img)} style={{ width: c.w, height: h, objectFit: "cover", borderRadius: 38, border: "7px solid #1A1A1E", boxShadow: "0 18px 40px rgba(26,26,30,0.22)", display: "block" }} />
              <div style={{ position: "absolute", inset: 7, borderRadius: 31, backgroundColor: "#FFFFFF", opacity: flash }} />
            </div>
            <div style={{ marginTop: 20, textAlign: "center", fontSize: 40, fontWeight: 800, color: INK }}>{c.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// 푸시 알림 장면 — 잠금화면에 알림이 내려오는 모양(진짜 녹화 클립이 없을 때 쓰는 대체 장면)
const PushScene: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (REAL_PUSH_CLIP) {
    return (
      <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: 1920, overflow: "hidden", opacity: fade(frame, len) }}>
        <OffthreadVideo src={staticFile("overview_push_demo.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  const p = spring({ frame: frame - 26, fps, config: { damping: 15, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ opacity: fade(frame, len), background: "linear-gradient(180deg,#1b2433 0%,#0f1520 100%)", fontFamily: FONT_FAMILY }}>
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 170, fontWeight: 300, letterSpacing: -4 }}>7:30</div>
        <div style={{ fontSize: 44, opacity: 0.8, marginTop: 8 }}>10월 12일 월요일</div>
      </div>
      <div style={{ position: "absolute", top: 860, left: 70, right: 70, opacity: p, transform: `translateY(${(1 - p) * -90}px)`, backgroundColor: "rgba(245,246,248,0.96)", borderRadius: 44, padding: "34px 40px", display: "flex", gap: 30, alignItems: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
        <AppIcon size={104} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 32, color: "#555", fontWeight: 600 }}>쿡매치 · 지금</div>
          <div style={{ fontSize: 46, color: INK, fontWeight: 800, marginTop: 4 }}>곧 상하는 재료가 있어요</div>
          <div style={{ fontSize: 38, color: "#333", marginTop: 6 }}>우유 D-1 · 두부 D-2 · 달걀 D-3</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 아낀 돈(절약액) 카드 줌인 — 8편의 SavingsFreeze 와 같은 소재(reel8_savings_bg/card.png: 「목표 20회 · 목표 달성 시 48만원」)를
// 흐린 배경 위에 크게 팝인한 뒤 천천히 더 확대해서 숫자에 시선이 가게 한다.
const SavingsZoom: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const slow = interpolate(frame, [20, len - 8], [1, 1.32], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <div style={{ position: "absolute", top: 0, left: VIDEO_LEFT, width: VIDEO_W, height: 1920, overflow: "hidden", border: `1px solid ${LINE}`, opacity: fade(frame, len) }}>
      <Img src={staticFile("reel8_savings_bg.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(14px) brightness(0.42)" }} />
      <div style={{ position: "absolute", top: "42%", left: "50%", width: "94%", transform: `translate(-50%, -50%) scale(${interpolate(pop, [0, 1], [0.82, 1]) * slow})`, transformOrigin: "55% 45%" }}>
        <Img src={staticFile("reel8_savings_card.png")} style={{ width: "100%", display: "block", borderRadius: 20, boxShadow: "0 16px 40px rgba(0,0,0,0.45)" }} />
      </div>
    </div>
  );
};

// 요리 모드: 소리로 읽어 주고 있다는 스피커 표시(음파가 번갈아 켜진다)
const SpeakerBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const wave = (i: number) => 0.35 + 0.65 * Math.max(0, Math.sin((frame / 30) * Math.PI * 2.2 - i * 0.9));
  return (
    <div style={{ position: "absolute", top: 292, right: 70, width: 104, height: 104, borderRadius: 52, backgroundColor: INK, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px rgba(26,26,30,0.3)" }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M8 24h10l14-11v38L18 40H8z" fill="#fff" />
        <path d="M40 24c3 3 3 13 0 16" stroke="#FFD600" strokeWidth="4" strokeLinecap="round" opacity={wave(0)} />
        <path d="M46 18c6 7 6 21 0 28" stroke="#FFD600" strokeWidth="4" strokeLinecap="round" opacity={wave(1)} />
        <path d="M52 12c9 11 9 29 0 40" stroke="#FFD600" strokeWidth="4" strokeLinecap="round" opacity={wave(2)} />
      </svg>
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

const Intro: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: WHITE }}>
    <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <AppIcon size={200} />
    </div>
    <RevealText top={860} delay={4} size={86}>
      냉장고 앱 하나로
    </RevealText>
    <RevealText top={985} delay={14} size={86}>
      <span style={{ color: "#D99A00" }}>이 8가지</span>가 다 돼요
    </RevealText>
  </AbsoluteFill>
);

export const ReelOverview: React.FC = () => {
  useCustomFont();
  let cursor = INTRO;
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
      <Sequence from={0} durationInFrames={INTRO} name="Intro">
        <Intro />
      </Sequence>
      {SEGS.map((s, i) => {
        const from = cursor;
        const total = segLen(s);
        cursor += total;
        let acc = 0;
        return (
          <Sequence key={s.label} from={from} durationInFrames={total} name={`${i + 1}-${s.label}`}>
            <AbsoluteFill style={{ backgroundColor: WHITE }}>
              {s.parts.map((p, k) => {
                const start = acc;
                const len = partLen(p);
                acc += len;
                return (
                  <Sequence key={k} from={start} durationInFrames={len}>
                    {p.kind === "clip" ? <Clip part={p} len={len} /> : p.kind === "photos" ? <PhotoShots len={len} /> : p.kind === "savings" ? <SavingsZoom len={len} /> : <PushScene len={len} />}
                  </Sequence>
                );
              })}
              <FeatureTag index={i} label={s.label} len={total} />
              {s.speaker && <SpeakerBadge />}
              <Caption from={4} len={total - 6} text={s.caption} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Sequence from={cursor} durationInFrames={CTA_LEN} name="CTA">
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
