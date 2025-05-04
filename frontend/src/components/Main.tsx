import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Main.css';

const Main: React.FC = () => {
  const navigate = useNavigate();

  const handleSpaceSelect = (space: 'freezer' | 'refrigerator' | 'room') => {
    // TODO: 선택된 공간에 따라 다음 페이지로 이동
    console.log(`Selected space: ${space}`);
    navigate(`/ingredients/${space}`);
  };

  return (
    <div className="main-container">
      {/* 상단 네비게이션 바 */}
      <nav className="nav-bar">
        <div className="nav-links">
          <span className="nav-link active">내 냉장고</span>
          <span className="nav-link">내 냉장고 털기</span>
          <span className="nav-link">요즘 인기</span>
          <span className="nav-link">마이페이지</span>
        </div>
        <div className="app-logo">냉털이</div>
      </nav>

      {/* 안내 문구 */}
      <div className="guide-text">
        <h2>사용자님의 보관 중인 재료를 냉장실, 냉동실, 실온으로 나눠 입력해보세요.</h2>
        <p>내가 갖고 있는 재료를 입력하면 더 정확한 레시피 추천을 받을 수 있어요.</p>
        <p>먼저, 재료가 놓여진 공간을 선택해주세요.</p>
      </div>

      {/* 공간 선택 영역 */}
      <div className="space-selection">
        {/* 냉장고 일러스트 */}
        <div className="refrigerator">
          <div 
            className="freezer-door"
            onClick={() => handleSpaceSelect('freezer')}
          >
            냉동실
          </div>
          <div 
            className="refrigerator-door"
            onClick={() => handleSpaceSelect('refrigerator')}
          >
            냉장실
          </div>
        </div>

        {/* 실온 바구니 일러스트 */}
        <div 
          className="room-temperature"
          onClick={() => handleSpaceSelect('room')}
        >
          <div className="baskets">
            {/* 6개의 바구니 */}
            {[...Array(6)].map((_, index) => (
              <div key={index} className="basket" />
            ))}
          </div>
          <span>실온 보관 공간</span>
        </div>
      </div>
    </div>
  );
};

export default Main; 