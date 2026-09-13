import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pushSupported, isPushSubscribed, subscribeToPush } from '../utils/push';
import { isExpiryPushPromptSeen, markExpiryPushPromptSeen } from '../utils/onboardingPrompts';
import CloseButton from './ui/CloseButton';

/**
 * "유통기한 임박 알림 켜시겠어요?" — 로그인한 사람에게 **딱 한 번** 묻는다.
 *
 * 왜 필요한가:
 *   마이페이지에 토글을 만들어 뒀지만(`NotificationSettings.tsx`), 거길 일부러
 *   찾아가지 않으면 이 기능이 있는 줄도 모른다. "기존 회원 전부를 켜진
 *   상태로 만들어 달라" 는 요청이 있었는데, 브라우저 알림 허용은 그 사람의
 *   실제 클릭으로만 켜지는 것이라(보안상 서버가 대신 켤 방법이 없다) 그 대신
 *   로그인 직후 여기서 바로 물어본다 — 마이페이지까지 찾아갈 필요가 없어진다.
 *
 *   신규 회원도 예외 없이 본다 — "신규는 기본 on" 이라는 상태 자체가
 *   존재할 수 없다(모두가 최소 한 번은 브라우저 허용을 직접 눌러야 한다).
 *
 * `HomeInstallPrompt` 와 같은 자리(AppRouter, 전역)에 둔다. 두 팝업이 같은
 * 순간 겹치지 않도록 이쪽 지연을 더 길게 잡는다.
 */
const ExpiryPushPrompt: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    if (
      location.pathname === '/login' ||
      location.pathname === '/signup' ||
      location.pathname === '/find-email' ||
      location.pathname === '/reset-password' ||
      location.pathname.startsWith('/plan')
    ) {
      return;
    }
    if (!pushSupported() || isExpiryPushPromptSeen()) return;
    // 이미 다른 기기에서 알림을 켜 놓고 처음 보는 기기로 로그인한 경우는
    // 물을 필요가 없다 — 다만 그건 "이 기기가 구독 중인가" 만 보고 판단
    // 하지 않는다(당연히 이 기기는 아직 아닐 수 있다). 그냥 이 기기에서
    // Notification 권한이 이미 결정돼 있으면(허용/거부 어느 쪽이든) 새삼
    // 물어볼 필요가 없다 — 거부한 사람에게 또 물으면 성가시기만 하다.
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
      markExpiryPushPromptSeen();
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const already = await isPushSubscribed();
      if (!cancelled && !already) setVisible(true);
    }, 2600); // HomeInstallPrompt(1~1.2s)보다 늦게 — 둘이 겹치지 않게

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isLoggedIn, location.pathname]);

  const close = () => {
    markExpiryPushPromptSeen();
    setVisible(false);
  };

  const turnOn = async () => {
    markExpiryPushPromptSeen();
    setVisible(false);
    // 실패(권한 거부 등)해도 여기서 따로 알릴 필요는 없다 — 마이페이지
    // 토글에서 언제든 다시 시도할 수 있고, 그쪽엔 실패 사유 안내가 있다.
    await subscribeToPush();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-toast)',
        background: 'rgba(0,0,0,0.42)', display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-label="유통기한 임박 알림 안내"
        style={{
          position: 'relative', width: '100%', maxWidth: 400,
          background: 'rgba(20, 20, 20, 0.94)', borderRadius: '22px 22px 0 0',
          boxShadow: '0 -12px 30px rgba(0,0,0,0.18)',
          padding: '22px 18px calc(18px + env(safe-area-inset-bottom))',
          color: '#FFFFFF',
        }}
      >
        <CloseButton onClick={close} dark style={{ top: 10, right: 10 }} />
        <div style={{ paddingRight: 36 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, lineHeight: 1.35, wordBreak: 'keep-all' }}>
            유통기한 임박 알림을 받아보세요
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.66)', wordBreak: 'keep-all' }}>
            알림을 허용하면, 유통기한이 임박한 재료에 대한 알림을 받을 수 있어요.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={close}
            style={{
              flex: 1, minHeight: 38, borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)', background: '#3A3A42',
              color: '#D2D2D8', fontSize: 15, fontWeight: 500, cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            onClick={turnOn}
            style={{
              flex: 1, minHeight: 38, borderRadius: 12, border: 'none',
              background: 'var(--brand)', color: '#1A1A1E',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            알림 켜기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiryPushPrompt;
