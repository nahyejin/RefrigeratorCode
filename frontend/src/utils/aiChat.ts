import type { PlannedMeal } from './mealPlan';
import { getAuthToken } from './usage';

/**
 * AI 식단 추천 **대화 이력**.
 *
 * 왜 남기나:
 *   이 대화는 크레딧을 쓴 결과다. 화면을 나갔다 오면 사라지는 게 맞지 않다 —
 *   "지난주에 뭐라고 물어봤더라", "그때 짜 준 게 뭐였지" 를 다시 물으려면
 *   크레딧을 또 써야 한다.
 *
 * 어디에 두나(2026-09-20 개정):
 *   기기 저장소가 먼저다 — **비회원도 AI 를 써 볼 수 있어서**(체험 크레딧) 서버만 쓰면
 *   그 사람의 이력이 갈 곳이 없다. 다만 **로그인한 사람의 "지난 대화"는 계정에 붙여 서버에도
 *   둔다**(`syncSessions`). 기기 기준이면 다른 기기·앱·웹에서 열 때 지난 대화가 통째로
 *   없고, "아이디별로 해야 한다"는 지적이 있었다. 지금 하고 있는 대화(`KEY`)는 아직
 *   이 기기 것이고, `새 대화`로 지난 목록에 넘어가면 그때부터 계정을 따라간다.
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
  // 로그인 상태면 계정에도 올린다(서버의 다른 기기 목록과 합쳐서). 화면은 기기 값으로 이미 그려졌다.
  if (mine) void syncSessions();
}

export function dropSession(id: string): void {
  try {
    localStorage.setItem(PAST, JSON.stringify(loadSessions().filter(s => s.id !== id)));
  } catch {
    /* 무시 */
  }
  void removeSessionFromServer(id);
}

// ── 계정 서버와 맞추기 ────────────────────────────────────────────────
// 서버 주소: `PUT/GET /api/users/me/ai-chat-sessions` (backend/app.py). 비회원·실패면 조용히 기기만 쓴다.

/** 마지막으로 서버와 맞춘 시각. 이보다 **오래된** 지난 대화가 서버에 없으면 다른 기기에서 지운 것이다. */
const SYNCED_AT = 'cookmatch_ai_chat_synced_at';

function apiBase(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

async function fetchServerSessions(): Promise<ChatSession[] | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${apiBase()}/api/users/me/ai-chat-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.sessions) ? data.sessions : null;
  } catch {
    return null;
  }
}

async function putServerSessions(list: ChatSession[]): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(`${apiBase()}/api/users/me/ai-chat-sessions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessions: list }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function writeLocalSessions(list: ChatSession[]): void {
  try {
    localStorage.setItem(PAST, JSON.stringify(list.slice(0, MAX_SESSIONS)));
  } catch {
    /* 무시 */
  }
}

/**
 * 지난 대화를 계정(서버)과 맞추고 합친 목록을 돌려준다. 비회원이거나 서버가 안 되면 기기 목록 그대로.
 *
 * 합치는 규칙:
 *   - 서버에 있는 것은 그대로 쓴다.
 *   - 이 기기에만 있는 것 중 **마지막으로 맞춘 뒤에 만든 것**은 서버에 올린다(오프라인·실패 때 만든 것).
 *   - 이 기기에만 있는데 **마지막으로 맞추기 전 것**이면 다른 기기에서 지운 것이니 버린다 —
 *     안 그러면 지운 대화가 오래된 기기에서 되살아난다.
 */
export async function syncSessions(): Promise<ChatSession[]> {
  const local = loadSessions();
  const server = await fetchServerSessions();
  if (server === null) return local;

  let syncedAt = 0;
  try { syncedAt = Number(localStorage.getItem(SYNCED_AT) || 0) || 0; } catch { /* 무시 */ }
  const serverIds = new Set(server.map(s => s.id));
  const localOnly = local.filter(s => !serverIds.has(s.id) && s.at > syncedAt);
  const merged = [...server, ...localOnly].sort((a, b) => b.at - a.at).slice(0, MAX_SESSIONS);

  writeLocalSessions(merged);
  if (localOnly.length > 0 || merged.length !== server.length) await putServerSessions(merged);
  try { localStorage.setItem(SYNCED_AT, String(Date.now())); } catch { /* 무시 */ }
  return merged;
}

/** 지난 대화 하나를 서버 목록에서도 지운다. */
async function removeSessionFromServer(id: string): Promise<void> {
  const server = await fetchServerSessions();
  if (server === null || !server.some(s => s.id === id)) return;
  await putServerSessions(server.filter(s => s.id !== id));
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
