import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import myfridgeBlack from '../assets/navigator_myfridge_black.png';
import myfridgeWhite from '../assets/navigator_myfridge_white.png';
import recipeWhite from '../assets/navigator_myfridgerecipe_white.png';
import recipeBlack from '../assets/navigator_myfridgerecipe_black.png';
import popularityWhite from '../assets/navigator_popularity_white.png';
import popularityBlack from '../assets/navigator_popularity_black.png';
import mypageWhite from '../assets/navigator_mypage_white.png';
import mypageBlack from '../assets/navigator_mypage_black.png';

// 상수 정의
const CONSTANTS = {
  NAV_HEIGHT: 16, // 네비게이션 바 높이 (rem)
  ICON_HEIGHT: 6, // 아이콘 높이 (rem)
  BORDER_OFFSET: 16 // 상단 테두리 오프셋 (rem)
} as const;

// 네비게이션 데이터
const NAVIGATION_ITEMS = [
  { 
    key: 'myfridge', 
    label: '내냉장고', 
    icon: myfridgeBlack, 
    iconInactive: myfridgeWhite, 
    path: '/my-fridge' 
  },
  { 
    key: 'recipe', 
    label: '냉장고요리', 
    icon: recipeBlack, 
    iconInactive: recipeWhite, 
    path: '/recipe-list' 
  },
  { 
    key: 'popularity', 
    label: '요즘인기', 
    icon: popularityBlack, 
    iconInactive: popularityWhite, 
    path: '/popular' 
  },
  { 
    key: 'mypage', 
    label: '마이페이지', 
    icon: mypageBlack, 
    iconInactive: mypageWhite, 
    path: '/my-page' 
  },
] as const;

// 스타일 상수
const STYLES = {
  border: {
    position: 'fixed' as const,
    bottom: `${CONSTANTS.BORDER_OFFSET}rem`,
    left: 0,
    width: '100%',
    borderTop: '1px solid #E6E6EA',
    zIndex: 30
  },
  nav: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    width: '100%',
    height: `${CONSTANTS.NAV_HEIGHT}rem`,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 'var(--z-nav)'
  },
  navButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer'
  },
  navIcon: {
    height: `${CONSTANTS.ICON_HEIGHT}rem`,
    width: 'auto',
    marginBottom: '0.25rem'
  }
};

interface BottomNavBarProps {
  activeTab: string;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab }) => {
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <div className="fixed bottom-16 left-0 w-full border-t border-gray-200 z-30"></div>
      <nav className="fixed bottom-0 left-0 w-full h-16 bg-white flex justify-around items-center z-[var(--z-nav)]">
        {NAVIGATION_ITEMS.map((nav) => {
          const isActive = activeTab === nav.key;
          return (
            <button
              key={nav.key}
              className="flex flex-col items-center justify-center focus:outline-none bg-transparent"
              style={{
                outline: 'none',
                border: 'none',
                background: 'transparent',
                WebkitTapHighlightColor: 'transparent',
                tapHighlightColor: 'transparent'
              }}
              onClick={() => handleNavigation(nav.path)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <img
                src={isActive ? nav.icon : nav.iconInactive}
                alt={nav.label}
                className="h-6 w-auto mb-1"
              />
              <span 
                className={`text-xs tracking-tight ${isActive ? 'text-black font-bold' : 'text-gray-400'}`}
              >
                {nav.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default BottomNavBar; 