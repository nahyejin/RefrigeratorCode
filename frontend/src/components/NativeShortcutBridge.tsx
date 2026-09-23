import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { closeTopOnBack } from '../utils/closeOnBack';

/**
 * 홈 화면 위젯·바로가기로 앱이 열렸을 때 갈 곳을 정한다 — 화면은 없다.
 *
 * 안드로이드 홈 화면의 쿡매치 위젯(3×1, 「재료 찍기」·「요리 AI」·「AI 식단」)은 사진을 직접 찍지 못한다(OS 제한: 위젯은
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
const CALENDAR_URL_HOST = 'calendar';

/**
 * 앱을 켤 때 받은 주소(`getLaunchUrl`)는 **앱이 떠 있는 동안 계속 같은 값**을 돌려준다.
 * 예전엔 아래 효과가 `navigate` 가 바뀔 때마다(= 화면을 옮길 때마다) 다시 돌면서 그 주소를 또 처리해,
 * 위젯으로 마이캘린더를 연 뒤 다른 탭을 누르면 곧바로 마이캘린더로 되돌아갔다(2026-09-23 지적 —
 * "다른 탭으로 아예 이동을 못 한다"). 앱 실행 한 번에 한 번만 처리하도록 모듈 변수로 막는다.
 */
let launchUrlHandled = false;

/*
 * 위젯이 여는 화면은 **덮어쓰지 않고(replace) 위에 쌓는다**(push). 앱을 위젯으로 켜면 방문 기록이 첫 화면 하나뿐인데,
 * 그 자리를 덮어쓰면 뒤로 갈 곳이 없어진다 — 아래 탭 메뉴가 없는 「이번 주 식단 추천」(/plan)은 「<」도 폰 뒤로 가기도
 * 먹지 않아 화면에 갇혔다(2026-09-23 에뮬레이터 확인). 쌓아 두면 뒤로 가기로 첫 화면(내 냉장고)에 돌아간다.
 */

const NativeShortcutBridge: React.FC = () => {
  const navigate = useNavigate();
  // 리스너는 한 번만 달고, 화면이 바뀌어도 최신 navigate 를 쓰도록 ref 로 들고 있는다
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const navigate: typeof navigateRef.current = (...args) => navigateRef.current(...args);

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
        navigate('/my-fridge?camera=1');
        return;
      }
      if (host === CALENDAR_URL_HOST) {
        navigate('/cooking-calendar');
        return;
      }
      if (host === PLAN_URL_HOST) {
        navigate('/plan');
        return;
      }
      if (host === CHAT_URL_HOST) {
        // 요리 AI 위젯은 앱 어디서 열리든 그 자리에서 대화창만 띄운다(RecipeChatWidget 이 전역).
        window.dispatchEvent(new CustomEvent('cookmatch-open-chat'));
      }
    };

    let removed = false;
    let remove: (() => void) | null = null;
    App.addListener('appUrlOpen', event => handle(event.url)).then(h => {
      if (removed) h.remove();
      else remove = () => h.remove();
    });
    /*
     * 안드로이드 폰 「뒤로」 버튼 — 앱 안의 방문 기록(react-router 의 history.state.idx)으로 직접 뒤로 간다.
     * 기본 동작(웹뷰 goBack)은 **사용자 조작 없이 쌓인 기록을 건너뛰어서**, 위젯으로 켜서 곧장 열린
     * 「이번 주 식단 추천」에서 뒤로 버튼이 아무 반응이 없었다(2026-09-23 에뮬레이터 확인). 첫 화면이면 앱을 내린다
     * (안드로이드 기본과 같게 — 끄지 않고 뒤로 보낸다). iOS 는 뒤로 버튼이 없고 스와이프는 웹뷰가 처리한다.
     */
    let removeBack: (() => void) | null = null;
    if (Capacitor.getPlatform() === 'android') {
      App.addListener('backButton', () => {
        // 열려 있는 창(시트·확인창·요리 AI 대화창)이 있으면 그것부터 닫는다
        if (closeTopOnBack()) return;
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) window.history.back();
        else void App.minimizeApp();
      }).then(h => {
        if (removed) h.remove();
        else removeBack = () => h.remove();
      });
    }

    if (!launchUrlHandled) {
      launchUrlHandled = true;
      App.getLaunchUrl().then(launch => handle(launch?.url)).catch(() => {});
    }

    return () => {
      removed = true;
      remove?.();
      removeBack?.();
    };
  }, []);

  return null;
};

export default NativeShortcutBridge;
