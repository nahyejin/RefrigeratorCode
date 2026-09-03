/**
 * AI 사용량(주간 한도) 조회 — 화면 세 곳이 같은 값을 쓰도록 한 곳에 모아 둔다.
 *
 * 표시 자리가 셋이다(아이콘 배지 / 시트·챗 헤더 / 마이페이지). 각자 따로 불러오면
 * 같은 화면에서 서로 다른 숫자가 보이는 일이 생기므로, **한 번 불러온 값을 공유하고
 * 바뀌면 함께 갱신**한다.
 *
 * 서버 계산은 `backend/usage_quota.py` 한 곳에만 있다. 프론트는 그 값을 받아
 * 보여주기만 하고 **직접 계산하지 않는다** — 두 곳에서 세면 반드시 어긋난다.
 */

export interface Usage {
  plan: 'guest' | 'free' | 'plus' | string;
  /**
   * 남은 크레딧.
   *
   * 매주 채워 주는 한도가 아니라 **잔액**이다. 가입할 때 받고, 매주 조금씩
   * 더 받고, 모자라면 충전한다. 쓰면 줄어들고 저절로 원상복구되지 않는다.
   */
  balance: number;
  granted: number;
  used: number;
  daily_cap: number;
  daily_used: number;
  daily_remaining: number;
  /** 비회원은 AI 를 못 쓴다. 화면은 이 값 하나만 보면 된다. */
  can_use_ai: boolean;
  is_guest: boolean;
  weekly_credits: number;
  signup_credits: number;
  /** 비회원 체험분 (기기당 한 번, 다시 안 채워짐) */
  guest_trial: number;
  /** 다음 주간 지급 시각 (ISO). 매주 월요일 00:00 KST */
  next_weekly_at: string;
  credits: { chat: number; vision: number };
}

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const DEVICE_KEY = 'cookmatch_device_id';

/**
 * 비회원을 세기 위한 기기 식별자.
 *
 * 캐시를 지우면 새로 만들어진다 — **완벽할 수 없고, 완벽할 필요도 없다.**
 * 비회원 한도는 남용을 막으려는 게 아니라 "가입하면 더 쓸 수 있다"를 말하기 위한
 * 것이다 (USAGE_QUOTA_PLAN.md 8절).
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // 시크릿 모드 등 localStorage 를 못 쓰는 경우. 이번 세션 동안만 유효한 값.
    return 'no-storage';
  }
}

/**
 * 저장된 로그인 토큰.
 *
 * ⚠️ 키 이름은 **`auth_token`** 이다. `token` 이 아니다.
 * AuthContext 가 로그인할 때 그 이름으로 넣고, 세션 유지가 켜져 있지 않으면
 * sessionStorage 쪽에 들어간다. 예전에 여기서 `token` 을 읽는 바람에 토큰이
 * 아예 안 실려 나갔고, 어드민 화면이 로그인해도 "권한이 없습니다" 로 막혔다.
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

/** AI 요청에 함께 보낼 헤더. 로그인 토큰이 있으면 서버가 그쪽을 우선한다. */
export function usageHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'X-Device-Id': getDeviceId() };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// ── 공유 상태 ────────────────────────────────────────────────
let cached: Usage | null = null;
let inflight: Promise<Usage | null> | null = null;
const listeners = new Set<(u: Usage | null) => void>();

function publish(next: Usage | null) {
  cached = next;
  listeners.forEach(fn => {
    try {
      fn(next);
    } catch {
      /* 구독자 하나가 터져도 나머지는 갱신되어야 한다 */
    }
  });
}

export function getCachedUsage(): Usage | null {
  return cached;
}

/** 서버가 응답에 실어 보낸 최신 사용량을 반영한다 (재조회 없이 즉시 갱신). */
export function applyUsage(usage: Usage | null | undefined) {
  if (usage && typeof usage.balance === 'number') publish(usage);
}

/** 사용량을 불러온다. 같은 시점에 여러 곳이 불러도 요청은 한 번만 나간다. */
export function refreshUsage(): Promise<Usage | null> {
  if (inflight) return inflight;
  inflight = fetch(`${API_BASE_URL}/api/usage`, { headers: usageHeaders() })
    .then(res => (res.ok ? res.json() : null))
    .then((data: Usage | null) => {
      if (data && typeof data.balance === 'number') publish(data);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function subscribeUsage(fn: (u: Usage | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * 남은 비율 0~1. 잔액과 하루 상한 중 **더 빠듯한 쪽**을 쓴다 — 실제로 막히는 쪽이다.
 *
 * 잔액에는 "최대치" 가 없으므로(충전하면 늘어난다) 가입 지급분을 기준으로 잡는다.
 * 정확한 비율이 아니라 **배지를 띄울지 말지**를 정하는 데만 쓰이는 값이다.
 */
export function remainingRatio(u: Usage | null): number {
  if (!u) return 1;
  const base = Math.max(1, u.is_guest ? (u.guest_trial || 5) : (u.signup_credits || 30));
  const byBalance = Math.min(1, u.balance / base);
  const byDaily = u.daily_cap > 0 ? u.daily_remaining / u.daily_cap : 1;
  return Math.max(0, Math.min(byBalance, byDaily));
}

/** 아이콘에 배지를 띄울 만큼 부족한가 (20% 이하). */
export function isLow(u: Usage | null): boolean {
  return !!u && remainingRatio(u) <= 0.2;
}

/** "9월 7일 월요일" 처럼 다음 주간 지급 시점을 사람 말로. */
export function resetLabel(u: Usage | null): string {
  if (!u?.next_weekly_at) return '';
  const d = new Date(u.next_weekly_at);
  if (isNaN(d.getTime())) return '';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

// ── 한도 추가 요청 ────────────────────────────────────────────
//
// 결제를 붙이지 않기로 했으므로, 더 필요한 사람은 관리자에게 말하고 관리자가
// 손으로 올려 준다 (USAGE_QUOTA_PLAN.md 6절). 부수 효과가 더 중요하다 —
// **실제 수요가 있는지 측정된다.**

/** 이미 접수된 요청이 있는지. 로그인 안 했으면 false. */
export async function hasPendingRequest(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/usage/request`, { headers: usageHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.pending;
  } catch {
    return false;
  }
}

/** 요청을 남긴다. 이미 대기 중이면 새로 만들지 않고 그 사실을 알려 준다. */
export async function requestMoreUsage(message: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/usage/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...usageHeaders() },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, text: data?.error || '요청을 남기지 못했어요.' };
    return { ok: true, text: data?.message || '요청을 남겼어요.' };
  } catch {
    return { ok: false, text: '네트워크 상태를 확인하고 다시 시도해 주세요.' };
  }
}
