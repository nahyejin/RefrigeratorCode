/**
 * 비회원이 로그인을 권유·요구받는 자리를 한 곳에 모은다(2026-10-22 사용자 확정 정책).
 *
 * 예전엔 재료 10개·기록/완료 5개마다 화면별로 제각각 「회원가입 유도」 팝업을 띄웠고(나중에를 눌러도
 * 저장됨), 즐겨찾기는 아무 안내가 없었다. 이제는
 *   · 재료(직접 담은 것)·즐겨찾기·기록·완료 각각 **3개까지** 자유, **4번째부터 로그인**(권유가 아니라 한도)
 *   · AI 체험(챗봇·식단·사진)을 다 쓰면 같은 확인창
 *   · 비회원이 2번째 이후 방문에서 한 화면 둘러본 뒤 1번(7일 쉼)
 * 이 전부를 **전역 확인창 하나**(`components/LoginGateHost`)가 띄운다. 어느 화면에서든
 * `openLoginGate(kind)` 만 부르면 된다.
 *
 * 비회원 여부는 로그인 토큰이 있는지로 본다(`getAuthToken`) — AuthContext 를 못 쓰는 유틸에서도 같은 판단을
 * 하려는 것이다.
 */
import { getAuthToken } from './usage';
import { track } from './track';

/** 비회원이 재료·즐겨찾기·기록·완료를 각각 자유롭게 담을 수 있는 개수 */
export const GUEST_SAVE_LIMIT = 3;

export type GateKind = 'ingredient' | 'favorite' | 'write' | 'done' | 'ai' | 'return';

export const GATE_EVENT = 'cookmatch:login-gate';

export interface GateDetail {
  kind: GateKind;
  /** ai 일 때: 가입하면 받는 크레딧(서버가 준 값). 없으면 30 */
  credits?: number;
}

export interface GateCopy {
  title: string;
  /** 본문 한 줄씩(줄바꿈 없이 짧게) */
  lines: string[];
  /** 굵게 따로 보이는 경고 줄 */
  warn?: string;
  dismiss: string;
}

const WARN = '로그인하지 않으면 사라질 수 있어요.';

export function gateCopy(kind: GateKind, credits = 30): GateCopy {
  switch (kind) {
    case 'ingredient':
      return {
        title: '재료는 3개까지만 가능해요',
        lines: ['더 담으려면 로그인해 주세요.', '가입하면 지금 담은 재료가 그대로 이어져요.'],
        warn: WARN, dismiss: '나중에',
      };
    case 'favorite':
      return {
        title: '즐겨찾기는 3개까지만 가능해요',
        lines: ['더 저장하려면 로그인해 주세요.', '가입하면 즐겨찾기가 그대로 이어져요.'],
        warn: WARN, dismiss: '취소',
      };
    case 'write':
      return {
        title: '기록은 3개까지만 가능해요',
        lines: ['더 남기려면 로그인해 주세요.', '가입하면 기록이 그대로 이어져요.'],
        warn: WARN, dismiss: '취소',
      };
    case 'done':
      return {
        title: '완료는 3개까지만 가능해요',
        lines: ['더 남기려면 로그인해 주세요.', '가입하면 완료 기록이 그대로 이어져요.'],
        warn: WARN, dismiss: '취소',
      };
    case 'ai':
      return {
        title: 'AI 체험을 다 쓰셨어요',
        lines: [`가입하면 ${credits}크레딧을 바로 드려요.`],
        dismiss: '취소',
      };
    case 'return':
    default:
      return {
        title: '다시 와 주셨네요',
        lines: ['로그인하면 담아 둔 재료가 안전하게 저장돼요.', '가입하면 지금 재료가 그대로 이어져요.'],
        warn: WARN, dismiss: '나중에',
      };
  }
}

/** 비회원인가(로그인 토큰이 없다) */
export function isGuestNow(): boolean {
  return !getAuthToken();
}

/** 어느 화면에서든 로그인 확인창을 띄운다. `LoginGateHost` 가 듣는다. */
export function openLoginGate(kind: GateKind, extra?: { credits?: number }): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GateDetail>(GATE_EVENT, { detail: { kind, ...extra } }));
}

/**
 * 기본 재료(처음 앱을 열 때 넣어 주는 약 30개)의 id 인가.
 * 기본 재료 id 는 `room-<시각>-<번호>` / `fridge-…` / `frozen-…` 이고, 직접 담은 재료는 `<재료이름>-<시각>` 이다.
 * 비회원이 「직접 담은 재료」 3개를 셀 때 기본 재료는 뺀다.
 */
export function isSeedIngredientId(id: unknown): boolean {
  return typeof id === 'string' && /^(room|fridge|frozen)-\d+-\d+$/.test(id);
}

// ── 두 번째 방문 ─────────────────────────────────────────────
const RETURN_SHOWN_AT = 'cookmatch_return_gate_at';       // localStorage: 마지막으로 띄운 시각(ms)
const RETURN_SHOWN_SESSION = 'cookmatch_return_gate_session'; // sessionStorage: 이번 방문에 이미 띄웠나
const RETURN_REST_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COUNT_KEY = 'cookmatch_session_count';

/** 이 기기에서 지금까지 몇 번째 방문인가(track.ts 가 새 방문이 시작될 때마다 1씩 올린다) */
export function getSessionCount(): number {
  try {
    return Number(localStorage.getItem(SESSION_COUNT_KEY) || 0);
  } catch {
    return 0;
  }
}

/** 비회원 + 2번째 이후 방문 + 이번 방문에 아직 안 띄움 + 마지막으로 띄운 지 7일이 지남 */
export function shouldShowReturnGate(): boolean {
  try {
    if (!isGuestNow()) return false;
    if (getSessionCount() < 2) return false;
    if (sessionStorage.getItem(RETURN_SHOWN_SESSION)) return false;
    const last = Number(localStorage.getItem(RETURN_SHOWN_AT) || 0);
    if (last && Date.now() - last < RETURN_REST_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function markReturnGateShown(): void {
  try {
    sessionStorage.setItem(RETURN_SHOWN_SESSION, '1');
    localStorage.setItem(RETURN_SHOWN_AT, String(Date.now()));
  } catch {
    /* 무시 */
  }
}

// ── 기록(어드민 「가입 유도」 분석용) ────────────────────────────
/** 어느 확인창인지 한 단어로 — 서버에는 이 값만 간다(내용은 안 보냄). */
export function gateTag(kind: GateKind): string {
  return kind === 'return' ? 'return_visit' : kind === 'ai' ? 'ai_out' : `${kind}_limit`;
}

export function trackGate(event: 'cta_view' | 'cta_click' | 'cta_dismiss', kind: GateKind): void {
  track(event, gateTag(kind));
}
