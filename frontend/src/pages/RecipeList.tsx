import React, { useState, useEffect } from 'react';
import BottomNavBar from '../components/BottomNavBar';
import { useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
// import { FaFilter } from 'react-icons/fa'; // 아이콘 없으면 주석처리

const sortOptions = [
  { key: 'match', label: '재료매칭률' },
  { key: 'expiry', label: '유통기한 임박순' },
  { key: 'like', label: '좋아요순' },
  { key: 'comment', label: '댓글순' },
  { key: 'latest', label: '최신순' },
];

const categoryOptions = ['한식', '중식', '양식'];
const timeOptions = ['30분 이하', '1시간 이하', '상관없음'];

// 더미 fetch 함수 (실제 API 연동 전용)
function fetchRecipesDummy() {
  return Promise.resolve([
    {
      id: 1,
      thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
      title: '오징어볶음 레시피 만드는법 간단',
      body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다.\n저는 평소 찬거리 고를 때 마트에 가서 한 번 쭉~ 둘러 본 다음에 오늘 세일하는거 뭔가 보고 결정을 해요.\n지난주 어느날에는 마트에 갔는데 오징어 세일이라 집어 왔어요 ㅎ. 그래서 이걸로 오징어요리 뭐할까하다 그냥 제일 간단한 물기없는 오징어볶음 레시피 …',
      used_ingredients: '오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
      author: '꼬마츄츄',
      date: '25-03-08',
      like: 77,
      comment: 12,
      substitutes: ['양파→대파', '고추장→된장'],
    },
    {
      id: 2,
      thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80', // 대패삼겹살 제육볶음 (사용자 두번째 이미지)
      title: '대패삼겹살 제육볶음 레시피',
      body: '미리 양념장을 만들어서 볶으셔도 좋고, 저처럼 그냥 바로 재료에 다 때려 넣고 볶아도 맛있는 대패삼겹살 제육볶음 레시피 만들 수 있답니다.\n개인적으로 아주 좋아하는 메뉴이기 때문에 앞다리살, 목살, 삼겹살, 뒷다리살 등 구입을 해오면 볶아먹게 되는 것 같습니다.\n고기와 채소, 양념이 어우러져 정말 맛있어요!',
      used_ingredients: '삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
      author: '꼬마츄츄',
      date: '25-04-09',
      like: 55,
      comment: 8,
      substitutes: ['맛술→소주', '미림→청주', '오징어→한치'],
    },
    {
      id: 3,
      thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80', // 미나리 오삼불고기 (사용자 첫번째 이미지)
      title: '미나리 오삼불고기. 술안주로 좋지요~~',
      body: '언제 먹어도 맛있죠. 누구나 다 좋아하죠. 오징어 볶음도 맛있고, 제육볶음도 맛있고 고민될 땐 오삼불고기죠 ^^.\n밥한그릇 뚝딱하게 만드는 애정하는 메뉴입니다.\n자. 먼저 통오징어를 먼저 손질해 줍니다. 오징어 몸통안으로 손가락을 넣어 오징어 몸통과 내장이 연결되어 …',
      used_ingredients: '오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
      author: '껌딱지',
      date: '25-04-06',
      like: 61,
      comment: 10,
      substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓'],
    },
  ]);
}

// 내 냉장고 재료 예시 (localStorage에서 불러오기)
function getMyIngredients() {
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room].map(i => (typeof i === 'string' ? i : i.name));
    }
  } catch {}
  return ['오징어', '대파', '고추', '삼겹살']; // 기본값
}

// 매칭률 계산 함수
function getMatchRate(myIngredients: string[], recipeIngredients: string) {
  const recipeSet = new Set(
    recipeIngredients
      .split(',')
      .map((i: string) => i.trim())
      .filter(Boolean)
  );
  const mySet = new Set(myIngredients);
  const matched = [...recipeSet].filter((i: string) => mySet.has(i));
  return {
    rate: Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: [...recipeSet].filter((i: string) => !mySet.has(i)),
  };
}

const RecipeList = () => {
  const [visibleCount, setVisibleCount] = useState(2);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  // 필터 상태
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeIngredient, setIncludeIngredient] = useState('');
  const [excludeIngredient, setExcludeIngredient] = useState('');
  const [selectedTime, setSelectedTime] = useState('상관없음');
  // 레시피 상태
  const [recipes, setRecipes] = useState<any[]>([]);
  const myIngredients = getMyIngredients();
  const navigate = useNavigate();
  // 버튼 클릭 상태: { [recipeId]: { done: bool, share: bool, write: bool } }
  const [buttonStates, setButtonStates] = useState<{
    [id: number]: { done: boolean; share: boolean; write: boolean }
  }>({});

  useEffect(() => {
    fetchRecipesDummy().then(setRecipes);
  }, []);

  // 무한 스크롤: 스크롤이 하단에 도달하면 handleLoadMore 실행
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 &&
        visibleCount < recipes.length
      ) {
        handleLoadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, recipes.length]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 2);
  };

  // 정렬 로직 (실제 데이터 기준)
  const sortedRecipes = [...recipes].map(recipe => {
    const match = getMatchRate(myIngredients, recipe.used_ingredients);
    return { ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients };
  }).sort((a, b) => {
    if (sortType === 'match') return b.match_rate - a.match_rate;
    if (sortType === 'like') return b.like - a.like;
    if (sortType === 'comment') return b.comment - a.comment;
    if (sortType === 'latest') return b.date.localeCompare(a.date);
    return 0;
  });

  // 필터 팝업 내부
  const renderFilterModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-[340px] max-w-[95vw] relative">
        <button className="absolute top-3 right-3 text-gray-400 text-xl" onClick={() => setFilterOpen(false)}>×</button>
        <div className="font-bold text-lg mb-4">필터</div>
        {/* 카테고리 */}
        <div className="mb-4">
          <div className="font-semibold mb-2 text-sm">카테고리</div>
          <div className="flex gap-2 flex-wrap">
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1 rounded-full text-xs border font-semibold transition ${selectedCategories.includes(cat) ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                onClick={() => setSelectedCategories((prev) => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        {/* 포함/제외 재료 */}
        <div className="mb-4">
          <div className="font-semibold mb-2 text-sm">포함할 재료</div>
          <input
            className="w-full border rounded px-3 py-2 text-sm mb-2"
            placeholder="예: 닭고기"
            value={includeIngredient}
            onChange={e => setIncludeIngredient(e.target.value)}
          />
          <div className="font-semibold mb-2 text-sm mt-2">제외할 재료</div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="예: 우유"
            value={excludeIngredient}
            onChange={e => setExcludeIngredient(e.target.value)}
          />
        </div>
        {/* 조리 시간 */}
        <div className="mb-4">
          <div className="font-semibold mb-2 text-sm">조리 시간</div>
          <div className="flex gap-2 flex-wrap">
            {timeOptions.map((opt) => (
              <button
                key={opt}
                className={`px-3 py-1 rounded-full text-xs border font-semibold transition ${selectedTime === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                onClick={() => setSelectedTime(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        {/* 하단 버튼 */}
        <div className="flex justify-between mt-6 gap-2">
          <button
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 bg-gray-100 font-semibold"
            onClick={() => {
              setSelectedCategories([]); setIncludeIngredient(''); setExcludeIngredient(''); setSelectedTime('상관없음');
            }}
          >초기화</button>
          <button
            className="flex-1 py-2 rounded-lg bg-blue-500 text-white font-semibold ml-2"
            onClick={() => {
              setFilterOpen(false);
              // 실제로는 필터 적용 로직 필요. 지금은 콘솔 출력만
              console.log('필터 적용:', { selectedCategories, includeIngredient, excludeIngredient, selectedTime });
            }}
          >적용</button>
        </div>
      </div>
    </div>
  );

  // 기록/완료 저장 함수 (localStorage 예시)
  function saveToStorage(type: 'record' | 'complete', recipe: any) {
    const key = type === 'record' ? 'my_recorded_recipes' : 'my_completed_recipes';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...prev, recipe]));
  }
  // 기록/완료 취소 함수 (localStorage에서 삭제)
  function removeFromStorage(type: 'record' | 'complete', recipe: any) {
    const key = type === 'record' ? 'my_recorded_recipes' : 'my_completed_recipes';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = prev.filter((r: any) => r.id !== recipe.id);
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  // 버튼 클릭 핸들러 (토글, alert 1번만)
  const handleButtonClick = (id: number, type: 'done' | 'share' | 'write', recipe: any) => {
    const prevState = buttonStates[id] || {};
    const isActive = !!prevState[type];
    // 상태 먼저 바꿈
    setButtonStates(prev => ({
      ...prev,
      [id]: {
        ...prevState,
        [type]: !isActive
      }
    }));
    // 부수효과는 여기서만!
    if (type === 'done') {
      if (!isActive) {
        saveToStorage('complete', recipe);
        setTimeout(() => alert('레시피 완료상태로 저장하였습니다'), 0);
      } else {
        removeFromStorage('complete', recipe);
        setTimeout(() => alert('레시피 완료상태를 취소하였습니다'), 0);
      }
    }
    if (type === 'write') {
      if (!isActive) {
        saveToStorage('record', recipe);
        setTimeout(() => alert('기록하기 상태로 저장하였습니다'), 0);
      } else {
        removeFromStorage('record', recipe);
        setTimeout(() => alert('기록하기 상태를 취소하였습니다'), 0);
      }
    }
  };

  return (
    <>
      <TopNavBar />
      <div className="max-w-[430px] mx-auto pb-20 pt-4 px-2 bg-white min-h-screen">
        <h2 className="text-lg font-bold mb-4 text-center">내 냉장고 기반 레시피 추천</h2>
        {/* 정렬/필터 바 */}
        <div className="flex gap-2 mb-4 items-center">
          <select
            className="border border-gray-300 rounded h-8 px-2 text-xs font-bold bg-white text-[#404040] focus:outline-none focus:ring-2 focus:ring-blue-200 transition min-w-[120px]"
            value={sortType}
            onChange={e => setSortType(e.target.value)}
            aria-label="정렬 기준 선택"
          >
            {sortOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <button
            className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 text-gray-600 text-xs font-semibold bg-white hover:bg-gray-100"
            onClick={() => setFilterOpen(true)}
          >
            <span className="font-bold">필터</span>
          </button>
        </div>
        {/* 필터 팝업 상세 구현 */}
        {filterOpen && renderFilterModal()}
        <div className="flex flex-col gap-6">
          {sortedRecipes.slice(0, visibleCount).map((recipe) => {
            // 재료 pill 10개 제한 + ... 처리
            const allIngredients = [
              ...recipe.need_ingredients.map((ing: string) => ({ ing, type: 'need' })),
              ...recipe.my_ingredients.map((ing: string) => ({ ing, type: 'have' })),
            ];
            const shownIngredients = allIngredients;
            const btnState = buttonStates[recipe.id] || {};
            return (
              <div
                key={recipe.id}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-[16px] shadow-sm p-4 min-h-[144px] relative mb-4"
              >
                {/* 제목 + 버튼 (카드 맨 위, 한 줄, ...중략, 옆의 작성자/날짜 제거) */}
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
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + `/recipe-detail/${recipe.id}`);
                        alert('URL이 복사되었습니다!');
                        handleButtonClick(recipe.id, 'share', recipe);
                      }}
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
                      재료매칭률 <span className="text-[#FFD600] font-extrabold ml-1">{recipe.match_rate}%</span>
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
                      onClick={() => navigate(`/recipe-detail/${recipe.id}`)}
                      title={recipe.body}
                    >
                      {recipe.body}
                    </div>
                  </div>
                </div>
                {/* 재료 pill (최대 10개, 초과시 ... 표시) */}
                <div className="flex flex-wrap gap-1 mb-1 max-h-9 overflow-y-auto custom-scrollbar pr-1" style={{ scrollbarWidth: 'auto' }}>
                  {shownIngredients
                    .filter(({ ing }) => ing && ing.trim() !== '')
                    .map(({ ing, type }: { ing: string, type: string }) => (
                      <span
                        key={ing}
                        className={
                          type === 'need'
                            ? 'bg-[#D1D1D1] text-white rounded-full px-3 py-0.5 font-medium'
                            : 'bg-[#555] text-white rounded-full px-3 py-0.5 font-medium'
                        }
                        style={{ fontSize: '10.4px' }}
                      >
                        {ing}
                      </span>
                    ))}
                </div>
                {/* 대체재 */}
                {recipe.substitutes && recipe.substitutes.length > 0 && (
                  <div className="mt-1">
                    <span className="bg-[#FFE066] text-[#444] rounded px-3 py-1 font-bold" style={{ fontSize: '12px' }}>대체 가능 :</span>
                    {recipe.substitutes.map((sub: string, idx: number) => (
                      <span key={sub} className="ml-2 font-semibold text-[#444]" style={{ fontSize: '12px' }}>{sub}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <BottomNavBar activeTab="recipe" />
    </>
  );
};

export default RecipeList; 