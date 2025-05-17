import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import BottomNavBar from '../components/BottomNavBar';
import FilterModal from '../components/FilterModal';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import RecipeCard from '../components/RecipeCard';
import { Recipe, RecipeActionState } from '../types/recipe';

// 더미 fetch 함수 (RecipeList.tsx와 동일)
function fetchRecipesDummy(name?: string): Promise<any[]> {
  const dataMap: Record<string, any[]> = {
    '두릅': [
      {
        id: 1,
        thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
        title: '두릅 오징어볶음 레시피 만드는법 간단',
        body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은 두릅 오징어볶음 레시피입니다.',
        used_ingredients: '두릅,오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
        author: '꼬마츄츄',
        date: '25-03-08',
        like: 77,
        comment: 12,
        substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
      },
      // ... (생략: 나머지 더미 데이터는 기존 코드에서 복사) ...
    ],
    // ... (생략: 머위나물, 도다리, 저소노화, 어버이날, 기관지 등 기존 코드에서 복사) ...
  };
  const key = name || '두릅';
  if (dataMap[key]) {
    return Promise.resolve(dataMap[key]);
  } else {
    // 동적 예시 4개 생성
    return Promise.resolve([
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: `${key}가 들어간 예시 레시피`,
        body: `이것은 ${key}가 포함된 예시 레시피입니다.`,
        used_ingredients: `${key},소금,후추,마늘,양파`,
        author: '예시봇',
        date: '25-05-15',
        like: 1,
        comment: 0,
        substitutes: [`${key}→다른재료`],
      },
      // ... (생략: 나머지 3개 예시) ...
    ]);
  }
}

function getMyIngredients(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room].map(i => (typeof i === 'string' ? i : i.name));
    }
  } catch {}
  return ['오징어', '대파', '고추', '삼겹살'];
}

function getMatchRate(myIngredients: string[], recipeIngredients: string) {
  const recipeSet = new Set(
    recipeIngredients
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean)
  );
  const mySet = new Set(myIngredients);
  const matched = [...recipeSet].filter((i) => mySet.has(i));
  return {
    rate: Math.round((matched.length / recipeSet.size) * 100),
    my_ingredients: matched,
    need_ingredients: [...recipeSet].filter((i) => !mySet.has(i)),
  };
}

const sortOptions = [
  { key: 'match', label: '재료매칭률' },
  { key: 'expiry', label: '유통기한 임박순' },
  { key: 'like', label: '좋아요순' },
  { key: 'comment', label: '댓글순' },
  { key: 'latest', label: '최신순' },
];

interface FilterState {
  효능: string[];
  영양분: string[];
  대상: string[];
  TPO: string[];
  스타일: string[];
}

const initialFilterState: FilterState = {
  효능: [],
  영양분: [],
  대상: [],
  TPO: [],
  스타일: [],
};

function parseIngredientNames(csv: string): string[] {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('ingredient_name');
  if (nameIdx === -1) return [];
  return lines.slice(1)
    .map(line => line.split(',')[nameIdx]?.trim())
    .filter(name => !!name && name !== 'ingredient_name');
}

interface IngredientDetailProps {
  customTitle?: string;
}

const IngredientDetail: React.FC<IngredientDetailProps> = ({ customTitle }) => {
  const { name = '' } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const myIngredients = getMyIngredients();
  const [buttonStates, setButtonStates] = useState<{ [id: number]: RecipeActionState }>({});
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
    fetchRecipesDummy(name).then(data => {
      const filtered = data.filter(r =>
        r.used_ingredients.includes(name) ||
        r.title.includes(name) ||
        r.body.includes(name)
      ).slice(0, 30);
      setRecipes(filtered);
    });
  }, [name]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 &&
        visibleCount < recipes.length
      ) {
        setVisibleCount((prev) => prev + 2);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, recipes.length]);

  let sortedRecipes = [...recipes].map(recipe => {
    const match = getMatchRate(myIngredients, recipe.used_ingredients);
    return { ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients };
  });
  if (sortType === 'match') sortedRecipes.sort((a, b) => b.match_rate - a.match_rate);
  else if (sortType === 'expiry') sortedRecipes.sort((a, b) => 0);

  const handleRecipeAction = (recipeId: number, action: keyof RecipeActionState) => {
    setButtonStates(prev => {
      const prevState = prev[recipeId] || { done: false, write: false, share: false };
      const isActive = !!prevState[action];
      const newState = { ...prevState, [action]: !isActive };
      let msg = '';
      if (action === 'done') msg = isActive ? '레시피 완료를 취소했습니다!' : '레시피를 완료했습니다!';
      if (action === 'write') msg = isActive ? '레시피 기록을 취소했습니다!' : '레시피를 기록했습니다!';
      if (action === 'share') {
        navigator.clipboard.writeText(window.location.origin + `/recipe-detail/${recipeId}`);
        msg = 'URL이 복사되었습니다!';
      }
      setToast(msg);
      setTimeout(() => setToast(''), 1500);
      return { ...prev, [recipeId]: newState };
    });
  };

  return (
    <>
      <header className="w-full h-[56px] flex items-center justify-between px-5 bg-white sticky top-0 z-20">
        <img src={logoImg} alt="냉털이 로고" className="h-4 w-auto" style={{ minWidth: 16 }} />
        <div className="flex items-center gap-2">
          <button
            className="p-1 text-black bg-transparent border-none outline-none text-base"
            aria-label="뒤로가기"
            style={{ background: 'none', border: 'none', fontFamily: 'Segoe UI Symbol, Pretendard, Arial, sans-serif', color: '#000' }}
            onClick={() => navigate(-1)}
          >
            ↩
          </button>
          <img src={searchIcon} alt="검색" className="h-4 w-4 mr-1 cursor-pointer" />
        </div>
      </header>
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
        <h2 className="text-lg font-bold mb-4 text-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {customTitle === '내가 기록한 레시피' ? (
            <>
              <img src={writeIcon} alt="기록 아이콘" style={{ width: 18, height: 18, marginRight: 4, marginBottom: 2, display: 'inline-block', verticalAlign: 'middle' }} />
              내가 기록한 레시피
            </>
          ) : customTitle ? (
            customTitle
          ) : (
            `${name} 관련 인기 레시피 TOP30`
          )}
        </h2>
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
          {sortedRecipes.slice(0, visibleCount).map((recipe: any, idx: number, arr: any[]) => {
            const recipeCardData: Recipe = {
              id: recipe.id,
              thumbnail: recipe.thumbnail,
              title: recipe.title,
              match_rate: recipe.match_rate,
              author: recipe.author,
              date: recipe.date,
              body: recipe.body,
              used_ingredients: recipe.used_ingredients,
              need_ingredients: recipe.need_ingredients,
              my_ingredients: recipe.my_ingredients,
              substitutes: recipe.substitutes,
            };
            return (
              <RecipeCard
                key={recipe.id}
                recipe={recipeCardData}
                index={idx}
                actionState={buttonStates[recipe.id]}
                onAction={action => handleRecipeAction(recipe.id, action)}
                isLast={idx === visibleCount - 1}
                myIngredients={myIngredients}
              />
            );
          })}
        </div>
      </div>
      <BottomNavBar activeTab={customTitle === '내가 기록한 레시피' || customTitle === '내가 완료한 레시피' ? 'mypage' : 'popularity'} />
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

export default IngredientDetail;