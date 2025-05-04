import * as React from 'react';
import fridgeImg from '../assets/fridge-close.png';
import trayImg from '../assets/tray.png';
import logoImg from '../assets/냉털이 로고.png';

const FridgeSelect: React.FC = () => {
  // 클릭 핸들러 (임시 alert)
  const handleSelect = (zone: string) => {
    alert(`${zone} 선택! (추후 라우팅)`);
  };

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#f4f0e6]">
      <div className="w-full max-w-[390px] flex flex-col mx-auto min-h-screen">
        {/* 상단 네비게이션 */}
        <div className="flex flex-row items-center justify-between w-full py-4 px-2">
          <div className="flex gap-5 text-[15px] font-semibold text-[#222]">
            <span className="text-black border-b-2 border-black pb-1">내 냉장고</span>
            <span className="text-[#888]">내 냉장고 털기</span>
            <span className="text-[#888]">요즘 인기</span>
            <span className="text-[#888]">마이페이지</span>
          </div>
          <img src={logoImg} alt="냉털이 로고" className="w-16 h-8 object-contain" />
        </div>
        {/* 안내문구 */}
        <div className="flex flex-col items-center text-center mt-2 mb-4 px-2">
          <div className="text-[15px] text-[#222] font-medium leading-tight">
            [사용자 닉네임]님의 보관 중인 재료를 냉장실, 냉동실, 실온으로 나눠 입력해보세요.<br />
            내가 갖고 있는 재료를 입력하면 더 정확한 레시피 추천을 받을 수 있어요.
          </div>
          <div className="text-[16px] text-[#222] font-bold mt-3">먼저, 재료가 놓여진 공간을 선택해주세요.</div>
        </div>
        {/* 공간 선택 영역 */}
        <div className="flex flex-row justify-center items-center flex-1 gap-4 mt-2">
          {/* 냉장고 일러스트 (냉동/냉장 클릭영역) */}
          <div className="relative w-[160px] h-[320px] flex-shrink-0">
            <img src={fridgeImg} alt="냉장고" className="w-full h-full object-contain" />
            {/* 냉동실(상단) 클릭영역 */}
            <button
              className="absolute left-0 top-0 w-full h-[38%] rounded-t-[18px] hover:ring-4 hover:ring-blue-200/60 focus:ring-4 focus:ring-blue-300/80 transition"
              aria-label="냉동실"
              onClick={() => handleSelect('냉동실')}
            />
            {/* 냉장실(하단) 클릭영역 */}
            <button
              className="absolute left-0 bottom-0 w-full h-[62%] rounded-b-[18px] hover:ring-4 hover:ring-green-200/60 focus:ring-4 focus:ring-green-300/80 transition"
              aria-label="냉장실"
              onClick={() => handleSelect('냉장실')}
            />
          </div>
          {/* 실온 바구니 일러스트 (전체 클릭영역) */}
          <button
            className="relative w-[120px] h-[320px] flex flex-col items-center justify-center group"
            aria-label="실온 보관 공간"
            onClick={() => handleSelect('실온 보관 공간')}
          >
            {/* 바구니 3단 */}
            <img src={trayImg} alt="실온 바구니" className="w-full h-full object-contain rounded-[18px] group-hover:ring-4 group-hover:ring-yellow-200/60 group-focus:ring-4 group-focus:ring-yellow-300/80 transition" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FridgeSelect; 