import * as React from 'react';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';
import TagPill from '../components/TagPill';
import IngredientDetailModal from '../components/IngredientDetailModal';
import SortDropdown, { SortType } from '../components/SortDropdown';
import receiptImg from '../assets/영수증.png';

// =====================
// 상수
// =====================

const STORAGE_KEY = 'myfridge_ingredients';
const TOAST_DURATION = 10000;

// =====================
// 타입 정의
// =====================

export interface Ingredient {
  id: string;
  name: string;
  expiry?: string;
  purchase?: string;
}

export type StorageBox = 'frozen' | 'fridge' | 'room';

export interface DeletedInfo {
  type: 'single' | 'all';
  box: StorageBox;
  tags: string[];
}

export interface ToastState {
  visible: boolean;
  message: string;
  deleted: DeletedInfo | null;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * localStorage에서 재료 데이터를 로드한다
 */
function loadIngredients() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data && data.frozen && data.fridge && data.room) {
      return data;
    }
  } catch (error) {
    console.warn('[Storage] 재료 데이터 로드 실패:', error);
  }
  
  return {
    frozen: [],
    fridge: [],
    room: [],
  };
}

/**
 * localStorage에 재료 데이터를 저장한다
 */
function saveIngredients(
  frozen: Ingredient[],
  fridge: Ingredient[],
  room: Ingredient[]
) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ frozen, fridge, room }));
  } catch (error) {
    console.error('[Storage] 재료 데이터 저장 실패:', error);
  }
}

/**
 * 재료를 정렬 기준에 따라 정렬한다
 */
function sortIngredients(arr: Ingredient[], sort: SortType): Ingredient[] {
  if (!arr) return [];
  
  if (sort === 'expiry') {
    const withExpiry = arr.filter(i => i.expiry);
    const withoutExpiry = arr.filter(i => !i.expiry);
    withExpiry.sort((a, b) => (a.expiry! > b.expiry! ? 1 : -1));
    // withoutExpiry는 가나다순
    withoutExpiry.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return [...withExpiry, ...withoutExpiry];
  } else if (sort === 'purchase') {
    const withPurchase = arr.filter(i => i.purchase);
    const withoutPurchase = arr.filter(i => !i.purchase);
    withPurchase.sort((a, b) => (a.purchase! > b.purchase! ? 1 : -1));
    // 구매일 없는 재료 중 유통기한 있는 것, 없는 것 분리
    const withExpiry = withoutPurchase.filter(i => i.expiry);
    const noDate = withoutPurchase.filter(i => !i.expiry);
    withExpiry.sort((a, b) => (a.expiry! > b.expiry! ? 1 : -1));
    noDate.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return [...withPurchase, ...withExpiry, ...noDate];
  } else {
    // 가나다순
    return [...arr].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
}

// =====================
// Toast 컴포넌트
// =====================

const Toast = ({ message, onUndo, onClose }: { message: string; onUndo: () => void; onClose: () => void }) => (
  <div
    style={{
      position: 'fixed',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(34,34,34,0.9)',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: 12,
      fontWeight: 400,
      fontSize: 15,
      zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      maxWidth: 320,
      width: 'max-content',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}
  >
    <span style={{ fontWeight: 600, color: '#fff', marginRight: 8, letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block' }}>삭제됨</span>
    <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={onUndo}>되돌리기</button>
    <button className="inline-flex items-center justify-center bg-[#F5F6F8] text-gray-700 font-semibold rounded-lg px-3 py-1 text-sm border border-[#E5E7EB] shadow-none hover:bg-[#E5E7EB] transition whitespace-nowrap" onClick={onClose}>닫기</button>
  </div>
);

// =====================
// 메인 컴포넌트
// =====================

const MyFridge: React.FC = () => {
  const [frozen, setFrozen] = React.useState<Ingredient[] | null>(null);
  const [fridge, setFridge] = React.useState<Ingredient[] | null>(null);
  const [room, setRoom] = React.useState<Ingredient[] | null>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [ingredientDict, setIngredientDict] = React.useState<string[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const toastTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalIngredient, setModalIngredient] = React.useState<string | null>(null);
  const [infoToast, setInfoToast] = React.useState<{text: string} | null>(null);
  const [frozenSort, setFrozenSort] = React.useState<SortType>('expiry');
  const [fridgeSort, setFridgeSort] = React.useState<SortType>('expiry');
  const [roomSort, setRoomSort] = React.useState<SortType>('expiry');

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
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('keyword');
        const categoryIdx = header.indexOf('대분류');
        if (nameIdx === -1 || categoryIdx === -1) return;
        
        const ingredients = lines.slice(1)
          .map(line => {
            const values = line.split(',');
            return {
              keyword: values[nameIdx]?.trim(),
              category: values[categoryIdx]?.trim()
            };
          })
          .filter(item => 
            item.keyword && 
            item.keyword !== 'keyword' && 
            item.category === '재료'
          )
          .map(item => item.keyword);
        
        setIngredientDict(ingredients);
      });
  }, []);

  React.useEffect(() => {
    if (frozen !== null && fridge !== null && room !== null) {
      saveIngredients(frozen, fridge, room);
    }
  }, [frozen, fridge, room]);

  const filtered = ingredientDict
    .filter(item => 
      inputValue && 
      item.includes(inputValue) && 
      !frozen?.some(f => f.name === item) &&
      !fridge?.some(f => f.name === item) &&
      !room?.some(f => f.name === item)
    )
    .sort((a, b) => {
      // 정확한 매칭을 우선시
      const aExact = a === inputValue;
      const bExact = b === inputValue;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // 시작 부분 매칭을 우선시
      const aStartsWith = a.startsWith(inputValue);
      const bStartsWith = b.startsWith(inputValue);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // 길이 순으로 정렬 (짧은 것 우선)
      return a.length - b.length;
    })
    .slice(0, 8);

  // 디버깅용: 입력값과 매칭되는 항목들 확인
  console.log('입력값:', inputValue);
  console.log('사전에서 "고구마" 포함된 항목들:', ingredientDict.filter(item => item.includes('고구마')));
  console.log('필터링된 결과:', filtered);

  const showToast = (message: string, deleted: DeletedInfo, duration?: number) => {
    setToast({ visible: true, message, deleted });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), duration ?? TOAST_DURATION);
  };

  const removeTag = (box: StorageBox, tag: string) => {
    let prev: Ingredient[] = [];
    if (box === 'frozen') prev = frozen || [];
    if (box === 'fridge') prev = fridge || [];
    if (box === 'room') prev = room || [];
    const newTags = prev.filter(t => t.id !== tag);
    const deleted: DeletedInfo = { type: 'single', box, tags: [tag] };
    if (box === 'frozen') setFrozen(newTags);
    if (box === 'fridge') setFridge(newTags);
    if (box === 'room') setRoom(newTags);
    showToast('삭제됨.', deleted);
  };

  const removeAll = (box: StorageBox) => {
    let prev: Ingredient[] = [];
    if (box === 'frozen') prev = frozen || [];
    if (box === 'fridge') prev = fridge || [];
    if (box === 'room') prev = room || [];
    const deleted: DeletedInfo = { type: 'all', box, tags: prev.map(t => t.id) };
    if (box === 'frozen') setFrozen([]);
    if (box === 'fridge') setFridge([]);
    if (box === 'room') setRoom([]);
    showToast('모두 삭제됨.', deleted, 7000);
  };

  const undoDelete = () => {
    if (!toast?.deleted) return;
    const deleted = toast.deleted;
    if (deleted.box === 'frozen') setFrozen(prev => deleted.type === 'all' ? deleted.tags.map(id => ({ id, name: id.split('-')[0] })) : [...(prev ?? []), ...deleted.tags.map(id => ({ id, name: id.split('-')[0] }))]);
    if (deleted.box === 'fridge') setFridge(prev => deleted.type === 'all' ? deleted.tags.map(id => ({ id, name: id.split('-')[0] })) : [...(prev ?? []), ...deleted.tags.map(id => ({ id, name: id.split('-')[0] }))]);
    if (deleted.box === 'room') setRoom(prev => deleted.type === 'all' ? deleted.tags.map(id => ({ id, name: id.split('-')[0] })) : [...(prev ?? []), ...deleted.tags.map(id => ({ id, name: id.split('-')[0] }))]);
    setToast(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = (item: string) => {
    setModalIngredient(item);
    setModalOpen(true);
    setInputValue('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filtered.length > 0) {
        // 자동완성 목록에서 첫 번째 항목 선택
        handleSelect(filtered[0]);
      } else if (inputValue.trim()) {
        // 입력된 값이 사전에 있는지 확인
        const exactMatch = ingredientDict.find(item => item === inputValue.trim());
        if (exactMatch) {
          handleSelect(exactMatch);
        } else {
          // 사전에 없는 경우 경고 표시
          alert('사전에 등록되지 않은 재료입니다. 자동완성 목록에서 선택해주세요.');
        }
      }
    }
    if (e.key === 'Backspace' && inputValue === '' && (frozen && frozen.length > 0)) {
      setFrozen((frozen ?? []).slice(0, -1));
    }
  };

  const handleModalComplete = (data: { ingredient: string; storageType: StorageBox; hasExpiration: boolean; date: string | null; }) => {
    const obj = { 
      id: `${data.ingredient}-${Date.now()}`,
      name: data.ingredient 
    } as Ingredient;
    if (data.hasExpiration && data.date) obj.expiry = data.date;
    if (!data.hasExpiration && data.date) obj.purchase = data.date;
    if (data.storageType === 'frozen') setFrozen(prev => prev ? [...prev, obj] : [obj]);
    if (data.storageType === 'fridge') setFridge(prev => prev ? [...prev, obj] : [obj]);
    if (data.storageType === 'room') setRoom(prev => prev ? [...prev, obj] : [obj]);
    setModalOpen(false);
    setModalIngredient(null);
  };

  const handleTagInfo = (item: Ingredient) => {
    if (item.expiry) setInfoToast({ text: `유통기한 : ${item.expiry}` });
    else if (item.purchase) setInfoToast({ text: `구매시점 : ${item.purchase}` });
    else setInfoToast({ text: '날짜 정보가 없습니다.' });
    setTimeout(() => setInfoToast(null), 3000);
  };

  const handleRemoveAll = (box: StorageBox) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      removeAll(box);
    }
  };

  if (frozen === null || fridge === null || room === null) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white w-full" style={{position: 'sticky', top: 0, zIndex: 10}}>
        <TopNavBar />
      </div>
      <div className="bg-white w-full p-0 m-0 pb-24">
        {/* 타이틀+입력창 그룹 */}
        <div className="flex flex-col items-center justify-center w-full" style={{ marginTop: 40, marginBottom: 40 }}>
          <h1 className="text-[18px] font-bold text-[#111] text-center mb-2">내 냉장고 재료 추가</h1>
        </div>
        <div style={{ maxWidth: 360, margin: '0 auto', paddingLeft: 20, paddingRight: 20, width: '100%' }}>
          <div
            className="flex gap-2 mb-4"
            style={{
              width: '100%',
              maxWidth: 360,
              margin: '0 auto',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: 250, minWidth: 0, flex: '0 1 auto' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="추가할 재료명을 입력하세요"
                className="border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                style={{
                  width: '100%',
                  height: 40,
                  fontFamily: 'Pretendard, sans-serif',
                }}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {filtered.map((item, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSelect(item)}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="bg-[#FFD600] text-[#222] font-bold rounded-full px-5 py-2 text-sm shadow hover:bg-yellow-300 transition whitespace-nowrap"
              style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 18px', fontSize: 15, marginLeft: 0 }}
              onClick={() => filtered.length > 0 && handleSelect(filtered[0])}
              disabled={filtered.length === 0}
            >
              입력
            </button>
            <button
              type="button"
              className="bg-[#e5e5e5] text-[#222] font-bold rounded-2xl px-2 py-2 text-sm shadow transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#ccc] focus:border-[#ccc]"
              style={{ display: 'flex', alignItems: 'center', height: 40, minWidth: 40, padding: 0, fontSize: 15, marginLeft: 0, border: '1px solid #e5e5e5', justifyContent: 'center', borderRadius: 20 }}
              onClick={() => alert('영수증 인식 기능은 곧 지원될 예정입니다!')}
              title="영수증 인식(구현 예정)"
            >
              <img src={receiptImg} alt="영수증" style={{ width: 22, height: 22, objectFit: 'contain', display: 'block' }} />
            </button>
          </div>
        </div>
        {/* IngredientDetailModal */}
        <IngredientDetailModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setModalIngredient(null); }}
          ingredient={modalIngredient || ''}
          onComplete={handleModalComplete}
        />
        {/* 재고 관리 구역 */}
        <div style={{ maxWidth: 360, margin: '0 auto', paddingLeft: 16, paddingRight: 16, width: '100%', marginTop: 48 }}>
          <h2 className="text-[16px] font-bold text-[#111] mb-2">내 냉장고 재고 관리</h2>
          <div style={{height: 2, width: '100%', background: '#E5E5E5', marginBottom: 16}} />
          {/* 냉동보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <span className="mr-1">🧊</span>냉동보관
              <SortDropdown value={frozenSort} onChange={setFrozenSort} className="ml-2" />
              {(frozen ?? []).length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('frozen')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <div
              style={{
                background: '#F5F6F8',
                borderRadius: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                padding: 16,
                maxHeight: '140px',
                minHeight: '140px',
                border: 'none',
                marginBottom: 16,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
            >
              {(frozen ?? []).length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(frozen ?? [], frozenSort).map((item) => (
                <TagPill key={item.id + '-' + item.name} style={{ fontSize: 11 }} onClick={() => handleTagInfo(item)}>
                  <span className="truncate max-w-[110px]">{item.name}</span>
                  <span className="relative flex-shrink-0 ml-2" style={{ width: 20, height: 24, display: 'inline-block' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '85%',
                        top: '40%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 16,
                        fontWeight: 300,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                      onClick={e => { e.stopPropagation(); removeTag('frozen', item.id); }}
                    >
                      x
                    </span>
                  </span>
                </TagPill>
              ))}
            </div>
          </div>
          {/* 냉장보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <span className="mr-1">❄️</span>냉장보관
              <SortDropdown value={fridgeSort} onChange={setFridgeSort} className="ml-2" />
              {fridge && fridge.length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('fridge')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <div
              style={{
                background: '#F5F6F8',
                borderRadius: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                padding: 16,
                maxHeight: '140px',
                minHeight: '140px',
                border: 'none',
                marginBottom: 16,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
            >
              {fridge && fridge.length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(fridge ?? [], fridgeSort).map((item) => (
                <TagPill key={item.id + '-' + item.name} style={{ fontSize: 11 }} onClick={() => handleTagInfo(item)}>
                  <span className="truncate max-w-[110px]">{item.name}</span>
                  <span className="relative flex-shrink-0 ml-2" style={{ width: 20, height: 24, display: 'inline-block' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '85%',
                        top: '40%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 16,
                        fontWeight: 300,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                      onClick={e => { e.stopPropagation(); removeTag('fridge', item.id); }}
                    >
                      x
                    </span>
                  </span>
                </TagPill>
              ))}
            </div>
          </div>
          {/* 실온보관 */}
          <div className="mb-4">
            <div className="text-[16px] font-bold mb-2 flex items-center">
              <span className="mr-1">🌡️</span>실온보관
              <SortDropdown value={roomSort} onChange={setRoomSort} className="ml-2" />
              {room && room.length > 0 && (
                <button
                  className="ml-2 h-6 px-2 py-0 text-xs font-medium rounded border border-gray-300 bg-white text-[#404040] hover:bg-[#F5F6F8] active:bg-[#E5E7EB] transition whitespace-nowrap"
                  onClick={() => handleRemoveAll('room')}
                >
                  모두삭제
                </button>
              )}
            </div>
            <div
              style={{
                background: '#F5F6F8',
                borderRadius: 20,
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                padding: 16,
                maxHeight: '140px',
                minHeight: '140px',
                border: 'none',
                marginBottom: 16,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              className="custom-scrollbar"
            >
              {room && room.length === 0 && (
                <div className="text-gray-400 text-xs py-1">재료가 아직 없어요</div>
              )}
              {sortIngredients(room ?? [], roomSort).map((item) => (
                <TagPill key={item.id + '-' + item.name} style={{ fontSize: 11 }} onClick={() => handleTagInfo(item)}>
                  <span className="truncate max-w-[110px]">{item.name}</span>
                  <span className="relative flex-shrink-0 ml-2" style={{ width: 20, height: 24, display: 'inline-block' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '85%',
                        top: '40%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 16,
                        fontWeight: 300,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                      onClick={e => { e.stopPropagation(); removeTag('room', item.id); }}
                    >
                      x
                    </span>
                  </span>
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
          <Toast message={toast.message} onUndo={undoDelete} onClose={() => setToast(null)} />
        )}
        {infoToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white border border-gray-300 rounded-lg px-6 py-3 text-[#404040] text-sm shadow-lg z-[9999]">
            {infoToast.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyFridge; 