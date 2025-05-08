import React, { useState, useRef, useEffect } from 'react';
import fridgeImg from '../assets/fridge-up-open.png';
// @ts-ignore
import ingredientCsv from '../../ingredient-management/ingredient_profile_dict_with_substitutes.csv?raw';

// CSV 파싱 함수 (ingredient_name 열만 추출)
function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('ingredient_name');
  if (nameIdx === -1) return [];
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'ingredient_name');
}

// 임시 닉네임
const nickname = '홍길동';

export default function FreezerInput() {
  const [ingredientDict, setIngredientDict] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIngredientDict(parseIngredientNames(ingredientCsv));
    const saved = localStorage.getItem('freezer_ingredients');
    if (saved) setSelected(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('freezer_ingredients', JSON.stringify(selected));
  }, [selected]);

  const filtered = ingredientDict.filter(
    (item) => item.includes(input) && !selected.includes(item)
  ).slice(0, 8);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = (item: string) => {
    setSelected([...selected, item]);
    setInput('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemove = (item: string) => {
    setSelected(selected.filter((i) => i !== item));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      handleSelect(filtered[0]);
    }
    if (e.key === 'Backspace' && input === '' && selected.length > 0) {
      setSelected(selected.slice(0, -1));
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0e6] flex flex-col">
      {/* 네비게이션 바 */}
      <nav className="flex justify-between items-center px-12 py-6">
        <div className="flex gap-12 text-gray-700 text-lg font-medium">
          <span className="font-bold text-black border-b-2 border-black pb-1">내 냉장고</span>
          <span>내 냉장고 털기</span>
          <span>요즘 인기</span>
          <span>마이페이지</span>
        </div>
        <div className="text-3xl font-extrabold tracking-tight text-black">냉털이</div>
      </nav>

      {/* 안내 문구 */}
      <div className="flex justify-center mt-6">
        <div className="bg-[#222] text-white rounded-md px-8 py-4 text-xl flex items-center gap-3 shadow">
          <span className="bg-yellow-300 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">a</span>
          <span>[사용자 닉네임]님이 갖고 있는 냉동실 속 재료를 입력해주세요</span>
        </div>
      </div>

      {/* 광고 영역 */}
      <div className="border border-dashed border-red-400 rounded-md p-4 mt-8 text-center text-red-500 text-sm">
        <div className="font-semibold mb-1">&lt;이곳에 광고가 노출됩니다&gt;</div>
        <div>필요한 재료가 없으신가요?<br />쿠팡·마켓컬리에서 바로 구매할 수 있는 상품을 추천해드립니다.</div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 justify-center items-start gap-24 mt-12 px-12">
        {/* 냉장고 이미지 */}
        <div className="flex-shrink-0">
          <img src={fridgeImg} alt="냉장고" className="w-[380px] h-[540px] object-contain rounded-xl shadow" />
        </div>
        {/* 입력 박스 */}
        <div className="bg-white rounded-2xl shadow-lg p-10 w-[480px] min-h-[520px] flex flex-col">
          {/* 태그 나열 */}
          <div className="flex gap-4 mb-6">
            {selected.map((item) => (
              <span key={item} className="bg-[#444] text-white rounded-full px-6 py-2 text-lg font-semibold shadow flex items-center gap-2">
                {item}
                <button
                  className="ml-1 text-gray-300 hover:text-red-400 text-xl"
                  onClick={() => handleRemove(item)}
                  tabIndex={-1}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {/* 입력 필드 */}
          <div className="relative mb-2">
            <input
              ref={inputRef}
              type="text"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#3c3c3c] text-lg"
              placeholder="추가할 재료명을 입력 해주세요"
              value={input}
              onChange={handleInputChange}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onKeyDown={handleInputKeyDown}
              autoComplete="off"
            />
            {/* 자동완성 드롭다운 */}
            {showDropdown && filtered.length > 0 && (
              <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow z-10 max-h-48 overflow-y-auto">
                {filtered.map((item) => (
                  <li
                    key={item}
                    className="px-4 py-2 hover:bg-[#f4f0e6] cursor-pointer"
                    onMouseDown={() => handleSelect(item)}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 