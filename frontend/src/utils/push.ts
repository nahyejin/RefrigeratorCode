/**
 * 푸시 알림 구독 관리 — 웹(Web Push)과 네이티브 앱(FCM) 두 갈래.
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
 *   웹: 브라우저의 Push API 로 기기별 구독(endpoint+키)을 만들고 서버
 *       (`/api/push/subscribe`)에 등록한다. 실제 알림 표시는 `public/sw.js`.
 *   네이티브 앱(Capacitor, 안드로이드/iOS): 앱 웹뷰에는 서비스워커 푸시가 없어서
 *       `@capacitor/push-notifications`로 OS 푸시 토큰(FCM)을 받아
 *       `/api/push/native/register`에 등록한다. 알림 표시는 OS가 한다.
 *   발송: 매일 한 번 로컬 배치(`scripts/send_expiry_push_notifications.py`)가 각
 *       구독자의 냉장고를 확인해 곧 상하는 재료가 있으면 그 사람의 모든 기기
 *       (웹 구독 + 네이티브 토큰)로 보낸다. 식구 그룹이면 같은 냉장고를 보는
 *       그룹원 각자의 기기 전부로.
 *
 * 로그인이 반드시 필요하다 — 서버가 "이 사람 냉장고"를 알아야 확인할 수 있는데,
 * 비회원 냉장고는 이 기기의 localStorage 에만 있어 서버가 애초에 못 본다.
 *
 * 화면(`NotificationSettings`, `ExpiryPushPrompt`)은 웹/네이티브를 구분하지 않고
 * 아래 함수들만 부른다 — 갈래는 이 파일 안에서만 나뉜다.
 */

import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getAuthToken } from './usage';

/**
 * 네이티브 앱 푸시 스위치.
 *
 * Firebase 설정 파일(안드로이드 `android/app/google-services.json`)이 없는 상태에서
 * `PushNotifications.register()`를 부르면 안드로이드 앱이 "Default FirebaseApp is
 * not initialized"로 **강제 종료된다.** 그래서 설정 파일을 넣기 전까지는 꺼 둔다
 * (꺼져 있으면 네이티브 앱에선 알림 토글·안내 팝업이 아예 안 보인다 — 웹은 영향 없음).
 * 설정 파일을 넣고 나서 `true`로 바꾼다(MOBILE_APP_GUIDE.md "푸시 알림" 절차 참고).
 */
export const NATIVE_PUSH_ENABLED = false;

/**
 * 안드로이드 8+ 알림 채널 id. 서버 발송(`send_expiry_push_notifications.py`의
 * `FCM_CHANNEL_ID`)과 AndroidManifest 의 기본 채널 값과 **반드시 같아야** 한다 —
 * 다르면 알림이 "기타" 채널로 떨어져 사용자가 이 알림만 따로 끌 수 없다.
 */
export const EXPIRY_CHANNEL_ID = 'expiry';

const NATIVE_TOKEN_KEY = 'cookmatch_native_push_token';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'login_required' | 'error' };

// ---------------------------------------------------------------------------
// 공개 API — 화면은 이것만 쓴다
// ---------------------------------------------------------------------------

export function pushSupported(): boolean {
  if (isNative()) return NATIVE_PUSH_ENABLED;
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** 지금 이 기기가 실제로 구독돼 있는지(기기 기준 — 서버 등록 여부와는 별개). */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  return isNative() ? isNativeSubscribed() : isWebSubscribed();
}

/**
 * 이 기기에서 알림 권한이 이미 결정됐는지(허용이든 거부든).
 * 결정된 사람에게 "알림 켜시겠어요?"를 또 물으면 성가시기만 하다(`ExpiryPushPrompt`).
 */
export async function pushPermissionDecided(): Promise<boolean> {
  if (isNative()) {
    try {
      const { receive } = await PushNotifications.checkPermissions();
      return receive === 'granted' || receive === 'denied';
    } catch {
      return false;
    }
  }
  return typeof Notification !== 'undefined' && Notification.permission !== 'default';
}

/**
 * 알림 권한을 묻고, 허락하면 구독을 만들어 서버에 등록한다.
 * 실패 이유를 구분해 돌려준다 — 화면에서 "왜 안 됐는지"를 말해 줘야 한다.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (!getAuthToken()) return { ok: false, reason: 'login_required' };
  return isNative() ? subscribeNative() : subscribeWeb();
}

/** 이 기기의 구독을 끊는다 — 기기 쪽도, 서버 쪽도. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  return isNative() ? unsubscribeNative() : unsubscribeWeb();
}

/**
 * 네이티브 앱을 켤 때마다 토큰을 새로 받아 서버에 다시 등록한다.
 * FCM 토큰은 앱 재설치·데이터 삭제·장기 미사용 등으로 **조용히 바뀔 수 있어서**,
 * 처음 한 번 등록한 값만 믿으면 어느 날부터 알림이 안 오게 된다. 이미 켜 둔
 * 사람(이 기기에 토큰 기록이 있고 권한이 허용된 경우)에게만 한다 — 안 켠 사람에게
 * 권한을 묻지는 않는다. (`NativePushBridge`가 앱 시작 시 부른다.)
 */
export async function refreshNativePushToken(): Promise<void> {
  if (!isNative() || !NATIVE_PUSH_ENABLED) return;
  if (!readNativeToken() || !getAuthToken()) return;
  try {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive !== 'granted') return;
    const token = await obtainNativeToken();
    if (token && (await sendNativeToken(token))) writeNativeToken(token);
  } catch (e) {
    console.warn('[push] 네이티브 토큰 갱신 실패:', e);
  }
}

// ---------------------------------------------------------------------------
// 웹 (Web Push)
// ---------------------------------------------------------------------------

/** VAPID 공개키는 base64url 문자열로 오는데, subscribe() 는 Uint8Array 를 원한다. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * 서비스워커 등록을 **직접 받아 온다** — `navigator.serviceWorker.ready` 로
 * 기다리지 않는다.
 *
 * `ready` 는 "누군가 이미 등록을 걸어 뒀다"를 전제로 한다. 그런데 이 앱은
 * `utils/pwa.ts`의 `registerServiceWorker()`를 어디서도 부르지 않는다 —
 * PWA 설치 관련 화면 몇 개만 그 파일의 다른 함수를 쓸 뿐, 정작 등록 자체는
 * 실행된 적이 없다. 그 상태에서 `ready` 를 쓰면 **영원히 끝나지 않는
 * Promise** 가 되고, 그걸 기다리는 `isPushSubscribed()` 가 안 끝나니 토글이
 * `status:'loading'` 에 갇혀 계속 비활성 상태로 남는다("토글이 클릭이 안
 * 된다" — 실사용 지적). `register()` 는 몇 번을 불러도 같은 등록을 그대로
 * 돌려주므로(스코프가 같으면 브라우저가 재사용), 여기서 직접 등록까지 한다.
 */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('[push] 서비스워커 등록 실패:', e);
    return null;
  }
}

async function isWebSubscribed(): Promise<boolean> {
  try {
    const reg = await getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

async function subscribeWeb(): Promise<SubscribeResult> {
  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await getRegistration();
    if (!reg) return { ok: false, reason: 'error' };
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

async function unsubscribeWeb(): Promise<boolean> {
  try {
    const reg = await getRegistration();
    if (!reg) return false;
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

// ---------------------------------------------------------------------------
// 네이티브 앱 (Capacitor → FCM)
// ---------------------------------------------------------------------------

function readNativeToken(): string | null {
  try {
    return localStorage.getItem(NATIVE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeNativeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(NATIVE_TOKEN_KEY, token);
    else localStorage.removeItem(NATIVE_TOKEN_KEY);
  } catch {
    // 저장이 막혀 있어도 서버 등록은 이미 끝났다 — 다음 앱 시작 때 갱신만 못 할 뿐
  }
}

async function isNativeSubscribed(): Promise<boolean> {
  if (!readNativeToken()) return false;
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === 'granted';
  } catch {
    return false;
  }
}

/**
 * `register()`의 결과(토큰)는 반환값이 아니라 `registration` 이벤트로 온다 —
 * 이벤트 한 번을 Promise 하나로 감싼다. 응답이 없으면(네트워크·Play 서비스 문제)
 * 20초 뒤 포기한다 — 토글이 영원히 '처리 중'에 갇히지 않게.
 */
function obtainNativeToken(): Promise<string | null> {
  return new Promise(resolve => {
    let settled = false;
    let handles: PluginListenerHandle[] = [];
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handles.forEach(h => h.remove());
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 20000);

    Promise.all([
      PushNotifications.addListener('registration', t => finish(t.value)),
      PushNotifications.addListener('registrationError', e => {
        console.warn('[push] 네이티브 등록 실패:', e.error);
        finish(null);
      }),
    ])
      .then(hs => {
        handles = hs;
        if (settled) {
          hs.forEach(h => h.remove());
          return;
        }
        return PushNotifications.register();
      })
      .catch(e => {
        console.warn('[push] 네이티브 등록 호출 실패:', e);
        finish(null);
      });
  });
}

async function sendNativeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/push/native/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function subscribeNative(): Promise<SubscribeResult> {
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      // 안드로이드 13+ / iOS 에서 OS 권한 팝업이 여기서 뜬다
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return { ok: false, reason: 'denied' };

    const token = await obtainNativeToken();
    if (!token) return { ok: false, reason: 'error' };
    if (!(await sendNativeToken(token))) return { ok: false, reason: 'error' };
    writeNativeToken(token);
    return { ok: true };
  } catch (e) {
    console.warn('[push] 네이티브 구독 실패:', e);
    return { ok: false, reason: 'error' };
  }
}

async function unsubscribeNative(): Promise<boolean> {
  const token = readNativeToken();
  writeNativeToken(null);
  if (token) {
    await fetch(`${API_BASE_URL}/api/push/native/unregister`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
  // 기기 쪽 토큰도 폐기 — 서버 삭제가 실패했더라도 이 기기로는 더 이상 안 온다
  await PushNotifications.unregister().catch(() => {});
  return true;
}
