/**
 * 네이티브 앱(Capacitor)의 소셜 로그인 — 시스템 브라우저로 로그인하고 앱으로 돌아온다.
 *
 * 앱 화면은 인터넷 주소가 아니라(https://localhost) 웹처럼 "로그인 뒤 우리 사이트로
 * 리다이렉트"가 안 된다. 그렇다고 앱 안 웹뷰로 여는 건 구글이 로그인 자체를 막는다.
 * 그래서 **시스템 브라우저**(안드로이드 Custom Tabs / iOS SFSafariViewController)로
 * 기존 웹 로그인 주소를 그대로 열고, 끝나면 앱 전용 주소
 * (`com.cookmatch.app://auth?code=...`)로 돌아온다 — 구글·카카오·네이버 콘솔에 새로
 * 등록할 것이 없다. 서버 쪽은 `backend/app.py` "네이티브 앱(Capacitor) 소셜 로그인".
 *
 * 앱 주소는 다른 앱도 같은 이름으로 가로챌 수 있어서, 돌아오는 주소에는 토큰이 아니라
 * 1회용 code 만 실린다. 이 파일이 로그인을 시작할 때 만든 비밀값(verifier)을 같이
 * 내야 서버가 토큰을 준다(PKCE) — 그래서 verifier 는 브라우저로 나가기 전에 앱에만 둔다.
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';

export type SocialProvider = 'google' | 'kakao' | 'naver';

/** 서버 `NATIVE_APP_SCHEME` 과 같은 값 — 안드로이드 매니페스트·iOS Info.plist 에도 있다. */
export const NATIVE_APP_SCHEME = 'com.cookmatch.app';

// 로그인하는 동안 앱이 메모리에서 내려가도 이어갈 수 있게 localStorage 에 둔다.
const VERIFIER_KEY = 'cookmatch_native_login_verifier';

const apiBase = () =>
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const isNativeApp = () => Capacitor.isNativePlatform();

/** iOS 앱인가 — Sign in with Apple 은 iOS 심사 요건이라 iOS 앱에서만 보여 준다. */
export const isIosApp = () => Capacitor.getPlatform() === 'ios';

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * iOS 의 Apple 로그인 창을 띄우고, 받은 identity token 을 서버에 내 로그인 토큰을 받는다.
 * 사용자가 창을 닫으면 null, 그 밖의 실패는 예외.
 *
 * nonce: raw 값은 서버에만 보내고 Apple 에는 그 SHA-256 을 넘긴다(서버 `apple_signin.py`).
 */
export async function signInWithAppleNative(): Promise<string | null> {
  const rawNonce = base64Url(crypto.getRandomValues(new Uint8Array(16)));

  let result;
  try {
    result = await SignInWithApple.authorize({
      clientId: NATIVE_APP_SCHEME,
      redirectURI: '',
      scopes: 'email name',
      nonce: await sha256Hex(rawNonce),
    });
  } catch (e) {
    // 사용자가 Apple 로그인 창을 닫음(ASAuthorizationError.canceled = 1001)
    const err = e as { code?: unknown; message?: unknown };
    if (/1001|cancel/i.test(`${err?.code ?? ''} ${err?.message ?? ''}`)) return null;
    throw e;
  }

  const { identityToken, givenName, familyName } = result.response;
  const res = await fetch(`${apiBase()}/api/auth/apple/native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity_token: identityToken,
      nonce: rawNonce,
      // 이름은 Apple 이 처음 로그인할 때 한 번만 준다
      full_name: [familyName, givenName].filter(Boolean).join(''),
    }),
  });
  if (!res.ok) throw new Error(`apple login failed: ${res.status}`);
  const data = await res.json();
  if (typeof data.token !== 'string') throw new Error('apple login: no token');
  return data.token;
}

/** 시스템 브라우저로 소셜 로그인을 연다. 결과는 앱 주소로 돌아와 `completeNativeLogin` 이 받는다. */
export async function startNativeSocialLogin(provider: SocialProvider): Promise<void> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));

  localStorage.setItem(VERIFIER_KEY, verifier);
  await Browser.open({
    url: `${apiBase()}/api/auth/${provider}?app=1&challenge=${challenge}`,
  });
}

/** 앱 주소가 로그인 결과(`com.cookmatch.app://auth?code=...`)이면 code 를 꺼낸다. */
export function parseNativeLoginUrl(url: string): string | null {
  const prefix = `${NATIVE_APP_SCHEME}://auth`;
  if (!url.startsWith(prefix)) return null;
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    return null;
  }
}

/** code 를 서버에 내고 로그인 토큰을 받는다. 실패하면 null. */
export async function completeNativeLogin(code: string): Promise<string | null> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) return null;
  try {
    const res = await fetch(`${apiBase()}/api/auth/native/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, verifier }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.removeItem(VERIFIER_KEY);
    return typeof data.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}
