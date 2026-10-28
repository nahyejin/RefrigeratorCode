import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { WHITE, useCustomFont, FONT_FAMILY } from "./shared";
import { RestFeatures, restLen, REST_EXCL } from "./RestFeatures";
import { Reel2Cta, REEL2_CTA_LEN } from "./Reel2Match";
import { Reel7Cta, REEL7_CTA_LEN } from "./Reel7RealRecipe";

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
// focus: 원본 앱 화면에서 강조할 지점(가로·세로 비율 0~1), zoom→zoomTo: 그 지점으로 다가가는 배율(기존 기능 영상의 확대 강조와 같은 역할)
type Overlay = { at: number; len: number; src: string; from: number; rate?: number; img?: string; srcW?: number; focus?: [number, number]; zoom?: number; zoomTo?: number };
// speed: 출연자 영상을 ffmpeg 로 미리 빨리 돌린 배속(파일은 src). phrases·overlays·len 은 1배속 기준 숫자를 그대로 쓰고 코드가 speed 로 나눈다.
type TalkSpec = { src: string; len: number; speed?: number; title: string; phrases: Phrase[]; overlays: Overlay[] };

// 01 레시피 매칭 — 「요리할수록 돈이 더 드는 이유」(출연자 W). 클립 경계: 0–9.85 / 9.85–19.30 / 19.30–29.25
// 말 자막 시각은 Whisper(medium) 단어 시각 실측(클립 2는 −0.2s, 클립 3은 −0.08s 잘라 낸 만큼 당김).
const T1 = 9.85;
const T2 = 19.3;
const TALK01: TalkSpec = {
  // 사용자 요청(2026-10-24): 이 편만 말이 너무 느려서 1.25배속(음 높이 유지, talk01_presenter_x125.mp4). 다음 편부터는 프롬프트에서 빠르게 말하게 했다.
  src: "talk01_presenter_x125.mp4",
  len: 29.25,
  speed: 1.25,
  title: "요리할수록\n돈이 더 드는 이유",
  phrases: [
    [0.25, 1.14, "요리할수록"], [1.14, 2.36, "돈이 더 드는 사람"], [2.36, 3.76, "이유가 딱 하나예요"],
    [3.76, 4.82, "재료를 요리마다"], [4.82, 5.92, "새로 사거든요"], [5.92, 7.0, "한 번 쓰고 남은 건"],
    [7.0, 8.26, "버리고 또 사고"], [8.26, 9.14, "그러니까 배달보다"], [9.14, 9.85, "비싸요"],
    [T1 + 0.12, T1 + 1.0, "저도 그래서"], [T1 + 1.0, T1 + 2.68, "요리를 아예 놓았었어요"],
    [T1 + 3.08, T1 + 4.1, "맛없고 비싸고"], [T1 + 4.1, T1 + 5.28, "힘드니까요"],
    [T1 + 5.46, T1 + 6.5, "그러다 남은 재료부터"], [T1 + 6.5, T1 + 7.52, "쓰게 해 주는 앱을"],
    [T1 + 7.52, T1 + 8.2, "찾았는데"], [T1 + 8.2, T1 + 9.45, "그게 쿡매치예요"],
    [T2 + 0.06, T2 + 1.96, "냉장고 재료를 담아 두면"], [T2 + 1.96, T2 + 3.06, "지금 있는 재료로"], [T2 + 3.06, T2 + 3.6, "만들 수 있는"],
    [T2 + 3.6, T2 + 4.52, "요리가"], [T2 + 4.52, T2 + 5.7, "몇 퍼센트 맞는지까지"], [T2 + 5.7, T2 + 7.1, "순서대로 떠요"],
    [T2 + 7.22, T2 + 8.08, "한두 개 없으면"], [T2 + 8.08, T2 + 9.6, "있는 재료로 바꿔 주고요"],
  ],
  // 기능 설명(클립 3) 동안 매칭 화면 — 기존 02 매칭 기능 영상에서 확대해 보여 주던 부분을 그대로 살림(사용자 요청 2026-10-24):
  //   「담아 두면 … 만들 수 있는」 매칭률 범위 60~99% 확대 → 「요리가 몇 퍼센트 맞는지까지 순서대로」 결과 목록의 「내 재료 5/6 (92%)」 확대
  //   → 「한두 개 없으면 있는 재료로 바꿔 주고요」 대체 재료 칩 「들기름 → 참기름」 크게 확대.
  // 정지 화면(원본에서 뽑은 프레임) 위로 강조 지점에 천천히 다가간다 — 영상 재생은 스크롤 위치가 흔들려 강조 지점이 빠져나갔다.
  // 한 장의 카드 안에서 앱 사용 흐름대로 이어 간다(사용자 2026-10-24): 내 냉장고 화면 → 매칭률 필터 조정 → 매칭률 높은 순 결과 스크롤
  // → 대체 재료 배지로 천천히 확대. 카드끼리는 바로 이어 붙여(페이드 없이) 한 화면처럼 보이게 한다.
  overlays: [
    { at: T2 + 0.15, len: 1.95, src: "reel1_photo_done_new.mp4", from: 9.0, rate: 1.0 },
    { at: T2 + 2.1, len: 2.5, src: "reel2_matching_demo_new.mp4", from: 7.0, rate: 1.2, focus: [0.5, 0.44], zoom: 1.0, zoomTo: 1.12 },
    { at: T2 + 4.6, len: 2.6, src: "reel2_matching_demo_new.mp4", from: 12.0, rate: 1.5 },
    { at: T2 + 7.2, len: 2.75, src: "", img: "talk_match_20.6.png", from: 0, focus: [0.2, 0.67], zoom: 1.0, zoomTo: 1.6 },
  ],
};

// 02 검증된 레시피 — 「아이 저녁, 결국 김에 밥 먹인 날」(출연자 02). 클립 경계 0–9.80 / 9.80–19.36 / 19.36–29.32, 1.25배속.
// 마지막 「안 쓸 이유가 없어요」는 제미나이 클립이 10초에서 잘라 들어 있지 않다.
const U1 = 9.8;
const U2 = 19.36;
const TALK02: TalkSpec = {
  src: "talk02_presenter_x130.mp4", // 1.3배속(사용자 2026-10-25: 1.25는 느리고 1.35는 너무 빠름)
  len: 29.32,
  speed: 1.3,
  title: "아이 저녁,\n결국 김에 밥 먹인 날",
  phrases: [
    [0.0, 1.9, "아이가 배고프다고 해서"], [1.9, 3.06, "저녁을 시작했어요"], [3.32, 4.18, "근데 레시피 찾고"],
    [4.18, 5.3, "읽고 따라 하다 보니까"], [5.3, 7.26, "한 시간이 훌쩍 가는 거예요"], [7.68, 8.46, "애는 울고불고"],
    [8.46, U1 - 0.05, "저도 같이 울고 싶고"], [U1 + 0.05, 11.44, "결국 어떻게 됐냐면요"], [11.58, 12.84, "김에 밥 싸 줬어요"],
    [13.06, 14.5, "한 시간 걸려 만든 요리는"], [14.5, 16.04, "아무도 안 먹고요"], [16.42, 17.52, "배고픈 애 앞에서는"],
    [17.52, 19.22, "빨리 되는 게 최고더라고요"], [19.58, 21.06, "요즘은 쿡매치에서"], [21.06, 22.0, "검증된 레시피 중에"],
    [22.0, 23.04, "빨리 되는 걸 골라요"], [23.16, 24.14, "순서만 딱 정리돼 있어서"], [24.14, 25.18, "금방 해요"],
    [25.52, 27.08, "무료로 시작할 수 있으니까"], [27.08, 28.9, "지금 한번 써 보세요"],
  ],
  // 앱 쓰는 순서: 냉장고요리 목록 → 정렬 「인기순」 → 인기 레시피 결과 → 레시피 상세(재료·순서 요약)로 천천히 살짝 확대.
  // 무료 안내 대사(25.5초~)에서는 카드를 내리고 얼굴을 보여 준다.
  overlays: [
    { at: U2 + 0.15, len: 2.0, src: "reel7_sort_demo_new.mp4", from: 0.0, rate: 1.0 },
    { at: U2 + 2.15, len: 1.6, src: "reel7_sort_demo_new.mp4", from: 2.0, rate: 0.8 },
    { at: U2 + 3.75, len: 2.35, src: "reel7_recipe_demo.mp4", srcW: 880, from: 18.0, rate: 1.0, focus: [0.5, 0.5], zoom: 1.0, zoomTo: 1.2 },
  ],
};

// 02 다시 찍음(2026-10-28 「너무 작위적」 → 일반인 차림·평소 말투·말로 하는 권유 없음) — 「딸 저녁, 결국 김에 밥 먹인 날」.
// 클립 경계 0–9.48 / 9.48–18.60 / 18.60–27.52, 1.4배속. 클립 3의 버벅임 「정리돼, 정리돼」에서 앞의 것(원본 23.79–24.36)을 잘라 낸 talk02b_presenter_cut.mp4 기준(사용자 2026-10-29). 끝에 권유 대사가 없어서 「있어서 이제 금방 해요」는 카드를 내리고 얼굴로 끝낸다.
const V1 = 9.48;
const V2 = 18.6;
const TALK02B: TalkSpec = {
  src: "talk02b_presenter_x140.mp4", // 1.4배속(사용자 2026-10-29: 1.3은 너무 느림 — 평소 말투 클립이라 예전보다 더 올린다)
  len: 27.52,
  speed: 1.4,
  title: "한 시간 요리하고\n결국 김에 밥", // 훅(2026-10-29 사용자: 「딸 저녁, 김에 밥 먹인 날」은 공감이 안 됨) — 반전·현실 직시형
  phrases: [
    [0.0, 1.52, "딸이 배고프다고"], [1.52, 3.74, "해서 저녁을 시작했어요"], [4.3, 6.22, "레시피 찾고 읽고"],
    [6.22, 7.76, "따라 하다 보니까"], [7.76, V1 - 0.04, "한 시간이 가더라고요"], [9.78, 10.4, "애는 울고"],
    [10.4, 12.46, "저도 울고 싶고"], [12.46, 13.62, "결국 김에 밥"], [13.62, 14.86, "싸 줬어요"],
    [15.28, 16.28, "한 시간 걸린 그"], [16.28, 17.82, "요리는 아무도"], [17.82, V2 - 0.02, "안 먹었고요"],
    [18.94, 20.34, "요즘은 쿡매치에서"], [20.34, 22.08, "빨리 되는 레시피부터 봐요"], [23.02, 24.25, "순서만 딱 정리돼"],
    [24.25, 26.47, "있어서 이제 금방 해요"],
  ],
  // 앱 쓰는 순서(이전 02와 같음): 정렬 「인기순」 → 인기 레시피 결과 → 레시피 상세(재료·순서 요약)로 천천히 살짝 확대.
  overlays: [
    { at: V2 + 0.15, len: 2.0, src: "reel7_sort_demo_new.mp4", from: 0.0, rate: 1.0 },
    { at: V2 + 2.15, len: 1.6, src: "reel7_sort_demo_new.mp4", from: 2.0, rate: 0.8 },
    { at: V2 + 3.75, len: 2.85, src: "reel7_recipe_demo.mp4", srcW: 880, from: 18.0, rate: 0.85, focus: [0.5, 0.5], zoom: 1.0, zoomTo: 1.2 },
  ],
};

const SHOW_TITLE = false;

const Title: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", top: 150, left: 40, right: 40, textAlign: "center", fontFamily: SANS }}>
    <span style={{ whiteSpace: "pre-line", fontSize: 78, fontWeight: 800, lineHeight: 1.22, color: WHITE, letterSpacing: "-0.01em", textShadow: SHADOW }}>{text}</span>
  </div>
);

// 말 자막은 항상 한 줄(사용자: 줄바꿈 애매하게 하지 말 것). 한글 한 글자 ≈ 글자 크기 폭이라 13자를 넘으면 크기를 줄인다.
const Said: React.FC<{ text: string }> = ({ text }) => {
  const size = Math.min(76, Math.floor(1000 / Math.max(1, text.replace(/\s/g, "").length + text.split(" ").length * 0.3)));
  return (
    <div style={{ position: "absolute", top: 1190, left: 20, right: 20, textAlign: "center", fontFamily: SANS }}>
      <span style={{ fontSize: size, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em", whiteSpace: "nowrap", textShadow: SHADOW }}>{text}</span>
    </div>
  );
};

// 얼굴 위 가운데 앱 화면 카드(참고 영상처럼 화면 너비의 약 56%). 앱 화면 녹화(940×1920)를 카드 폭에 맞춰 놓고,
// focus 지점이 카드 가운데 오도록 옮긴 뒤 zoom → zoomTo 로 천천히 다가간다(카드 밖으로 빈 곳이 보이지 않게 가장자리에서 멈춤).
const CARD_W = 600;
const CARD_H = 780;
const SRC_AR = 1920 / 940;
const AppCard: React.FC<{ o: Overlay; fadeIn?: boolean; fadeOut?: boolean }> = ({ o, fadeIn = true, fadeOut = true }) => {
  const frame = useCurrentFrame();
  const len = f(o.len);
  const op = Math.min(fadeIn ? interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1, fadeOut ? interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1);
  const sc = fadeIn ? interpolate(frame, [0, 8], [0.94, 1], { extrapolateRight: "clamp" }) : 1;
  const z = interpolate(frame, [0, len], [o.zoom ?? 1, o.zoomTo ?? o.zoom ?? 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const [fx, fy] = o.focus ?? [0.5, 0.2];
  const w = CARD_W * z;
  const h = CARD_W * (o.srcW ? 1920 / o.srcW : SRC_AR) * z;
  const left = Math.min(0, Math.max(CARD_W - w, CARD_W / 2 - fx * w));
  const top = Math.min(0, Math.max(CARD_H - h, CARD_H / 2 - fy * h));
  return (
    <div style={{ position: "absolute", left: (1080 - CARD_W) / 2, top: 360, width: CARD_W, height: CARD_H, borderRadius: 26, overflow: "hidden", opacity: op, transform: `scale(${sc})`, boxShadow: "0 18px 50px rgba(0,0,0,0.45)", background: "#fff" }}>
      {o.img ? (
        <Img src={staticFile(o.img)} style={{ position: "absolute", left, top, width: w, height: h, maxWidth: "none", maxHeight: "none" }} />
      ) : (
        <OffthreadVideo src={staticFile(o.src)} muted trimBefore={f(o.from)} playbackRate={o.rate ?? 1}
          style={{ position: "absolute", left, top, width: w, height: h, maxWidth: "none", maxHeight: "none" }} />
      )}
    </div>
  );
};


// 셀카 말하는 동안 계속 떠 있는 검색 안내(사용자 2026-10-25). 릴스는 아래쪽(왼쪽 아이디·본문, 오른쪽 좋아요 아이콘, 유료 광고의 「더 알아보기」 막대)이
// 가려지므로 맨 위 제목 바로 아래(안전 영역)에 둔다. 유료 홍보용은 끈 버전(Clean)을 같이 만든다.
// 끝 화면(CtaOutro)의 검색창 디자인을 작게 줄인 것 — 회색 안내 한 줄 + 작은 「🔍 쿡매치」 검색창 + 회색 글자 「프로필 링크에서도 시작할 수 있어요」(사용자 2026-10-25: 배지 말고 작게)
const MUTED = "#FFFFFF";
const SHADOW_STRONG = "0 2px 8px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)";
// 위치: 아래 가운데(사용자 2026-10-25 최종). 아래 아이디·본문 줄보다 위.
const SearchBanner: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: FONT_FAMILY }}>
    <div style={{ fontSize: 32, fontWeight: 700, color: MUTED, textShadow: SHADOW_STRONG, whiteSpace: "nowrap" }}>앱스토어·플레이스토어에서 검색하세요</div>
    <div style={{ width: 360, height: 68, borderRadius: 999, border: "2px solid #1A1A1E", background: WHITE, display: "flex", alignItems: "center", gap: 14, padding: "0 26px", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
      <svg width="32" height="32" viewBox="0 0 46 46" fill="none">
        <circle cx="19" cy="19" r="13" stroke="#1A1A1E" strokeWidth="5" />
        <line x1="29" y1="29" x2="41" y2="41" stroke="#1A1A1E" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 38, fontWeight: 700, color: "#1A1A1E" }}>쿡매치</div>
    </div>
    <div style={{ fontSize: 29, fontWeight: 600, color: MUTED, textShadow: SHADOW_STRONG, whiteSpace: "nowrap" }}>프로필 링크에서도 시작할 수 있어요</div>
  </div>
);

const Talk: React.FC<{ s: TalkSpec; banner?: boolean }> = ({ s, banner }) => {
  const frame = useCurrentFrame();
  const k = 1 / (s.speed ?? 1);
  const total = f(s.len * k);
  const fade = interpolate(frame, [total - FADE, total - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: WHITE }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <OffthreadVideo src={staticFile(s.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {s.overlays.map((o, i) => (
          <Sequence key={i} from={f(o.at * k)} durationInFrames={f(o.len * k) + 1}>
            <AppCard o={{ ...o, len: o.len * k }}
              fadeIn={!(i > 0 && Math.abs(s.overlays[i - 1].at + s.overlays[i - 1].len - o.at) < 0.05)}
              fadeOut={!(i < s.overlays.length - 1 && Math.abs(o.at + o.len - s.overlays[i + 1].at) < 0.05)} />
          </Sequence>
        ))}
        {/* 위 제목 자막은 모든 편에서 뺀다(2026-10-29 사용자). title 은 인스타 본문 첫 줄·문서용으로만 남긴다. */}
        {SHOW_TITLE && <Title text={s.title} />}
        {/* 검색 안내는 기능 설명이 시작되는 클립 3(약 20초)부터 끝까지(사용자 2026-10-25) */}
        {banner && (
          <Sequence from={f(s.overlays[0].at * k) - 4}>
            <SearchBanner />
          </Sequence>
        )}
        {s.phrases.map(([a, b, t], i) => {
          // 다음 구절이 바로 이어지면 끝까지 붙여 깜빡임이 없게
          const next = s.phrases[i + 1];
          const end = next && next[0] - b < 0.35 ? next[0] : b + 0.15;
          return (
            <Sequence key={i} from={f(a * k)} durationInFrames={Math.max(1, f(end * k) - f(a * k))}>
              <Said text={t} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const make = (s: TalkSpec, Cta: React.FC<{ silent?: boolean }>, ctaLen: number, restIdx: number, banner = true) => {
  const tLen = f(s.len / (s.speed ?? 1));
  const rLen = restLen(restIdx, true);
  const Comp: React.FC = () => {
    useCustomFont();
    return (
      <AbsoluteFill style={{ backgroundColor: WHITE, fontFamily: FONT_FAMILY }}>
        <Sequence from={0} durationInFrames={tLen} name="Talk">
          <Talk s={s} banner={banner} />
        </Sequence>
        <Sequence from={tLen} durationInFrames={ctaLen} name="CTA">
          <Cta />
        </Sequence>
        <Sequence from={tLen + ctaLen} durationInFrames={rLen} name="Rest">
          <RestFeatures excl={restIdx} badges />
        </Sequence>
        <Sequence from={tLen + ctaLen + rLen} durationInFrames={CTA2_LEN} name="CTA-again">
          <Cta silent />
        </Sequence>
      </AbsoluteFill>
    );
  };
  return { Comp, total: tLen + ctaLen + rLen + CTA2_LEN };
};

// 편마다 두 벌: 하단 검색 안내 있음(일반 게시) / 없음(Clean — 인스타 유료 홍보용)
export const REELS_TALK = [
  { id: "Talk01Matching", ...make(TALK01, Reel2Cta, REEL2_CTA_LEN, REST_EXCL[1]) },
  { id: "Talk01MatchingClean", ...make(TALK01, Reel2Cta, REEL2_CTA_LEN, REST_EXCL[1], false) },
  { id: "Talk02Recipe", ...make(TALK02, Reel7Cta, REEL7_CTA_LEN, REST_EXCL[6]) },
  { id: "Talk02RecipeClean", ...make(TALK02, Reel7Cta, REEL7_CTA_LEN, REST_EXCL[6], false) },
  { id: "Talk02Kim", ...make(TALK02B, Reel7Cta, REEL7_CTA_LEN, REST_EXCL[6]) },
  { id: "Talk02KimClean", ...make(TALK02B, Reel7Cta, REEL7_CTA_LEN, REST_EXCL[6], false) },
];
