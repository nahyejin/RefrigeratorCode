/**
 * 화면 진입과 핵심 행동을 기록한다.
 *
 * 왜 지금 넣나: **나중에 넣으면 과거가 없다.** 광고로 사람이 들어온 뒤에 넣으면
 * 정작 가장 궁금한 "첫 유입자들이 어디서 나갔나" 를 영영 모른다.
 *
 * 무엇을 남기지 않나: 이름·이메일·재료 이름 같은 **내용**은 남기지 않는다.
 * 화면 이름과 행동 이름만 남긴다.
 *
 * 설계 요점
 *  - **모아서 보낸다.** 화면을 넘길 때마다 요청을 날리면 느린 망에서 화면이 밀린다.
 *    3초에 한 번, 또는 10개가 모이면 보낸다.
 *  - **탭을 닫을 때도 보낸다.** `sendBeacon` 은 페이지가 사라지는 중에도 나간다.
 *    이게 없으면 "마지막 화면"(= 이탈 지점)이 늘 유실된다 — 정작 제일 알고 싶은 것이.
 *  - **시각은 서버가 정한다.** 기기 시계는 틀릴 수 있어서, 쌓아 둔 이벤트는
 *    "몇 ms 전"으로 보내고 서버가 되돌린다.
 *  - **실패해도 조용히 넘어간다.** 기록은 부수적인 일이라 화면을 막으면 안 된다.
 */

import { Capacitor } from '@capacitor/core';
import { getDeviceId, usageHeaders } from './usage';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const SESSION_KEY = 'cookmatch_session_id';
const SESSION_AT = 'cookmatch_session_at';
const SOURCE_KEY = 'cookmatch_source';
/** 같은 값을 `utils/loginGate.ts` 가 읽는다(서로 import 하지 않으려고 문자열을 맞춘다) */
const SESSION_COUNT_KEY = 'cookmatch_session_count';
/** 이 시간 넘게 아무것도 안 하면 다음 방문으로 본다 */
const SESSION_GAP_MS = 30 * 60 * 1000;

type Event = {
  name: string;
  screen?: string;
  detail?: string;
  session_id?: string;
  source?: string;
  at: number;
};

let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** 광고·게시물에서 온 사람인지. `?utm_source=instagram` 같은 값을 처음 한 번만 기억한다. */
function captureSource(): string | null {
  try {
    const param = new URLSearchParams(window.location.search).get('utm_source');
    if (param) {
      sessionStorage.setItem(SOURCE_KEY, param.slice(0, 60));
      return param.slice(0, 60);
    }
    const kept = sessionStorage.getItem(SOURCE_KEY);
    if (kept) return kept;
    // 유입 경로를 안 넘겨줬을 때의 차선책 — 어느 사이트에서 왔는지
    const ref = document.referrer;
    if (ref && !ref.includes(window.location.host)) {
      const host = new URL(ref).hostname.replace(/^www\./, '');
      sessionStorage.setItem(SOURCE_KEY, host.slice(0, 60));
      return host.slice(0, 60);
    }
  } catch {
    /* 무시 */
  }
  return null;
}

/** 이번 방문의 id. 30분 넘게 조용하면 새 방문으로 친다. */
function sessionId(): string {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(SESSION_AT) || 0);
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || !last || now - last > SESSION_GAP_MS) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `s${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, id);
      // 「이 기기에서 몇 번째 방문인가」 — 비회원 두 번째 방문 팝업(utils/loginGate)이 읽는다.
      try {
        localStorage.setItem(SESSION_COUNT_KEY, String(Number(localStorage.getItem(SESSION_COUNT_KEY) || 0) + 1));
      } catch { /* 저장 못 해도 기록은 계속 */ }
      queueEvent('session_start');
    }
    sessionStorage.setItem(SESSION_AT, String(now));
    return id;
  } catch {
    return 'no-storage';
  }
}

/** 앱(안드로이드·iOS)인지 웹인지 — 어드민의 「새로 들어온 기기」를 나누는 데 쓴다. */
function platformName(): string {
  try {
    const p = Capacitor.getPlatform();
    return p === 'android' || p === 'ios' ? p : 'web';
  } catch {
    return 'web';
  }
}

function payload(events: Event[]) {
  const now = Date.now();
  return JSON.stringify({
    // 기기 식별자를 **몸통에도** 싣는다.
    //
    // 나가는 순간의 기록은 `sendBeacon` 으로 보내는데, beacon 은 헤더를 붙일 수
    // 없다. 헤더로만 보내면 하필 가장 궁금한 "어디서 나갔나" 가 누구 것인지
    // 모르는 채로 도착한다. 서버는 헤더를 먼저 보고 없으면 이 값을 쓴다.
    device_id: getDeviceId(),
    events: events.map(e => ({
      name: e.name,
      screen: e.screen,
      detail: e.detail,
      session_id: e.session_id,
      source: e.source,
      platform: platformName(),
      ago_ms: Math.max(0, now - e.at),
    })),
  });
}

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  const body = payload(batch);
  const url = `${API_BASE_URL}/api/events`;

  // 페이지가 사라지는 중에는 fetch 가 취소된다. sendBeacon 만 살아 나간다.
  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    } catch {
      /* 아래 fetch 로 떨어진다 */
    }
  }

  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...usageHeaders() },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 기록 실패는 조용히 넘어간다 */
  }
}

function queueEvent(name: string, screen?: string, detail?: string) {
  queue.push({
    name,
    screen,
    detail,
    session_id: (() => {
      try {
        return sessionStorage.getItem(SESSION_KEY) || undefined;
      } catch {
        return undefined;
      }
    })(),
    source: captureSource() || undefined,
    at: Date.now(),
  });
  if (queue.length >= 10) {
    flush();
  } else if (!timer) {
    timer = setTimeout(() => flush(), 3000);
  }
}

/** 핵심 행동 하나를 남긴다. */
export function track(name: string, detail?: string) {
  try {
    sessionId();
    queueEvent(name, screenName(window.location.pathname), detail);
  } catch {
    /* 무시 */
  }
}

/**
 * 경로를 화면 이름으로 바꾼다.
 *
 * 경로를 그대로 쓰면 `/recipe-detail/12345` 처럼 id 가 붙어 화면마다 다른 이름이
 * 되고 집계가 흩어진다. id 는 떼고 화면 종류만 남긴다.
 */
export function screenName(pathname: string): string {
  const path = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const known: Record<string, string> = {
    '/': '홈',
    '/my-fridge': '내냉장고',
    '/recipe-list': '냉장고요리',
    '/popular': '요즘인기',
    '/cooking-calendar': '요리캘린더',
    '/my-page': '마이페이지',
    '/login': '로그인',
    '/signup': '회원가입',
    '/admin': '어드민',
  };
  if (known[path]) return known[path];
  if (path.startsWith('/recipe-detail')) return '레시피상세';
  if (path.startsWith('/ingredient-detail')) return '재료상세';
  if (path.startsWith('/my-')) return '마이페이지-목록';
  if (path.startsWith('/auth')) return '로그인처리';
  return path.slice(0, 60);
}

let lastScreen = '';
let lastScreenAt = 0;

/** 화면에 들어왔다. 라우터가 경로를 바꿀 때마다 부른다. */
export function trackScreen(pathname: string) {
  try {
    // 어드민은 관리자만 보는 화면이라 통계에 섞으면 수치가 왜곡된다.
    if (pathname.startsWith('/admin')) return;

    // 같은 화면이 1초 안에 두 번 들어오면 한 번만 센다.
    //
    // React 는 개발 모드에서 effect 를 일부러 두 번 돌린다(StrictMode). 그대로
    // 두면 화면 조회수가 딱 두 배로 잡혀, 나중에 "왜 숫자가 안 맞지" 를 한참
    // 찾게 된다. 배포본에서는 안 생기지만 막아 두는 편이 낫다.
    const name = screenName(pathname);
    const now = Date.now();
    if (name === lastScreen && now - lastScreenAt < 1000) return;
    lastScreen = name;
    lastScreenAt = now;

    sessionId();
    queueEvent('screen_view', name);
  } catch {
    /* 무시 */
  }
}

/**
 * 앱을 **다시 열었을 때**도 방문으로 센다.
 *
 * 화면 기록은 경로가 바뀔 때만 남는다. 그런데 폰 앱은 닫아도 뒤에 살아 있다가
 * 다시 열면 보던 화면(예: 내냉장고)에서 그대로 이어진다 — 경로가 안 바뀌니
 * 며칠을 열어 냉장고만 봐도 기록이 0 이었다(2026-10-18, 「잘 쓰고 있다」는 회원이
 * 어드민엔 가입 날 3분만 남아 있던 일). 30분 넘게 쉬었다 돌아오면 새 방문으로 보고
 * 지금 화면을 한 번 기록한다(`sessionId()` 가 새 방문이면 session_start 도 남긴다).
 */
function noteReturn() {
  try {
    if (typeof window === 'undefined') return;
    const last = Number(sessionStorage.getItem(SESSION_AT) || 0);
    if (last && Date.now() - last <= SESSION_GAP_MS) return;   // 같은 방문 안
    lastScreen = '';
    trackScreen(window.location.pathname);
  } catch {
    /* 무시 */
  }
}

/** 탭을 닫거나 숨길 때 남은 것을 내보낸다. 여기가 "마지막 화면"이 결정되는 곳. */
export function installTrackingFlush() {
  if (typeof document === 'undefined') return;
  const send = () => flush(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
    else noteReturn();
  });
  window.addEventListener('pagehide', send);
  // 네이티브 앱은 웹뷰의 visibilitychange 가 기기마다 들쭉날쭉해 앱 「다시 열림」도 듣는다.
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app')
      .then(({ App }) => {
        App.addListener('resume', noteReturn);
        App.addListener('pause', send);
      })
      .catch(() => {});
  }
}

/** 기기 식별자는 사용량 쪽과 같은 것을 쓴다 (한 사람을 두 번 세지 않게). */
export { getDeviceId };
