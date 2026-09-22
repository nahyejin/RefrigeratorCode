import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * 홈 화면 위젯·바로가기로 앱이 열렸을 때 갈 곳을 정한다 — 화면은 없다.
 *
 * 안드로이드 홈 화면의 쿡매치 위젯(3×1, 「재료 찍기」·「물어보기」·「AI 식단」)은 사진을 직접 찍지 못한다(OS 제한: 위젯은
 * 그림과 버튼만 그릴 수 있다). 그래서 위젯은 `com.cookmatch.app://camera` 로 앱을 열고,
 * 그 주소를 여기서 받아 내 냉장고 화면의 카메라 시트를 바로 띄운다(`?camera=1`).
 *
 * 로그인 복귀 주소(`…://auth?code=…`)는 [NativeAuthBridge]가 따로 받는다 — 둘은 같은
 * `appUrlOpen` 이벤트를 듣지만 host 로 갈린다. 앱이 꺼져 있다 열린 경우(`getLaunchUrl`)와
 * 켜져 있던 경우(`appUrlOpen`) 둘 다 받아야 한다 — 위젯은 두 경우가 모두 흔하다.
 */
const CAMERA_URL_HOST = 'camera';
const CHAT_URL_HOST = 'chat';
const PLAN_URL_HOST = 'plan';
const FRIDGE_URL_HOST = 'fridge';

const NativeShortcutBridge: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = (url: string | undefined) => {
      if (!url) return;
      // com.cookmatch.app://camera — 스킴은 로그인과 같고 host 만 다르다
      let host = '';
      try {
        host = new URL(url).host;
      } catch {
        return;
      }
      if (host === CAMERA_URL_HOST) {
        navigate('/my-fridge?camera=1', { replace: true });
        return;
      }
      if (host === FRIDGE_URL_HOST) {
        navigate('/my-fridge', { replace: true });
        return;
      }
      if (host === PLAN_URL_HOST) {
        navigate('/plan', { replace: true });
        return;
      }
      if (host === CHAT_URL_HOST) {
        // 물어보기 위젯은 앱 어디서 열리든 그 자리에서 대화창만 띄운다(RecipeChatWidget 이 전역).
        window.dispatchEvent(new CustomEvent('cookmatch-open-chat'));
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

export default NativeShortcutBridge;
