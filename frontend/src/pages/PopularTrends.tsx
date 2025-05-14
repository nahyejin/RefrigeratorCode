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
      {/* ...기존 인기 급상승 표 등 내용... */}

      {/* 인기 레시피 직접 찾아보기 검색창 */}
      <div className="mt-8 mb-24 flex items-center gap-2 w-full max-w-[360px] mx-auto">
        <input
          type="text"
          placeholder="재료명 또는 키워드로 검색"
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          className="bg-[#FFD600] text-[#222] font-bold rounded-full px-5 py-2 text-sm shadow hover:bg-yellow-300 transition"
        >검색</button>
      </div>
      <BottomNavBar activeTab="popularity" />
    </div>
  );
};

export default PopularTrends; 