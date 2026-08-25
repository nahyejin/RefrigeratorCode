import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import { useAuth } from '../context/AuthContext';

const TopNavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const isLoginPage = location.pathname === '/login';

  return (
    <header 
      className="w-full h-[56px] flex items-center justify-between px-5 bg-white"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 'var(--z-nav)',
        maxWidth: '100%',
        margin: '0 auto',
        willChange: 'transform',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
      }}
    >
      <img 
        src={logoImg} 
        alt="냉털이 로고" 
        className="h-4 w-auto min-w-[16px] cursor-pointer" 
        onClick={() => navigate('/my-fridge')}
      />
      
      <div className="flex items-center gap-3">
        {isLoggedIn ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/my-page?openEdit=true')}
              className="font-normal text-gray-700 hover:text-gray-900"
              style={{
                fontSize: '11px',
                outline: 'none',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {user?.nickname}
            </button>
            <button
              onClick={logout}
              className="font-normal text-gray-700 hover:text-gray-900"
              style={{ 
                outline: 'none', 
                border: 'none', 
                background: 'none', 
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          !isLoginPage && (
            <button
              onClick={() => navigate('/login')}
              className="font-normal text-gray-700 hover:text-gray-900"
              style={{ 
                outline: 'none', 
                border: 'none', 
                background: 'none', 
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              로그인/회원가입
            </button>
          )
        )}
      </div>
    </header>
  );
};

export default TopNavBar; 