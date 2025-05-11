import React, { useState, useEffect } from 'react';
import BottomNavBar from '../components/BottomNavBar';
import { useNavigate } from 'react-router-dom';
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
      body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다.',
      used_ingredients: '오징어,대파,고추,양파,당근,고추장',
      author: '꼬마츄츄',
      date: '25-03-08',
      like: 77,
      comment: 12,
      substitutes: ['양파→대파', '고추장→된장'],
    },
    {
      id: 2,
      thumbnail: 'https://cdn.pixabay.com/photo/2017/05/07/08/56/food-2290814_1280.jpg',
      title: '대패삼겹살 제육볶음 레시피',
      body: '미리 양념장을 만들어서 볶아도 좋고... 대패삼겹살 제육볶음 레시피입니다.',
      used_ingredients: '삼겹살,대파,고추,양파,고추장,설탕',
      author: '꼬마츄츄',
      date: '25-04-09',
      like: 55,
      comment: 8,
      substitutes: ['설탕→올리고당'],
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
  const recipeSet = new Set(recipeIngredients.split(',').map((i: string) => i.trim()));
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

  useEffect(() => {
    fetchRecipesDummy().then(setRecipes);
  }, []);

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
    alert(type === 'record' ? '기록 완료!' : '완료로 저장!');
  }

  return (
    <>
      <div className="max-w-[430px] mx-auto pb-20 pt-4 px-2 bg-white min-h-screen">
        <h2 className="text-lg font-bold mb-4">[사용자 닉네임]님의 재료 기반 레시피 추천</h2>
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
        <div className="flex flex-col gap-4">
          {sortedRecipes.slice(0, visibleCount).map((recipe) => (
            <div key={recipe.id} className="bg-[#F8F8F8] rounded-xl shadow p-4 flex gap-3 relative">
              <img src={recipe.thumbnail} alt="썸네일" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-base text-gray-800">{recipe.title}</span>
                  <span className="ml-auto text-xs text-gray-400">{recipe.author} · {recipe.date}</span>
                </div>
                <div className="text-xs text-gray-600 mb-2 line-clamp-2">{recipe.body}</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] bg-yellow-200 text-yellow-800 rounded px-2 py-0.5 font-semibold">재료 매칭률 {recipe.match_rate}%</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {recipe.my_ingredients.map((ing: string) => (
                    <span key={ing} className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs">{ing}</span>
                  ))}
                  {recipe.need_ingredients.map((ing: string) => (
                    <span key={ing} className="bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 text-xs">{ing}</span>
                  ))}
                </div>
                {recipe.substitutes && recipe.substitutes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {recipe.substitutes.map((sub: string) => (
                      <span key={sub} className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs">대체: {sub}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* 부가 기능 버튼 영역 */}
              <div className="absolute top-2 right-2 flex gap-1">
                <button title="상세" className="bg-white border rounded p-1 text-xs" onClick={() => navigate(`/recipe-detail/${recipe.id}`)}>상세</button>
                <button title="공유" className="bg-white border rounded p-1 text-xs" onClick={() => {navigator.clipboard.writeText(window.location.origin+`/recipe-detail/${recipe.id}`); alert('URL이 복사되었습니다!');}}>공유</button>
                <button title="기록" className="bg-white border rounded p-1 text-xs" onClick={() => saveToStorage('record', recipe)}>기록</button>
                <button title="완료" className="bg-white border rounded p-1 text-xs" onClick={() => saveToStorage('complete', recipe)}>완료</button>
              </div>
            </div>
          ))}
        </div>
        {visibleCount < sortedRecipes.length && (
          <button onClick={handleLoadMore} className="w-full mt-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold">더보기</button>
        )}
      </div>
      <BottomNavBar activeTab="recipe" />
    </>
  );
};

export default RecipeList; 