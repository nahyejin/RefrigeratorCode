import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirectPath } from '../utils/householdInvite';
import { completeNativeLogin, parseNativeLoginUrl } from '../utils/nativeAuth';

/**
 * 네이티브 앱 소셜 로그인의 "돌아오는 쪽" — 화면은 없다.
 *
 * 시스템 브라우저에서 로그인이 끝나면 `com.cookmatch.app://auth?code=...` 로 앱이
 * 열린다(안드로이드 intent-filter / iOS URL scheme). 그 주소를 받아 code 를 토큰으로
 * 바꾸고 로그인시킨다. 앱이 꺼져 있다 열린 경우(`getLaunchUrl`)와 켜져 있던 경우
 * (`appUrlOpen`) 둘 다 받는다. 웹에서는 아무것도 안 한다.
 */
const NativeAuthBridge: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  // 같은 주소가 getLaunchUrl 과 appUrlOpen 으로 두 번 들어와도 한 번만 처리
  const handledRef = React.useRef(new Set<string>());
  const loginRef = React.useRef(loginWithToken);
  loginRef.current = loginWithToken;

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = async (url: string | undefined) => {
      if (!url) return;
      const code = parseNativeLoginUrl(url);
      if (!code || handledRef.current.has(code)) return;
      handledRef.current.add(code);

      // iOS 는 브라우저 시트가 앱 위에 남는다(안드로이드는 알아서 닫힘 — 여기선 no-op)
      Browser.close().catch(() => {});

      const token = await completeNativeLogin(code);
      if (!token) {
        navigate('/login?error=oauth_failed');
        return;
      }
      try {
        await loginRef.current(token);
        navigate(getPostLoginRedirectPath('/my-fridge'));
      } catch {
        navigate('/login?error=login_failed');
      }
    };

    let removed = false;
    let remove: (() => void) | null = null;
    App.addListener('appUrlOpen', event => handle(event.url)).then(h => {
      if (removed) h.remove();
      else remove = () => h.remove();
    });
    App.getLaunchUrl().then(launch => handle(launch?.url)).catch(() => {});

    return () => {
      removed = true;
      remove?.();
    };
  }, [navigate]);

  return null;
};

export default NativeAuthBridge;
