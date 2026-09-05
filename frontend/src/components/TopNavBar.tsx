import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import { useAuth } from '../context/AuthContext';
import { useUsage } from './UsageMeter';

/**
 * 상단 GNB.
 *
 * 정리 전 상태:
 *  - 로고가 16px(h-4)로 지나치게 작아 브랜드가 눈에 들어오지 않았음
 *  - 닉네임·로그아웃 버튼에 padding 이 없어 실제 터치 영역이 글자 높이만 했음
 *  - 하단 구분선이 없어 스크롤 시 본문과 헤더가 섞여 보였음
 *  - 아래 본문이 헤더에 가려지지 않도록 각 페이지가 paddingTop 을 직접 계산해 쓰고 있어
 *    헤더 높이를 바꾸면 페이지들이 전부 어긋남 → 높이를 CSS 변수로 노출
 */
const NavTextButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  strong?: boolean;
}> = ({ onClick, children, strong }) => (
  <button
    onClick={onClick}
    style={{
      height: 36,
      padding: '0 8px',
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 13,
      fontWeight: strong ? 600 : 500,
      color: strong ? 'var(--ink-900)' : 'var(--ink-500)',
      background: 'none',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      maxWidth: 140,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </button>
);

/**
 * 유료(plus)인지 무료인지를 **GNB 에서 늘 알 수 있게.**
 *
 * 전에는 마이페이지를 들어가야만 보였다. 유료로 바뀐 순간엔 토스트가 뜨지만,
 * 그 뒤로는 "지금 내가 유료였나" 를 확인할 자리가 없었다.
 *
 * PLUS 는 검정 바탕에 노랑(다른 화면의 PLUS 배지와 같은 값 — `UsageMeter.tsx`,
 * `PlanUpgradeToast.tsx`). FREE 는 흐리게 — 기본 상태라 눈에 띌 필요가 없고,
 * 그래도 "지금 무료 맞다" 는 확인은 되어야 한다.
 */
const PlanBadge: React.FC<{ isPaid: boolean }> = ({ isPaid }) => (
  <span
    aria-label={isPaid ? '유료 계정' : '무료 계정'}
    style={{
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      padding: isPaid ? '2px 7px' : '1px 6px',
      borderRadius: 9999,
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.03em',
      background: isPaid ? '#1A1A1E' : 'transparent',
      color: isPaid ? '#FFD600' : 'var(--ink-500)',
      border: isPaid ? 'none' : '1px solid var(--line-300)',
    }}
  >
    {isPaid ? 'PLUS' : 'FREE'}
  </span>
);

const TopNavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const usage = useUsage();
  const isLoginPage = location.pathname === '/login';

  return (
    <header
      className="w-full flex items-center justify-between bg-white"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        padding: '0 16px',
        zIndex: 'var(--z-nav)',
        borderBottom: '1px solid var(--line-200)',
        // 스크롤 중 헤더가 떨리지 않도록 (기존 유지)
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <button
        onClick={() => navigate('/my-fridge')}
        aria-label="홈으로"
        style={{
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <img src={logoImg} alt="쿡매치" style={{ height: 20, width: 'auto', display: 'block' }} />
      </button>

      <div className="flex items-center" style={{ gap: 2, minWidth: 0 }}>
        {isLoggedIn ? (
          <>
            <NavTextButton strong onClick={() => navigate('/my-page?openEdit=true')}>
              {user?.nickname}
            </NavTextButton>
            {/* 체험 중인 비회원(is_guest)에게는 아직 플랜이랄 게 없다 —
                회원에게만 보여 준다. */}
            {usage && !usage.is_guest && <PlanBadge isPaid={!!usage.is_paid} />}
            <NavTextButton onClick={logout}>로그아웃</NavTextButton>
          </>
        ) : (
          !isLoginPage && (
            <NavTextButton strong onClick={() => navigate('/login')}>
              로그인 / 회원가입
            </NavTextButton>
          )
        )}
      </div>
    </header>
  );
};

export default TopNavBar;
