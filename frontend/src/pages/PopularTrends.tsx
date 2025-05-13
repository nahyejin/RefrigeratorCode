import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';

const PopularTrends = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-[430px] mx-auto pb-20 pt-4 px-2 bg-white" style={{ minHeight: '100vh', boxSizing: 'border-box' }}>
      <header className="w-full h-[56px] flex items-center justify-between px-5 bg-white">
        <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto" style={{ minWidth: 16 }} />
        <div className="flex items-center gap-2">
          <button
            className="p-1 text-black bg-transparent border-none outline-none text-base"
            aria-label="뒤로가기"
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'Segoe UI Symbol, Pretendard, Arial, sans-serif',
              color: '#000',
            }}
            onClick={() => navigate(-1)}
          >↩</button>
          <img src={searchIcon} alt="검색" className="h-4 w-4 mr-1 cursor-pointer" />
        </div>
      </header>
    </div>
  );
};

export default PopularTrends; 