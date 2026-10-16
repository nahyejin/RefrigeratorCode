/**
 * 레시피 카드 「공유」 — 가족 그룹이 있으면 「링크 복사 / 가족에게 보내기」를 고르게 한다(2026-10-16 사용자 요청).
 *
 * 그룹이 없거나(또는 나 혼자) 로그인 안 했으면 예전 그대로 화면별 공유(링크 복사)를 바로 부른다.
 * 고르는 창은 앱에 하나만 띄워 두고(RecipeShareHost) 카드는 여기로 말만 한다 — cookMode 와 같은 방식.
 */

export interface ShareTarget {
  id: number;
  title?: string;
  link?: string;
  /** 링크 복사 — 화면마다 원래 하던 공유(토스트 포함)를 그대로 부른다 */
  copyLink: () => void;
}

export interface HouseholdMember { id: number; nickname: string }

type Listener = (t: ShareTarget | null) => void;
let current: ShareTarget | null = null;
const listeners = new Set<Listener>();

export function subscribeShare(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => { listeners.delete(fn); };
}
export function closeShare() {
  current = null;
  listeners.forEach(fn => fn(null));
}

export function apiBase(): string {
  return (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';
}
export function authToken(): string | null {
  try { return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'); } catch { return null; }
}

// 그룹 정보는 잠깐(3분) 기억한다 — 공유를 누를 때마다 서버에 묻지 않게
let cache: { at: number; userKey: string; me: number | null; members: HouseholdMember[] } | null = null;

export async function getHouseholdOthers(): Promise<{ me: number | null; others: HouseholdMember[] }> {
  const token = authToken();
  if (!token) return { me: null, others: [] };
  if (cache && cache.userKey === token && Date.now() - cache.at < 3 * 60 * 1000) {
    return { me: cache.me, others: cache.members.filter(m => m.id !== cache!.me) };
  }
  let me: number | null = null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    me = Number(payload.user_id) || null;
  } catch { /* 토큰 모양이 다르면 아래에서 그룹만 본다 */ }
  try {
    const res = await fetch(`${apiBase()}/api/households/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { me, others: [] };
    const data = await res.json();
    const members: HouseholdMember[] = data?.in_household ? (data.members || []).map((m: any) => ({ id: m.id, nickname: m.nickname || '식구' })) : [];
    cache = { at: Date.now(), userKey: token, me, members };
    return { me, others: members.filter(m => m.id !== me) };
  } catch {
    return { me, others: [] };
  }
}

/** 카드의 공유 버튼이 부른다. 보낼 식구가 있으면 고르는 창, 없으면 바로 링크 복사. */
export async function requestShare(target: ShareTarget) {
  const { others } = await getHouseholdOthers();
  if (others.length === 0) {
    target.copyLink();
    return;
  }
  current = target;
  listeners.forEach(fn => fn(current));
}

export async function sendRecipeToFamily(recipeId: number, toUserIds: number[]) {
  const token = authToken();
  const res = await fetch(`${apiBase()}/api/households/share-recipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ recipe_id: recipeId, to_user_ids: toUserIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '보내지 못했어요');
  return data as { recipients: { id: number; nickname: string; delivered: number }[] };
}
