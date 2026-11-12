// 기능영상 v2 꼬리 — 장면표(2026-11-12). 시각은 전부 「원본 녹화 파일(public/feature_v2/demo_*.mp4)의 초」.
// 원본 앞 3~4초는 앱이 새로고침되는 로딩이라(녹화 시작 → 타임라인 시작 사이) 각 장면 from 은 그 뒤에서 잡는다.
// rate > 1 이면 빨리 감기(기다리는 구간·타이핑을 줄임). zoom/zoomTo 는 카드 안에서 1.0→N배로 천천히 다가감.

export type TailSeg = { src?: string; from: number; to: number; rate?: number; zoom?: number; zoomTo?: number; origin?: string };
export type TailScene = {
  key: string;
  bg: "black" | "yellow";
  ai: boolean;
  headline: string;
  segs: TailSeg[];
  narr?: string;
  narrAt?: number; // 장면 시작 뒤 프레임(기본 9 = 0.3초)
  still?: string; // 정지 화면 장면(가족)
  minFrames?: number; // 나레이션이 더 길면 마지막 화면을 늘려 채운다
};

const FPS = 30;
export const segFrames = (g: TailSeg) => Math.round(((g.to - g.from) / (g.rate ?? 1)) * FPS);
export const sceneLen = (s: TailScene) => Math.max(s.segs.reduce((a, g) => a + segFrames(g), 0), s.minFrames ?? 0);

const D = (k: string) => `feature_v2/demo_${k}.mp4`;

// 스토어 v3 헤드라인(store/STORE_LISTING.md 「2026-11-08 최종 순서」)을 그대로 쓴다. 노랑/검정 번갈아.
export const TAIL_SCENES: TailScene[] = [
  {
    key: "a_match", bg: "black", ai: false, headline: `재료 매칭률 높은 순으로
만들 수 있는 요리 찾기`, narr: "a_match",
    segs: [
      { src: D("match"), from: 3.6, to: 4.8 },
      { src: D("match"), from: 5.6, to: 11.0, rate: 1.7 },
      { src: D("match"), from: 11.6, to: 16.2, rate: 1.4 },
    ],
  },
  {
    key: "b_pick", bg: "yellow", ai: true, headline: `물어보면 레시피부터
식단까지 척척`, narr: "b_pick",
    segs: [
      { src: D("pick"), from: 5.9, to: 7.6, rate: 1.2 },
      { src: D("pick"), from: 8.3, to: 10.3, rate: 1.3 },
      { src: D("pick"), from: 10.3, to: 13.3, rate: 3 },
      { src: D("pick"), from: 13.4, to: 17.6, rate: 1.3 },
    ],
  },
  {
    key: "b_plan", bg: "yellow", ai: true, headline: `물어보면 레시피부터
식단까지 척척`, narr: "b_plan",
    segs: [
      { src: D("plan"), from: 5.8, to: 7.6 },
      { src: D("plan"), from: 7.6, to: 11.0, rate: 2.5 },
      { src: D("plan"), from: 11.4, to: 15.4, rate: 1.2 },
    ],
  },
  {
    key: "c_coach", bg: "black", ai: true, headline: `재료 대체부터 계량까지
쿡 코치가 다 답해요`, narr: "c_coach",
    segs: [
      { src: D("coach"), from: 13.8, to: 16.4, zoom: 1.0, zoomTo: 1.35, origin: "12% 62%" },
      { src: D("coach"), from: 17.0, to: 19.8, rate: 1.5 },
      { src: D("coach"), from: 19.8, to: 24.6, rate: 1.2 },
    ],
  },
  {
    key: "d_photo", bg: "yellow", ai: true, headline: `사진 한 장으로
재료 등록 끝`, narr: "d_photo",
    segs: [
      { src: D("photo"), from: 5.8, to: 9.0, rate: 1.6 },
      // 9.2~16.6초는 안드로이드 시스템 사진 선택기(영어 화면) — 광고에 안 쓰고 건너뜀
      { src: D("photo"), from: 16.8, to: 20.6, rate: 1.9 },
      { src: D("photo"), from: 20.8, to: 24.6 },
    ],
  },
  {
    key: "e_expiry", bg: "black", ai: false, headline: `소비기한은 자동으로
곧 상할 재료부터 먼저`, narr: "e_expiry",
    segs: [
      { src: D("expiry"), from: 6.2, to: 7.8, rate: 1.3 },
      { src: D("expiry"), from: 9.2, to: 14.7, rate: 2.0 },
      { src: D("expiry"), from: 15.0, to: 17.4, zoom: 1.0, zoomTo: 1.45, origin: "52% 46%" },
      { src: D("expiry"), from: 19.0, to: 22.0, rate: 1.2 },
    ],
  },
  {
    key: "f_listen", bg: "yellow", ai: false, headline: `단계별로 요약해서
손 안 대고 귀로 듣기`, narr: "f_listen",
    segs: [
      { src: D("listen"), from: 8.0, to: 10.6, rate: 1.5 },
      { src: D("listen"), from: 11.4, to: 12.8 },
      { src: D("listen"), from: 12.8, to: 19.5, rate: 1.5 },
    ],
  },
  {
    key: "g_family", bg: "black", ai: false, headline: `가족과 함께 쓰고
아낀 돈도 한눈에`, narr: "g_family",
    still: "feature_v2/family_still.png",
    segs: [{ from: 0, to: 5.8, zoom: 1.0, zoomTo: 1.2, origin: "50% 18%" }],
  },
];

export const TAIL_CTA_LEN = 150; // 5.0s
export const TAIL_TOTAL_FRAMES = TAIL_SCENES.reduce((a, s) => a + sceneLen(s), 0) + TAIL_CTA_LEN;
