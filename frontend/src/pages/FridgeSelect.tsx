import * as React from 'react';
import fridgeImg from '../assets/fridge-close.png';
import trayImg from '../assets/tray.png';
import logoImg from '../assets/냉털이 로고.png';
import BottomNavBar from '../components/BottomNavBar';

// =====================
// 상수
// =====================

const CONTAINER_STYLE = {
  maxWidth: '390px',
  minHeight: '100vh'
};

const FRIDGE_SIZE = {
  width: '160px',
  height: '320px'
};

const TRAY_SIZE = {
  width: '120px',
  height: '320px'
};

const LOGO_SIZE = {
  width: '64px',
  height: '32px'
};

// =====================
// 보관 공간 설정
// =====================

const STORAGE_ZONES = [
  {
    name: '냉동실',
    position: 'absolute left-0 top-0 w-full h-[38%] rounded-t-[18px]',
    hoverRing: 'hover:ring-4 hover:ring-blue-200/60',
    focusRing: '/80'
  },
  {
    name: '냉장실',
    position: 'absolute left-0 bottom-0 w-full h-[62%] rounded-b-[18px]',
    hoverRing: 'hover:ring-4 hover:ring-green-200/60',
    focusRing: '/80'
  },
  {
    name: '실온 보관 공간',
    position: 'relative w-[120px] h-[320px] flex flex-col items-center justify-center group',
    hoverRing: 'group-hover:ring-4 group-hover:ring-yellow-200/60',
    focusRing: 'group- group-/80'
  }
];

// =====================
// 메인 컴포넌트
// =====================

const FridgeSelect: React.FC = () => {
  // =====================
  // 이벤트 핸들러
  // =====================

  /**
   * 보관 공간 선택 처리
   */
  const handleSelect = (zone: string) => {
    alert(`${zone} 선택! (추후 라우팅)`);
  };

  // =====================
  // 렌더링
  // =====================

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#f4f0e6]">
      <div 
        className="w-full flex flex-col mx-auto min-h-screen"
        style={CONTAINER_STYLE}
      >
        {/* 상단 네비게이션 */}
        <div className="flex flex-row items-center justify-between w-full py-4 px-2">
          <div className="flex gap-5 text-[16px] font-semibold text-[#1A1A1E]">
            <span className="text-black border-b-2 border-black pb-1">내 냉장고</span>
            <span className="text-[#9A9AA2]">내 냉장고 털기</span>
            <span className="text-[#9A9AA2]">요즘 인기</span>
            <span className="text-[#9A9AA2]">마이페이지</span>
          </div>
          <img 
            src={logoImg} 
            alt="냉털이 로고" 
            className="object-contain"
            style={LOGO_SIZE}
          />
        </div>
        
        {/* 안내문구 */}
        <div className="flex flex-col items-center text-center mt-2 mb-4 px-2">
          <div className="text-[16px] text-[#1A1A1E] font-medium leading-tight">
            [사용자 닉네임]님의 보관 중인 재료를 냉장실, 냉동실, 실온으로 나눠 입력해보세요.<br />
            내가 갖고 있는 재료를 입력하면 더 정확한 레시피 추천을 받을 수 있어요.
          </div>
          <div className="text-[16px] text-[#1A1A1E] font-bold mt-3">
            먼저, 재료가 놓여진 공간을 선택해주세요.
          </div>
        </div>
        
        {/* 공간 선택 영역 */}
        <div className="flex flex-row justify-center items-center flex-1 gap-4 mt-2">
          {/* 냉장고 일러스트 (냉동/냉장 클릭영역) */}
          <div 
            className="relative flex-shrink-0"
            style={FRIDGE_SIZE}
          >
            <img 
              src={fridgeImg} 
              alt="냉장고" 
              className="w-full h-full object-contain" 
            />
            
            {/* 냉동실(상단) 클릭영역 */}
            <button
              className={`${STORAGE_ZONES[0].position} ${STORAGE_ZONES[0].hoverRing} ${STORAGE_ZONES[0].focusRing} transition`}
              aria-label="냉동실"
              onClick={() => handleSelect('냉동실')}
            />
            
            {/* 냉장실(하단) 클릭영역 */}
            <button
              className={`${STORAGE_ZONES[1].position} ${STORAGE_ZONES[1].hoverRing} ${STORAGE_ZONES[1].focusRing} transition`}
              aria-label="냉장실"
              onClick={() => handleSelect('냉장실')}
            />
          </div>
          
          {/* 실온 바구니 일러스트 (전체 클릭영역) */}
          <button
            className={`${STORAGE_ZONES[2].position}`}
            aria-label="실온 보관 공간"
            onClick={() => handleSelect('실온 보관 공간')}
          >
            <img 
              src={trayImg} 
              alt="실온 바구니" 
              className={`w-full h-full object-contain rounded-[18px] ${STORAGE_ZONES[2].hoverRing} ${STORAGE_ZONES[2].focusRing} transition`}
            />
          </button>
        </div>
        
        <BottomNavBar activeTab="myfridge" />
      </div>
    </div>
  );
};

export default FridgeSelect; 