import * as React from 'react';
import myfridgeBlack from '../assets/navigator_myfridge_black.png';
import myfridgeWhite from '../assets/navigator_myfridge_white.png';
import recipeWhite from '../assets/navigator_myfridgerecipe_white.png';
import recipeBlack from '../assets/navigator_myfridgerecipe_black.png';
import popularityWhite from '../assets/navigator_popularity_white.png';
import popularityBlack from '../assets/navigator_popularity_black.png';
import mypageWhite from '../assets/navigator_mypage_white.png';
import mypageBlack from '../assets/navigator_mypage_black.png';

const navs = [
  { key: 'myfridge', label: '내 냉장고', icon: myfridgeBlack, iconInactive: myfridgeWhite },
  { key: 'recipe', label: '냉장고 요리', icon: recipeBlack, iconInactive: recipeWhite },
  { key: 'popularity', label: '요즘 인기', icon: popularityBlack, iconInactive: popularityWhite },
  { key: 'mypage', label: '마이페이지', icon: mypageBlack, iconInactive: mypageWhite },
];

interface BottomNavBarProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => (
  <nav className="fixed bottom-0 left-0 w-full h-16 bg-white flex justify-around items-center border-t border-gray-200 z-10">
    {navs.map((nav) => {
      const isActive = activeTab === nav.key;
      return (
        <button
          key={nav.key}
          className="flex flex-col items-center justify-center focus:outline-none"
          onClick={() => onTabChange && onTabChange(nav.key)}
        >
          <img
            src={isActive ? nav.icon : nav.iconInactive}
            alt={nav.label}
            className="h-6 w-auto mb-1"
          />
          <span className={`text-xs ${isActive ? 'text-black font-bold' : 'text-gray-400'}`}>{nav.label}</span>
        </button>
      );
    })}
  </nav>
);

export default BottomNavBar; 