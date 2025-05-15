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
import FilterModal from '../components/FilterModal';
import { fetchRecipesDummy } from '../utils/dummyData';
import RecipeCard from '../components/RecipeCard';
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

// 필터 카테고리별 키워드 (이미지 기준, 소분류 포함)
const FILTER_KEYWORDS = {
  효능: [
    { title: '다이어트/체중조절/식이조절', keywords: ['저지방', '저칼로리', '저당', '무설탕', '무염', '고단백', '다이어트', '포만감', '칼로리', '글레스테롤', '무염', '저염', '무가당'] },
    { title: '소화·배변·영양 흡수', keywords: ['소화', '변비', '식이섬유'] },
    { title: '노화·피부·세포 관련', keywords: ['노화', '저속노화', '주름개선', '항산화', '세포벽'] },
    { title: '면역·활력·에너지 회복', keywords: ['면역력', '에너지', '신진대사', '컨디션', '피로'] },
    { title: '해독·순환·디톡스', keywords: ['디톡스', '숙취해소', '혈액순환', '독소'] },
    { title: '질환·염증·호흡기', keywords: ['염증완화', '질환', '기관지', '호흡기', '세균'] },
    { title: '성분 특성/영양제어', keywords: ['단백질', '글루텐', '무염', '무설탕', '비정제원당'] },
    { title: '건강식·한방·보양식', keywords: ['건강', '보양', '보양음식', '약재', '한방'] },
    { title: '식이제한/특수식단', keywords: ['채식', '당뇨', '글루텐'] },
    { title: '수면·신경 안정', keywords: ['불면증'] },
  ],
  영양분: [
    { title: '', keywords: ['단백질', '아미노산', '오메가', '타우린', '카페인', '비타민', '비타민C', '비타민B', '비타민D', '미네랄', '무기질', '칼슘', '칼륨', '아연', '식이섬유', '그래놀라', '탄수화물'] },
  ],
  대상: [
    { title: '', keywords: ['부모님', '남편', '와이프', '아이', '가족', '어르신', '직장인', '환자'] },
  ],
  TPO: [
    { title: '용도', keywords: ['반찬', '술안주', '와인', '소풍'] },
    { title: '시간대', keywords: ['주말', '아침', '브런치', '간식', '점심', '저녁', '야식'] },
    { title: '상황/장소', keywords: ['운동전', '운동후', '캠핑', '명절', '생일', '추억', '소풍', '잔치상', '여행'] },
    { title: '난이도', keywords: ['초간단', '심플한', '난이도하', '초보', '즉석', '귀차니즘'] },
    { title: '계절·시기', keywords: ['봄', '여름', '가을', '겨울', '환절기', '초복', '중복', '말복', '동지'] },
  ],
  스타일: [
    { title: '', keywords: ['이국', '프랑스', '이탈리안', '스페인', '멕시코', '지중해', '프랑스', '중화', '베트남', '그리스', '서양', '태국', '동남아', '일본', '전통', '강원도', '경양식', '궁중', '경상도', '전라도', '황해도', '키토', '가니쉬', '오마카세'] },
  ],
};

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

// 필터 선택 상태 관리
type FilterState = {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
};
const initialFilterState: FilterState = {
  효능: [],
  영양분: [],
  대상: [],
  TPO: [],
  스타일: [],
};

// CSV에서 ingredient_name만 추출하는 함수 (MyFridge.tsx와 동일)
function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('ingredient_name');
  if (nameIdx === -1) return [];
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'ingredient_name');
}

// 카드 스타일 상수화 (마이페이지와 동일)
const CARD_STYLE = {
  borderRadius: 20,
  background: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  marginBottom: 16,
  minHeight: 144,
  position: 'relative' as 'relative',
  padding: 16,
  border: 'none',
};

// ActionButton 컴포넌트 (마이페이지와 동일)
const ActionButton = ({
  title,
  icon,
  onClick,
  active = true,
}: {
  title: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}) => (
  <span style={{ position: 'relative', zIndex: 2 }}>
    <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,34,34,0.7)', zIndex: 1 }}></span>
    <button
      title={title}
      tabIndex={0}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        outline: 'none',
        position: 'relative',
        zIndex: 2,
      }}
      onClick={onClick}
    >
      <img src={doneIcon} alt={title} width={19} height={19} style={{ display: 'block', position: 'relative', zIndex: 2, opacity: active ? 1 : 0.5 }} />
    </button>
  </span>
);

const RecipeList = () => {
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  // 필터 상태
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [selectedTime, setSelectedTime] = useState('상관없음');
  // 레시피 상태
  const [recipes, setRecipes] = useState<any[]>([]);
  const myIngredients = getMyIngredients();
  const navigate = useNavigate();
  // 버튼 클릭 상태: { [recipeId]: { done: bool, share: bool, write: bool } }
  const [buttonStates, setButtonStates] = useState<{
    [id: number]: { done: boolean; share: boolean; write: boolean }
  }>({});
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  // 자동완성용 내 냉장고 재료 목록
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
      });
  }, []);

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

  // 정렬 로직 수정
  let sortedRecipes = [...recipes].map(recipe => {
    const match = getMatchRate(myIngredients, recipe.used_ingredients);
    return { ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients };
  });
  // 정렬
  if (sortType === 'match') sortedRecipes.sort((a, b) => b.match_rate - a.match_rate);
  else if (sortType === 'expiry') sortedRecipes.sort((a, b) => 0); // TODO: 유통기한 임박순 정렬 구현 필요

  // 버튼 클릭 핸들러 (토글, alert 1번만)
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
      if (!isActive) {
        // saveToStorage('complete', recipe);
        setToast('레시피를 완료했습니다!');
        setTimeout(() => setToast(''), 1500);
      } else {
        // removeFromStorage('complete', recipe);
        setToast('레시피 완료를 취소했습니다!');
        setTimeout(() => setToast(''), 1500);
      }
    }
    if (type === 'write') {
      if (!isActive) {
        // saveToStorage('record', recipe);
        setToast('레시피를 기록했습니다!');
        setTimeout(() => setToast(''), 1500);
      } else {
        // removeFromStorage('record', recipe);
        setToast('레시피 기록을 취소했습니다!');
        setTimeout(() => setToast(''), 1500);
      }
    }
    if (type === 'share') {
      navigator.clipboard.writeText(window.location.origin + `/recipe-detail/${recipe.id}`);
      setToast('URL이 복사되었습니다!');
      setTimeout(() => setToast(''), 1500);
    }
  };

  // 필터 팝업 상세 구현
  return (
    <>
      <TopNavBar />
      <div className="mx-auto pb-20 bg-white"
        style={{
          maxWidth: 400,
          minHeight: '100vh',
          boxSizing: 'border-box',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 32,
        }}
      >
        <h2 className="text-lg font-bold mb-4 text-center">내 냉장고 기반 레시피 추천</h2>
        {/* 정렬/필터 바 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            width: '100%',
            marginTop: 32,
          }}
        >
          <select
            style={{
              height: 28,
              border: '1px solid #ccc',
              borderRadius: 6,
              fontSize: 14,
              padding: '0 10px',
              fontWeight: 700,
              background: '#fff',
              color: '#404040',
              minWidth: 100,
            }}
            value={sortType}
            onChange={e => setSortType(e.target.value)}
            aria-label="정렬 기준 선택"
          >
            <option value="match">재료매칭률순</option>
            <option value="expiry">유통기한 임박순</option>
          </select>
          <button
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 16px',
              borderRadius: 999,
              border: '1px solid #ccc',
              background: '#fff',
              color: '#444',
              fontWeight: 600,
              fontSize: 14,
              height: 28,
              cursor: 'pointer',
            }}
            onClick={() => setFilterOpen(true)}
          >
            <span style={{ fontWeight: 700 }}>필터</span>
          </button>
        </div>
        {/* 필터 팝업 상세 구현 */}
        {filterOpen && (
          <FilterModal
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            filterState={selectedFilter}
            setFilterState={setSelectedFilter}
            includeInput={includeInput}
            setIncludeInput={setIncludeInput}
            excludeInput={excludeInput}
            setExcludeInput={setExcludeInput}
            allIngredients={allIngredients}
            includeKeyword={includeKeyword}
            setIncludeKeyword={setIncludeKeyword}
          />
        )}
        <div className="flex flex-col gap-2">
          {sortedRecipes.slice(0, visibleCount).map((recipe, idx, arr) => {
            const allIngredients = [
              ...recipe.need_ingredients.map((ing: string) => ({ ing, type: 'need' })),
              ...recipe.my_ingredients.map((ing: string) => ({ ing, type: 'have' })),
              ...(recipe.substitutes || []).map((ing: string) => ({ ing, type: 'substitute' })),
            ];
            const btnState = buttonStates[recipe.id] || {};
            return (
              <div
                key={recipe.id}
                style={{
                  borderRadius: 20,
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  marginBottom: idx === arr.length - 1 ? 40 : 16,
                  minHeight: 144,
                  position: 'relative',
                  padding: 16,
                  border: 'none',
                }}
              >
                {/* 상단: 순번 + 버튼 */}
                <div className="font-bold text-[18px] text-[#222] text-left">{String(idx + 1).padStart(2, '0')}</div>
                <div className="h-[2px] w-[20px] bg-[#E5E5E5] mb-2"></div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 200, flexShrink: 0 }}>
                  <div
                    title={recipe.title}
                    style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14.4px', fontWeight: 'bold', color: '#222', lineHeight: 1.2 }}
                  >
                    {recipe.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', alignItems: 'center' }}>
                    <button
                      title="완료"
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
                      onClick={() => handleButtonClick(recipe.id, 'done', recipe)}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <img src={btnState.done ? doneBlackIcon : doneIcon} alt="완료" width={19} height={19} style={{ display: 'block' }} />
                    </button>
                    <button
                      title="공유"
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
                      onClick={() => handleButtonClick(recipe.id, 'share', recipe)}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <img src={btnState.share ? shareBlackIcon : shareIcon} alt="공유" width={19} height={19} style={{ display: 'block' }} />
                    </button>
                    <button
                      title="기록"
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
                      onClick={() => handleButtonClick(recipe.id, 'write', recipe)}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <img src={btnState.write ? writeBlackIcon : writeIcon} alt="기록" width={19} height={19} style={{ display: 'block' }} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-row gap-6 items-start mb-2">
                  <div className="relative min-w-[97px] max-w-[97px] h-[79px] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={recipe.thumbnail} alt="썸네일" className="w-full h-full object-cover object-center" />
                    <div className="absolute top-1 left-1 bg-[#444] bg-opacity-90 text-white text-[10px] font-bold rounded px-1.5 py-0 flex items-center gap-1 shadow">
                      재료매칭률 <span className="text-[#FFD600] font-extrabold ml-1">{recipe.match_rate}%</span>
                    </div>
                  </div>
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
                <div className="flex flex-wrap gap-1 mb-1 max-h-9 overflow-y-auto custom-scrollbar pr-1" style={{ scrollbarWidth: 'auto' }}>
                  {allIngredients
                    .filter(({ ing, type }: { ing: string; type: string }) => ing && ing.trim() !== '' && !ing.includes('→'))
                    .map(({ ing, type }: { ing: string; type: string }) => (
                      <span
                        key={ing}
                        className={
                          type === 'need'
                            ? 'bg-[#D1D1D1] text-white rounded-full px-3 py-0.5 font-medium'
                            : type === 'have'
                            ? 'bg-[#FFD600] text-black rounded-full px-3 py-0.5 font-medium'
                            : 'bg-[#555] text-white rounded-full px-3 py-0.5 font-medium'
                        }
                        style={{ fontSize: '10.4px' }}
                      >
                        {ing}
                      </span>
                    ))}
                </div>
                {recipe.substitutes && recipe.substitutes.length > 0 && (
                  <div
                    className="mt-1 custom-scrollbar pr-1"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      maxHeight: 48, // 2줄+조금, 3번째 줄이 살짝 보이게
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
      </div>
      <BottomNavBar activeTab="recipe" />
      {/* Toast Popup */}
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
    </>
  );
};

export default RecipeList; 