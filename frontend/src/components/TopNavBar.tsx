import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const TopNavBar: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();

  return (
    <header 
      className="w-full h-[56px] flex items-center justify-between px-5 bg-white"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        maxWidth: '100%',
        margin: '0 auto',
        willChange: 'transform',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
      }}
    >
      <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto min-w-[16px]" />
      
      <div className="flex items-center gap-3">
        {isLoggedIn ? (
          <>
            <NotificationBell />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{user?.nickname}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-800"
                style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
            style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
};

export default TopNavBar; 