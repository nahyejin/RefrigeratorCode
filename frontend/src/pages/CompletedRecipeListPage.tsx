import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import FilterModal from '../components/FilterModal';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';

const dummyCompleted = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다. 저는 평소 잔거리 고를 때 마트에 가서 한 번 쭉~ 둘러 본 다음에 오늘 세일하는거 뭔가 보고 결정을 해요. 지난주 어느날에는 마트에 갔는데 오징어 세일이라 집어 왔어요 ㅎ. 그래서 이걸로 오징어요리 뭐할까하다 그냥 제일 간단한 물기없는 오징어볶음 레시피 …',
    used_ingredients: '오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
    author: '꼬마츄츄',
    date: '25-03-08',
    substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
    match: 38,
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    body: '미리 양념장을 만들어서 볶으셔도 좋고, 저처럼 그냥 바로 재료에 다 때려 넣고 볶아도 맛있는 대패삼겹살 제육볶음 레시피 만들 수 있답니다. 개인적으로 아주 좋아하는 메뉴이기 때문에 앞다리살, 목살, 삼겹살, 뒷다리살 등 구입을 해오면 볶아먹게 되는 것 같습니다. 고기와 채소, 양념이 어우러져 정말 맛있어요!',
    used_ingredients: '삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
    author: '꼬마츄츄',
    date: '25-04-09',
    substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
    match: 36,
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '미나리 오삼불고기. 술안주로 좋지요~~',
    body: '언제 먹어도 맛있죠. 누구나 다 좋아하죠. 오징어 볶음도 맛있고, 제육볶음도 맛있고 고민될 땐 오삼불고기죠 ^^. 밥한그릇 뚝딱하게 만드는 애정하는 메뉴입니다. 자. 먼저 통오징어를 먼저 손질해 줍니다. 오징어 몸통안으로 손가락을 넣어 오징어 몸통과 내장이 연결되어 …',
    used_ingredients: '오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
    author: '껌딱지',
    date: '25-04-06',
    substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
    match: 23,
  },
];

const sortOptions = [
  { key: 'match', label: '재료매칭률순' },
  { key: 'date', label: '최신순' },
];

function getMatchRate(recipeIngredients: string) {
  // For demo, just return 38/36/23 as in dummyCompleted
  // In real, parse and calculate
  return Math.floor(Math.random() * 60) + 20;
}

const CompletedRecipeListPage = () => {
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [buttonStates, setButtonStates] = useState<{ [id: number]: { done: boolean; share: boolean; write: boolean } }>({});
  const navigate = useNavigate();

  // 정렬 (여기선 match만 적용)
  let sortedRecipes = [...dummyCompleted];
  if (sortType === 'match') sortedRecipes.sort((a, b) => b.match - a.match);
  else if (sortType === 'date') sortedRecipes.sort((a, b) => b.date.localeCompare(a.date));

  const handleButtonClick = (id: number, type: 'done' | 'share' | 'write', recipe: any) => {
    const prevState = buttonStates[id] || {};
    const isActive = !!prevState[type];
    setButtonStates(prev => ({
      ...prev,
      [id]: {
        ...prevState,
        [type]: !isActive
      }
    }));
    if (type === 'done') {
      setToast(!isActive ? '레시피를 완료했습니다!' : '레시피 완료를 취소했습니다!');
      setTimeout(() => setToast(''), 1500);
    }
    if (type === 'write') {
      setToast(!isActive ? '레시피를 기록했습니다!' : '레시피 기록을 취소했습니다!');
      setTimeout(() => setToast(''), 1500);
    }
    if (type === 'share') {
      navigator.clipboard.writeText(window.location.origin + `/recipe-detail/${recipe.id}`);
      setToast('URL이 복사되었습니다!');
      setTimeout(() => setToast(''), 1500);
    }
  };

  return (
    <>
      <header className="w-full h-[56px] flex items-center justify-between px-5 bg-white">
        <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto" style={{ minWidth: 16 }} />
        <div className="flex items-center gap-2">
          <button
            className="p-1 text-black bg-transparent border-none outline-none text-base"
            aria-label="뒤로가기"
            style={{ background: 'none', border: 'none', fontFamily: 'Segoe UI Symbol, Pretendard, Arial, sans-serif', color: '#000' }}
            onClick={() => navigate(-1)}
          >↩</button>
          <img src={searchIcon} alt="검색" className="h-4 w-4 mr-1 cursor-pointer" />
        </div>
      </header>
      <div className="max-w-[430px] mx-auto pb-20 pt-4 px-2 bg-white" style={{ minHeight: '100vh', boxSizing: 'border-box' }}>
        <div className="w-full flex justify-center items-center mt-4 mb-4">
          <span className="font-bold text-[#111] flex items-center" style={{ fontSize: 18 }}>
            내가 완료한 레시피
            <img src={doneIcon} alt="완료 아이콘" className="inline-block align-middle" style={{ width: 18, height: 18, marginLeft: 4, marginBottom: 2 }} />
          </span>
        </div>
        <div className="flex gap-2 mb-4 items-center">
          <select
            className="border border-gray-300 rounded h-7 px-2 text-xs font-bold bg-white text-[#404040] focus:outline-none focus:ring-2 focus:ring-blue-200 transition min-w-[120px]"
            value={sortType}
            onChange={e => setSortType(e.target.value)}
            aria-label="정렬 기준 선택"
          >
            {sortOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
          </select>
          <button
            className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 text-gray-600 text-xs font-semibold bg-white hover:bg-gray-100"
            onClick={() => setFilterOpen(true)}
          >
            <span className="font-bold">필터</span>
          </button>
        </div>
        {filterOpen && (
          <FilterModal
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            filterState={{ 효능: [], 영양분: [], 대상: [], TPO: [], 스타일: [] }}
            setFilterState={() => {}}
            includeInput={''}
            setIncludeInput={() => {}}
            excludeInput={''}
            setExcludeInput={() => {}}
            allIngredients={[]}
            includeKeyword={''}
            setIncludeKeyword={() => {}}
          />
        )}
        <div className="flex flex-col gap-2">
          {sortedRecipes.map((recipe, idx, arr) => {
            const btnState = buttonStates[recipe.id] || {};
            // 재료 파싱
            const ingredients = recipe.used_ingredients.split(',').map((i: string) => i.trim()).filter(Boolean);
            return (
              <div
                key={recipe.id}
                className="rounded-[16px] shadow-sm p-4 min-h-[144px] relative mb-1 bg-white"
                style={{
                  ...(idx === arr.length - 1 ? { marginBottom: 40 } : {}),
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                <div className="font-bold text-[18px] text-[#222] text-left">{String(idx + 1).padStart(2, '0')}</div>
                <div className="h-[2px] w-[20px] bg-[#E5E5E5] mb-2"></div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: '200px', flexShrink: 0 }}>
                  <div
                    style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14.4px', fontWeight: 'bold', color: '#222', lineHeight: 1.2 }}
                    title={recipe.title}
                  >
                    {recipe.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '6px',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      title="완료"
                      style={{
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onClick={() => handleButtonClick(recipe.id, 'done', recipe)}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <img
                        src={btnState.done ? doneBlackIcon : doneIcon}
                        alt="완료"
                        width={19}
                        height={19}
                        style={{ display: 'block' }}
                      />
                    </button>
                    <button
                      title="공유"
                      style={{
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onClick={() => handleButtonClick(recipe.id, 'share', recipe)}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <img
                        src={btnState.share ? shareBlackIcon : shareIcon}
                        alt="공유"
                        width={19}
                        height={19}
                        style={{ display: 'block' }}
                      />
                    </button>
                    <button
                      title="기록"
                      style={{
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onClick={() => handleButtonClick(recipe.id, 'write', recipe)}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <img
                        src={btnState.write ? writeBlackIcon : writeIcon}
                        alt="기록"
                        width={19}
                        height={19}
                        style={{ display: 'block' }}
                      />
                    </button>
                  </div>
                </div>
                {/* 썸네일 + 본문 */}
                <div className="flex flex-row gap-6 items-start mb-2">
                  {/* 썸네일 + 매칭률 + 버튼 */}
                  <div className="relative min-w-[97px] max-w-[97px] h-[79px] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img
                      src={recipe.thumbnail}
                      alt="썸네일"
                      className="w-full h-full object-cover object-center"
                    />
                    {/* 재료매칭률 배지 */}
                    <div className="absolute top-1 left-1 bg-[#444] bg-opacity-90 text-white text-[10px] font-bold rounded px-1.5 py-0 flex items-center gap-1 shadow">
                      재료매칭률 <span className="text-[#FFD600] font-extrabold ml-1">{recipe.match}%</span>
                    </div>
                  </div>
                  {/* 본문 + 작성자/날짜 */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center mb-1">
                      <span className="text-[#FFD600] font-bold" style={{ fontSize: '12px', marginRight: 6 }}>{recipe.author}</span>
                      <span className="text-[#B0B0B0]" style={{ fontSize: '10.4px' }}>{recipe.date}</span>
                    </div>
                    <div
                      className="mb-2 max-h-16 overflow-y-auto pr-1 cursor-pointer custom-scrollbar"
                      style={{ fontSize: '12px', color: '#444', scrollbarWidth: 'auto' }}
                      title={recipe.body}
                    >
                      {recipe.body}
                    </div>
                  </div>
                </div>
                {/* 재료 pill */}
                <div className="flex flex-wrap gap-1 mb-1 max-h-9 overflow-y-auto custom-scrollbar pr-1" style={{ scrollbarWidth: 'auto' }}>
                  {ingredients.map((ing: string) => (
                    <span
                      key={ing}
                      className={'bg-[#555] text-white rounded-full px-3 py-0.5 font-medium'}
                      style={{ fontSize: '10.4px' }}
                    >
                      {ing}
                    </span>
                  ))}
                </div>
                {/* 대체재 */}
                {recipe.substitutes && recipe.substitutes.length > 0 && (
                  <div
                    className="mt-1 custom-scrollbar pr-1"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      maxHeight: 48,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      gap: 4,
                      paddingBottom: 4,
                      width: '100%',
                    }}
                  >
                    <span
                      className="bg-[#FFE066] text-[#444] rounded px-3 py-1 font-bold"
                      style={{ fontSize: '12px', flex: '0 0 auto' }}
                    >
                      대체 가능 :
                    </span>
                    <span
                      className="ml-2 font-semibold text-[#444]"
                      style={{
                        fontSize: '12px',
                        flex: '1 1 0',
                        minWidth: 0,
                        wordBreak: 'break-all',
                        whiteSpace: 'normal',
                      }}
                    >
                      {recipe.substitutes.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <BottomNavBar activeTab="mypage" />
        {toast && (
          <div style={{
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
            maxWidth: 260,
            width: 'max-content',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center',
          }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
};

export default CompletedRecipeListPage; 