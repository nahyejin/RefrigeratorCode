/**
 * 최근 본 레시피 — 레시피 패널(CookModeSheet)을 열어 본 기록을 이 기기에 쌓는다(2026-11-05 요청).
 *
 * 레시피를 여는 길은 전부 `openCookMode()` → 패널 하나로 모인다. 그래서 기록도 패널에서 **한 번만** 한다
 * (카드·인기·캘린더·챗봇·식단 어디서 열든 잡힌다). 패널에 내용이 뜬 뒤에 적는다 — 열자마자 닫은 건 「본 것」이 아니다.
 *
 * 비회원도 쓴다(기기에 저장). 로그아웃·다른 계정으로 바뀔 때는 즐겨찾기 등과 같이 AuthContext 가 지운다.
 * 계정에 묶어 다른 기기에서도 보이게 하려면 서버 저장이 따로 필요하다(지금은 이 기기만).
 */

const KEY = 'cookmatch_recent_recipes';
/** 이 기간이 지난 기록은 읽을 때 버린다 */
export const RECENT_DAYS = 60;
const MAX_ITEMS = 100;
export const RECENT_CHANGED_EVENT = 'recent-recipes-changed';

export interface RecentRecipe {
  id: number;
  title: string;
  link?: string;
  thumbnail?: string;
  /** 마지막으로 연 시각(ms) */
  at: number;
}

function load(): RecentRecipe[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const since = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    return raw.filter((r: any) => r && Number.isFinite(Number(r.id)) && Number(r.at) >= since);
  } catch {
    return [];
  }
}

/** 최근에 연 순서(맨 앞이 가장 최근). 2개월이 지난 건 빠진다. */
export function getRecentRecipes(): RecentRecipe[] {
  return load().sort((a, b) => b.at - a.at);
}

/** 같은 레시피를 또 열면 새로 쌓지 않고 맨 앞으로 올린다. */
export function recordRecentRecipe(r: Omit<RecentRecipe, 'at'>): void {
  if (!Number.isFinite(Number(r.id))) return;
  try {
    const rest = load().filter(x => Number(x.id) !== Number(r.id));
    const next = [{ ...r, id: Number(r.id), at: Date.now() }, ...rest].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RECENT_CHANGED_EVENT));
  } catch { /* 저장이 막힌 환경(사생활 보호 모드 등) — 기록만 못 남기고 화면은 그대로 */ }
}
