import * as React from 'react';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import TagPill from '../components/TagPill';

function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('ingredient_name');
  if (nameIdx === -1) return [];
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'ingredient_name');
}

const initialFrozen = ['청양고추', '만두', '대파', '표고버섯', '떡갈비', '고구마'];
const initialFridge = ['계란', '두부', '쌈장', '우유', '파스타면', '두부면'];
const initialRoom = ['아몬드', '양파'];
const STORAGE_KEY = 'myfridge_ingredients';

function loadIngredients() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data && data.frozen && data.fridge && data.room) {
      return data;
    }
  } catch {}
  return {
    frozen: initialFrozen,
    fridge: initialFridge,
    room: initialRoom,
  };
}

function saveIngredients(frozen: string[], fridge: string[], room: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ frozen, fridge, room }));
}

const MyFridge: React.FC = () => {
  const [frozen, setFrozen] = React.useState<string[]>(() => loadIngredients().frozen);
  const [fridge, setFridge] = React.useState<string[]>(() => loadIngredients().fridge);
  const [room, setRoom] = React.useState<string[]>(() => loadIngredients().room);
  const [inputValue, setInputValue] = React.useState('');
  const [ingredientDict, setIngredientDict] = React.useState<string[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setIngredientDict(parseIngredientNames(csv));
      });
  }, []);

  React.useEffect(() => {
    saveIngredients(frozen, fridge, room);
  }, [frozen, fridge, room]);

  const filtered = ingredientDict.filter(
    (item) => inputValue && item.includes(inputValue) && !frozen.includes(item)
  ).slice(0, 8);

  const removeTag = (type: 'frozen' | 'fridge' | 'room', tag: string) => {
    if (type === 'frozen') setFrozen(frozen.filter((item) => item !== tag));
    if (type === 'fridge') setFridge(fridge.filter((item) => item !== tag));
    if (type === 'room') setRoom(room.filter((item) => item !== tag));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = (item: string) => {
    setFrozen([...frozen, item]);
    setInputValue('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      handleSelect(filtered[0]);
    }
    if (e.key === 'Backspace' && inputValue === '' && frozen.length > 0) {
      setFrozen(frozen.slice(0, -1));
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center" style={{ minWidth: 375 }}>
      <TopNavBar />
      {/* 타이틀 */}
      <div className="w-full flex flex-col items-center mt-5 mb-4">
        <h1 className="text-[18px] font-bold text-[#111] text-center">내 냉장고 재료 추가</h1>
      </div>
      {/* 재료 입력창 (자동완성) */}
      <div className="w-full max-w-[316px] mt-12 mb-10 flex flex-col items-center">
        <div className="flex w-full relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="추가할 재료명을 입력해주세요."
            className="h-[44px] border border-gray-300 text-[14px] placeholder-[#999] flex-1 px-4 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-md"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
          />
          <button
            className="h-[44px] px-5 bg-gray-400 text-white rounded-md text-sm font-semibold hover:bg-gray-500 transition ml-2 whitespace-nowrap"
            onClick={() => filtered.length > 0 && handleSelect(filtered[0])}
            disabled={filtered.length === 0}
          >
            입력
          </button>
          {/* 자동완성 드롭다운 */}
          {showDropdown && filtered.length > 0 && (
            <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-12 shadow z-10 max-h-48 overflow-y-auto">
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
      {/* 재고 관리 구역 */}
      <div className="w-full px-5 mt-12">
        <h2 className="text-[16px] font-bold text-[#111] mb-2">내 냉장고 재고 관리</h2>
        <div className="border-t border-gray-200 mb-6"></div>
        {/* 냉동보관 */}
        <div className="mb-4">
          <div className="text-[16px] font-bold mb-2 flex items-center">냉동보관 <span className="ml-1">🧊</span></div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 overflow-y-auto overflow-x-hidden always-scrollbar">
            {frozen.map((item) => (
              <TagPill key={item} style={{ fontSize: 11 }}>
                {item} <span className="ml-2 text-[13px] font-normal cursor-pointer flex items-center leading-none relative" style={{ top: '-1.5px' }} onClick={() => removeTag('frozen', item)}>×</span>
              </TagPill>
            ))}
          </div>
        </div>
        {/* 냉장보관 */}
        <div className="mb-4">
          <div className="text-[16px] font-bold mb-2 flex items-center">냉장보관 <span className="ml-1">❄️</span></div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 overflow-y-auto overflow-x-hidden always-scrollbar">
            {fridge.map((item) => (
              <TagPill key={item} style={{ fontSize: 11 }}>
                {item} <span className="ml-2 text-[13px] font-normal cursor-pointer flex items-center leading-none relative" style={{ top: '-1.5px' }} onClick={() => removeTag('fridge', item)}>×</span>
              </TagPill>
            ))}
          </div>
        </div>
        {/* 실온보관 */}
        <div className="mb-4">
          <div className="text-[16px] font-bold mb-2 flex items-center">실온보관 <span className="ml-1">🌡️</span></div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 overflow-y-auto overflow-x-hidden always-scrollbar">
            {room.map((item) => (
              <TagPill key={item} style={{ fontSize: 11 }}>
                {item} <span className="ml-2 text-[13px] font-normal cursor-pointer flex items-center leading-none relative" style={{ top: '-1.5px' }} onClick={() => removeTag('room', item)}>×</span>
              </TagPill>
            ))}
          </div>
        </div>
      </div>
      {/* 광고 영역 */}
      <div className="w-full px-5 mt-16 mb-44 flex justify-center" style={{position: 'static', zIndex: 0}}>
        <div className="w-full max-w-[375px] h-[120px] border border-dashed border-red-500 flex flex-col items-center justify-center text-center" style={{ color: 'red', fontSize: 14 }}>
          <div className="font-bold">&lt;이곳에 광고가 노출됩니다&gt;</div>
          <div>필요한 재료가 없으신가요?<br />쿠팡·마켓컬리에서 바로 구매할 수 있는 상품을 추천해드립니다.</div>
        </div>
      </div>
      {/* 하단 내비게이션 */}
      <div className="w-full">
        <BottomNavBar activeTab="myfridge" />
      </div>
    </div>
  );
};

export default MyFridge; 