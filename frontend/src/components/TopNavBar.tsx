import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import { useAuth } from '../context/AuthContext';

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

const TopNavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
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
