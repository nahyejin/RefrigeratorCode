import * as React from 'react';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';

const TopNavBar: React.FC = () => (
  <header className="w-full h-[56px] flex items-center justify-between px-5 bg-white">
    <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto" style={{ minWidth: 16 }} />
    <img src={searchIcon} alt="검색" className="h-4 w-4 mr-1 cursor-pointer" />
  </header>
);

export default TopNavBar; 