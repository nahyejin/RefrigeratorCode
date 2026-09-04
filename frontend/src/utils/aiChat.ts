import type { PlannedMeal } from './mealPlan';

/**
 * AI 식단 추천 **대화 이력**.
 *
 * 왜 남기나:
 *   이 대화는 크레딧을 쓴 결과다. 화면을 나갔다 오면 사라지는 게 맞지 않다 —
 *   "지난주에 뭐라고 물어봤더라", "그때 짜 준 게 뭐였지" 를 다시 물으려면
 *   크레딧을 또 써야 한다.
 *
 * 왜 서버가 아닌가:
 *   **비회원도 AI 를 써 볼 수 있다**(체험 크레딧). 서버에 두면 그 사람의 이력이
 *   갈 곳이 없다. 그리고 계획과 마찬가지로 이건 그 기기에서 보는 것이다.
 *
 * 무엇을 안 담나:
 *   레시피 전체를 담지 않는다. 화면에 다시 그릴 만큼(제목·썸네일·링크)만 담는다.
 *   본문까지 담으면 저장소가 금방 찬다.
 */

const KEY = 'cookmatch_ai_chat';
/** 남길 대화 수. 이보다 오래된 것은 지운다 — 무한히 쌓을 이유가 없다. */
const MAX = 40;
const KEEP_DAYS = 60;

export interface ChatDish {
  id: number;
  title: string;
  link?: string;
  thumbnail?: string;
  why?: string;
}

export interface ChatResult {
  /** 그 턴이 짜 준 식단 (날짜는 그때 기준) */
  dishes: ChatDish[];
  basket: string[];
  buyCount: number;
  days: number;
}

export interface ChatMsg {
  who: 'ai' | 'me';
  text: string;
  /** AI 턴이 내놓은 결과. 있으면 말풍선 안에 식단과 장바구니를 그린다. */
  result?: ChatResult;
  at: number;
}

export function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const since = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    return data
      .filter((m: any) => m && (m.who === 'ai' || m.who === 'me') && typeof m.text === 'string')
      .filter((m: any) => !m.at || m.at >= since)
      .slice(-MAX);
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMsg[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(messages.slice(-MAX)));
  } catch {
    /* 저장이 막혀 있으면 조용히 넘어간다 — 화면은 이미 보여 줬다 */
  }
}

/**
 * 지난 대화들.
 *
 * `새 대화` 를 누르면 지금 것을 여기로 **밀어 넣고** 비운다. 그냥 지우면
 * 크레딧을 쓴 결과가 사라진다.
 */
const PAST = 'cookmatch_ai_chat_past';
const MAX_SESSIONS = 10;

export interface ChatSession {
  id: string;
  at: number;
  /** 목록에 보일 한 줄 — 그 대화에서 **내가 처음 말한 조건**. */
  title: string;
  messages: ChatMsg[];
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(PAST);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
}

/** 지금 대화를 지난 목록으로 넘기고 비운다. 내가 말한 게 없으면 버린다. */
export function archiveChat(messages: ChatMsg[]): void {
  const mine = messages.find(m => m.who === 'me');
  try {
    if (mine) {
      const session: ChatSession = {
        id: String(Date.now()),
        at: Date.now(),
        title: mine.text.slice(0, 40),
        messages,
      };
      localStorage.setItem(PAST, JSON.stringify([session, ...loadSessions()].slice(0, MAX_SESSIONS)));
    }
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

export function dropSession(id: string): void {
  try {
    localStorage.setItem(PAST, JSON.stringify(loadSessions().filter(s => s.id !== id)));
  } catch {
    /* 무시 */
  }
}

export function clearChat(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

/** 대화에 담긴 식단을 계획에 넣을 모양으로. */
export function toPlanned(dishes: ChatDish[], dates: string[]): PlannedMeal[] {
  return dishes.slice(0, dates.length).map((d, i) => ({
    date: dates[i],
    recipeId: d.id,
    title: d.title,
    link: d.link,
    thumbnail: d.thumbnail,
    why: d.why,
  }));
}
