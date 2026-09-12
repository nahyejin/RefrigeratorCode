/**
 * 웹 푸시(진짜 푸시 — 앱을 꺼 두거나 브라우저를 닫아도 온다) 구독 관리.
 *
 * 왜 필요했나:
 *   `ExpiryAlert.tsx`의 "알림 받기"는 브라우저 `Notification` API 였다. 이건
 *   **그 순간 앱이 열려 있어야만** 뜬다 — 진짜 푸시가 아니다. 그리고 그 버튼은
 *   "지금 임박한 재료가 있을 때"만 뜨는 카드 안에 있어서, 껐다 켰다를 그 카드
 *   안에서만 할 수 있었다("이게 여기 있는 게 맞나" — 실사용 지적, 2026-09-12).
 *
 *   또한 "우리 식구도 다 받게" 하려면 애초에 **서버가 보내야** 한다 — 브라우저
 *   알림은 그 기기에서만 일어나는 일이라 다른 사람에게 전달할 방법이 없다.
 *
 * 구조:
 *   1) 이 파일이 브라우저의 Push API 로 기기별 구독(endpoint+키)을 만들고
 *      서버(`/api/push/subscribe`)에 등록한다.
 *   2) 서버는 매일 한 번(로컬 배치, `scripts/send_expiry_push_notifications.py`)
 *      각 구독자의 냉장고를 확인해 곧 상하는 재료가 있으면 그 사람의 모든
 *      구독 기기로 푸시를 쏜다. 식구 그룹이면 그룹원 각자가 구독해 둔 기기
 *      전부에 간다(같은 냉장고를 보므로).
 *   3) 실제 알림 표시는 `public/sw.js`의 `push` 이벤트 핸들러가 한다(이미 있음).
 *
 * 로그인이 반드시 필요하다 — 서버가 "이 사람 냉장고"를 알아야 확인할 수 있는데,
 * 비회원 냉장고는 이 기기의 localStorage 에만 있어 서버가 애초에 못 본다.
 */

import { getAuthToken } from './usage';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** VAPID 공개키는 base64url 문자열로 오는데, subscribe() 는 Uint8Array 를 원한다. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** 지금 이 기기가 실제로 구독돼 있는지(브라우저 기준 — 서버 등록 여부와는 별개). */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * 알림 권한을 묻고, 허락하면 구독을 만들어 서버에 등록한다.
 * 실패 이유를 구분해 돌려준다 — 화면에서 "왜 안 됐는지"를 말해 줘야 한다.
 */
export async function subscribeToPush(): Promise<
  { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'login_required' | 'error' }
> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (!getAuthToken()) return { ok: false, reason: 'login_required' };

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const keyRes = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`);
      const { publicKey } = await keyRes.json();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON();
    const res = await fetch(`${API_BASE_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true };
  } catch (e) {
    console.warn('[push] 구독 실패:', e);
    return { ok: false, reason: 'error' };
  }
}

/** 이 기기의 구독을 끊는다 — 브라우저 쪽도, 서버 쪽도. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch(`${API_BASE_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
    return true;
  } catch (e) {
    console.warn('[push] 구독 해제 실패:', e);
    return false;
  }
}
