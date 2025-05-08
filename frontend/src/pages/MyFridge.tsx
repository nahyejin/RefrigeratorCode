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

const TOAST_DURATION = 3000;

const Toast = ({ message, onUndo, onClose }: { message: string; onUndo: () => void; onClose: () => void }) => (
  <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-[#B0B0B0] text-white px-4 py-2 rounded-full shadow-lg flex items-center z-50 text-sm gap-2 min-w-[240px] max-w-[90vw]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
    <span className="font-bold text-white mr-2 whitespace-nowrap inline-block">삭제됨</span>
    <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-[#404040] rounded-lg px-3 py-1 text-sm font-semibold border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={onUndo}>되돌리기</button>
    <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-[#404040] rounded-lg px-3 py-1 text-sm font-semibold border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={onClose}>닫기</button>
  </div>
);

const MyFridge: React.FC = () => {
  const [frozen, setFrozen] = React.useState<string[] | null>(null);
  const [fridge, setFridge] = React.useState<string[] | null>(null);
  const [room, setRoom] = React.useState<string[] | null>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [ingredientDict, setIngredientDict] = React.useState<string[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [toast, setToast] = React.useState<{visible: boolean, message: string, onUndo: () => void} | null>(null);
  const toastTimeout = React.useRef<number | null>(null);
  const [lastDeleted, setLastDeleted] = React.useState<{type: 'single'|'all', box: 'frozen'|'fridge'|'room', tags: string[]}>();

  React.useEffect(() => {
    const loaded = loadIngredients();
    setFrozen(loaded.frozen);
    setFridge(loaded.fridge);
    setRoom(loaded.room);
  }, []);

  React.useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setIngredientDict(parseIngredientNames(csv));
      });
  }, []);

  React.useEffect(() => {
    if (frozen !== null && fridge !== null && room !== null) {
      saveIngredients(frozen, fridge, room);
    }
  }, [frozen, fridge, room]);

  const filtered = ingredientDict.filter(
    (item) => inputValue && item.includes(inputValue) && !frozen?.includes(item)
  ).slice(0, 8);

  const removeTag = (box: 'frozen'|'fridge'|'room', tag: string) => {
    let prev: string[] = [];
    if (box === 'frozen') prev = frozen || [];
    if (box === 'fridge') prev = fridge || [];
    if (box === 'room') prev = room || [];
    const newTags = prev.filter(t => t !== tag);
    if (box === 'frozen') setFrozen(newTags);
    if (box === 'fridge') setFridge(newTags);
    if (box === 'room') setRoom(newTags);
    setLastDeleted({ type: 'single', box, tags: [tag] });
    showToast('삭제됨.', () => undoDelete());
  };

  const removeAll = (box: 'frozen'|'fridge'|'room') => {
    let prev: string[] = [];
    if (box === 'frozen') prev = frozen || [];
    if (box === 'fridge') prev = fridge || [];
    if (box === 'room') prev = room || [];
    if (box === 'frozen') setFrozen([]);
    if (box === 'fridge') setFridge([]);
    if (box === 'room') setRoom([]);
    setLastDeleted({ type: 'all', box, tags: prev });
    showToast('모두 삭제됨.', () => undoDelete());
  };

  const undoDelete = () => {
    if (!lastDeleted) return;
    if (lastDeleted.box === 'frozen') setFrozen(prev => lastDeleted.type === 'all' ? lastDeleted.tags : [...(prev ?? []), ...lastDeleted.tags]);
    if (lastDeleted.box === 'fridge') setFridge(prev => lastDeleted.type === 'all' ? lastDeleted.tags : [...(prev ?? []), ...lastDeleted.tags]);
    if (lastDeleted.box === 'room') setRoom(prev => lastDeleted.type === 'all' ? lastDeleted.tags : [...(prev ?? []), ...lastDeleted.tags]);
    setToast(null);
  };

  const showToast = (message: string, onUndo: () => void) => {
    setToast({ visible: true, message, onUndo });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = (item: string) => {
    setFrozen(prev => prev ? [...prev, item] : [item]);
    setInputValue('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      handleSelect(filtered[0]);
    }
    if (e.key === 'Backspace' && inputValue === '' && frozen?.length > 0) {
      setFrozen((frozen ?? []).slice(0, -1));
    }
  };

  if (frozen === null || fridge === null || room === null) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center" style={{ minWidth: 375 }}>
      <TopNavBar />
      {/* 타이틀 + 입력창을 한 덩어리로 묶어서 타이틀을 입력창 바로 위로 이동 */}
      <div className="w-full max-w-[316px] mt-20 mb-10 flex flex-col items-center">
        <h1 className="text-[18px] font-bold text-[#111] text-center mb-4">내 냉장고 재료 추가</h1>
        <div className="flex w-full relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="추가할 재료명을 입력해주세요"
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
          <div className="text-[16px] font-bold mb-2 flex items-center">냉동보관 <span className="ml-1">🧊</span>
            {frozen && frozen.length > 0 && (
              <button
                className="ml-2 px-1 py-0 text-xs font-normal rounded border border-[#B0B0B0] bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                onClick={() => removeAll('frozen')}
              >
                모두삭제
              </button>
            )}
          </div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ maxHeight: '140px', minHeight: '140px' }}>
            {(frozen ?? []).length === 0 && (
              <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
            )}
            {(frozen ?? []).map((item) => (
              <TagPill key={item} style={{ fontSize: 11 }}>
                <span className="truncate max-w-[110px]">{item}</span>
                <span className="flex-shrink-0 ml-2 text-[12px] font-normal cursor-pointer grid place-items-center h-6 w-4" style={{ position: 'relative', top: '2px' }} onClick={() => removeTag('frozen', item)}>×</span>
              </TagPill>
            ))}
          </div>
        </div>
        {/* 냉장보관 */}
        <div className="mb-4">
          <div className="text-[16px] font-bold mb-2 flex items-center">냉장보관 <span className="ml-1">❄️</span>
            {fridge && fridge.length > 0 && (
              <button
                className="ml-2 px-1 py-0 text-xs font-normal rounded border border-[#B0B0B0] bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                onClick={() => removeAll('fridge')}
              >
                모두삭제
              </button>
            )}
          </div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ maxHeight: '140px', minHeight: '140px' }}>
            {fridge && fridge.length === 0 && (
              <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
            )}
            {fridge && fridge.map((item) => (
              <TagPill key={item} style={{ fontSize: 11 }}>
                <span className="truncate max-w-[110px]">{item}</span>
                <span className="flex-shrink-0 ml-2 text-[12px] font-normal cursor-pointer grid place-items-center h-6 w-4" style={{ position: 'relative', top: '2px' }} onClick={() => removeTag('fridge', item)}>×</span>
              </TagPill>
            ))}
          </div>
        </div>
        {/* 실온보관 */}
        <div className="mb-4">
          <div className="text-[16px] font-bold mb-2 flex items-center">실온보관 <span className="ml-1">🌡️</span>
            {room && room.length > 0 && (
              <button
                className="ml-2 px-1 py-0 text-xs font-normal rounded border border-[#B0B0B0] bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                onClick={() => removeAll('room')}
              >
                모두삭제
              </button>
            )}
          </div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ maxHeight: '140px', minHeight: '140px' }}>
            {room && room.length === 0 && (
              <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
            )}
            {room && room.map((item) => (
              <TagPill key={item} style={{ fontSize: 11 }}>
                <span className="truncate max-w-[110px]">{item}</span>
                <span className="flex-shrink-0 ml-2 text-[12px] font-normal cursor-pointer grid place-items-center h-6 w-4" style={{ position: 'relative', top: '2px' }} onClick={() => removeTag('room', item)}>×</span>
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
      {toast && toast.visible && (
        <Toast message={toast.message} onUndo={toast.onUndo} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default MyFridge; 