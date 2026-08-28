import React, { useEffect, useMemo, useState } from 'react';
import CloseButton from './ui/CloseButton';
import { useLocation } from 'react-router-dom';
import {
  dismissHomeInstallPromptForSession,
  isHomeInstallPromptSnoozed,
  isStandaloneAppMode,
  isUsageGuideDueThisVisit,
  ONBOARDING_KEYS,
  snoozeHomeInstallPrompt,
  USAGE_GUIDE_FINISHED_EVENT,
} from '../utils/onboardingPrompts';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function getPromptCopy() {
  if (isIOS()) {
    return {
      title: '홈 화면에 추가하면 더 편해요',
      description: '하단의 공유 아이콘을 누른 뒤, "홈 화면에 추가"를 선택하면 쿡매치를 앱처럼 사용할 수 있어요.',
      icon: <ShareIcon />,
    };
  }

  if (isAndroid()) {
    return {
      title: '홈 화면에 추가하면 더 편해요',
      description: '오른쪽 위 메뉴 버튼을 누른 뒤, "홈 화면에 추가" 또는 "앱 설치"를 선택하면 쿡매치를 앱처럼 사용할 수 있어요.',
      icon: <MenuIcon />,
    };
  }

  return {
    title: '홈 화면에 추가하면 더 편해요',
    description: '브라우저 메뉴에서 "홈 화면에 추가"를 선택하면 쿡매치를 앱처럼 사용할 수 있어요.',
    icon: <MenuIcon />,
  };
}

function ShareIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V3" stroke="rgba(255,255,255,0.82)" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.5 7.5L12 3l4.5 4.5" stroke="rgba(255,255,255,0.82)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" stroke="rgba(255,255,255,0.82)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, fontWeight: 300, color: 'rgba(255,255,255,0.82)' }}>
      ⋮
    </span>
  );
}

const HomeInstallPrompt: React.FC = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const copy = useMemo(getPromptCopy, []);

  useEffect(() => {
    if (visible) return;
    if (
      location.pathname === '/login' ||
      location.pathname === '/signup' ||
      location.pathname === '/find-email' ||
      location.pathname === '/reset-password'
    ) {
      return;
    }
    if (isStandaloneAppMode() || isHomeInstallPromptSnoozed()) return;

    const guideDue = isUsageGuideDueThisVisit();
    const guideFinished = sessionStorage.getItem(ONBOARDING_KEYS.usageGuideFinishedThisVisit) === 'true';
    const likelyGuideRoute =
      location.pathname === '/' ||
      location.pathname === '/my-fridge' ||
      location.search.includes('fromGuide=true') ||
      location.search.includes('showGuide=true') ||
      localStorage.getItem('myfridge_guide_completed') === 'true';

    let timer: ReturnType<typeof setTimeout> | null = null;

    const showLater = (delay = 1000) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!isStandaloneAppMode() && !isHomeInstallPromptSnoozed()) {
          setVisible(true);
        }
      }, delay);
    };

    const handleGuideFinished = () => showLater(1000);

    if (guideDue && !guideFinished && likelyGuideRoute) {
      window.addEventListener(USAGE_GUIDE_FINISHED_EVENT, handleGuideFinished);
    } else {
      showLater(1200);
    }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(USAGE_GUIDE_FINISHED_EVENT, handleGuideFinished);
    };
  }, [location.pathname, location.search, visible]);

  const closeForSession = () => {
    dismissHomeInstallPromptForSession();
    setVisible(false);
  };

  const snoozeForWeek = () => {
    snoozeHomeInstallPrompt();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-toast)',
        background: 'rgba(0,0,0,0.42)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'home-install-backdrop-fade 180ms ease-out',
      }}
    >
      <style>
        {`
          @keyframes home-install-backdrop-fade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes home-install-slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}
      </style>
      <div
        role="dialog"
        aria-label="홈 화면 추가 안내"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          background: 'rgba(20, 20, 20, 0.94)',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -12px 30px rgba(0,0,0,0.18)',
          padding: '22px 18px calc(18px + env(safe-area-inset-bottom))',
          color: '#FFFFFF',
          animation: 'home-install-slide-up 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <CloseButton onClick={closeForSession} dark style={{ top: 10, right: 10 }} />

        <div style={{ paddingRight: 36 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 3,
              fontSize: 18,
              fontWeight: 300,
              marginBottom: 8,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.82)',
              WebkitTextStroke: '0 transparent',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
            }}
          >
            <span>홈화면(</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', transform: 'translateY(1px)' }}>
              {copy.icon}
            </span>
            <span>)에 추가하면 더 편해요</span>
          </div>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.66)',
              wordBreak: 'keep-all',
              fontWeight: 300,
              WebkitTextStroke: '0 transparent',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
            }}
          >
            {copy.description}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={closeForSession}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.08)',
              background: '#3A3A42',
              color: '#D2D2D8',
              fontSize: 15,
              fontWeight: 300,
              cursor: 'pointer',
            }}
          >
            이번엔 닫기
          </button>
          <button
            onClick={snoozeForWeek}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 12,
              // 어두운 배경(#6B5200) 위에 어두운 글자(#1A1A1E)를 올렸더니 버튼
              // 자체도 카드 배경과 거의 구분이 안 되고 글자도 안 읽힌다는
              // 지적을 받았다 — 옆의 "이번엔 닫기"(#3A3A42 배경 + 밝은 회색
              // 글자)만큼 또렷하게, 브랜드색을 옅게 깐 배경 + 밝은 브랜드색
              // 글자로 바꿔 대비를 확실히 냈다.
              border: '1px solid rgba(255, 214, 0, 0.4)',
              background: 'rgba(255, 214, 0, 0.16)',
              color: 'var(--brand)',
              fontSize: 15,
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            7일간 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeInstallPrompt;
