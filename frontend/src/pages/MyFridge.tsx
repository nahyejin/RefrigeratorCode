import * as React from 'react';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import TextInput from '../components/TextInput';
import TagPill from '../components/TagPill';

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

  // Load from localStorage on mount (no longer needed)
  // React.useEffect(() => {
  //   const data = loadIngredients();
  //   setFrozen(data.frozen);
  //   setFridge(data.fridge);
  //   setRoom(data.room);
  // }, []);

  // Save to localStorage on change
  React.useEffect(() => {
    saveIngredients(frozen, fridge, room);
  }, [frozen, fridge, room]);

  const removeTag = (type: 'frozen' | 'fridge' | 'room', tag: string) => {
    if (type === 'frozen') setFrozen(frozen.filter((item) => item !== tag));
    if (type === 'fridge') setFridge(fridge.filter((item) => item !== tag));
    if (type === 'room') setRoom(room.filter((item) => item !== tag));
  };

  const handleAddIngredient = () => {
    const value = inputValue.trim();
    if (!value || frozen.includes(value)) return;
    setFrozen([...frozen, value]);
    setInputValue('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddIngredient();
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center" style={{ minWidth: 375 }}>
      <TopNavBar />
      {/* 타이틀 */}
      <div className="w-full flex flex-col items-center mt-5 mb-4">
        <h1 className="text-[18px] font-bold text-[#111] text-center">내 냉장고 재료 추가</h1>
      </div>
      {/* 재료 입력창 */}
      <div className="w-4/5 max-w-[300px] mb-6 flex flex-col items-center">
        <div className="flex w-full">
          <TextInput
            placeholder="추가할 재료명을 입력해주세요"
            className="h-[44px] rounded-l-lg border-[#CCCCCC] text-[14px] placeholder-[#999] flex-1"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button
            className="h-[44px] px-4 bg-gray-300 text-white rounded-r-lg text-sm font-semibold hover:bg-gray-400 transition ml-2"
            onClick={handleAddIngredient}
          >
            입력
          </button>
        </div>
      </div>
      {/* 재고 관리 구역 */}
      <div className="w-full px-5">
        <h2 className="text-[16px] font-bold text-[#111] mb-4">내 냉장고 재고 관리</h2>
        {/* 냉동보관 */}
        <div className="mb-8">
          <div className="text-[16px] font-bold mb-2 flex items-center">냉동보관 <span className="ml-1">🧊</span></div>
          <div className="flex flex-wrap gap-1">
            {frozen.map((item) => (
              <TagPill key={item} className="font-normal">{item} <span className="ml-2 text-lg font-normal cursor-pointer" onClick={() => removeTag('frozen', item)}>×</span></TagPill>
            ))}
          </div>
        </div>
        {/* 냉장보관 */}
        <div className="mb-8">
          <div className="text-[16px] font-bold mb-2 flex items-center">냉장보관 <span className="ml-1">❄️</span></div>
          <div className="flex flex-wrap gap-1">
            {fridge.map((item) => (
              <TagPill key={item} className="font-normal">{item} <span className="ml-2 text-lg font-normal cursor-pointer" onClick={() => removeTag('fridge', item)}>×</span></TagPill>
            ))}
          </div>
        </div>
        {/* 실온보관 */}
        <div className="mb-8">
          <div className="text-[16px] font-bold mb-2 flex items-center">실온보관 <span className="ml-1">🌡️</span></div>
          <div className="flex flex-wrap gap-1">
            {room.map((item) => (
              <TagPill key={item} className="font-normal">{item} <span className="ml-2 text-lg font-normal cursor-pointer" onClick={() => removeTag('room', item)}>×</span></TagPill>
            ))}
          </div>
        </div>
      </div>
      {/* 광고 영역 */}
      <div className="w-full px-5 mt-8 mb-10 flex justify-center">
        <div className="w-full max-w-[375px] h-[120px] border border-dashed border-red-500 flex flex-col items-center justify-center text-center" style={{ color: 'red', fontSize: 14 }}>
          <div className="font-bold">&lt;추후 광고 추가 할 자리&gt;</div>
          <div>타겟 소비자가 살만한 재료들을 쿠팡이나 마켓컬리의 제품과<br />바로 이동 가능하게 하는 광고 삽입하기</div>
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