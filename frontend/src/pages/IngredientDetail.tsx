import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import RecipeSortBar from '../components/RecipeSortBar';
import TopNavBar from '../components/TopNavBar';
import RecipeToast from '../components/RecipeToast';
import backIcon from '../assets/뒤로가기.png';
import axios from 'axios';
import { calculateMatchRate } from '../utils/recipeUtils';

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

interface SubstituteInfo {
  ingredient_a: string;
  ingredient_b: string;
  substitution_direction: string;
  similarity_score: number;
  substitution_reason: string;
}

interface KeywordObject {
  keyword: string;
  synonyms?: string[];
}

interface IngredientDetailProps {
  customTitle?: string;
}

function getMyIngredientObjects(): any[] {
  try {
    const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
    if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
      return [...data.frozen, ...data.fridge, ...data.room];
    }
  } catch {}
  return [];
}

// categoryKeywords 정의
const categoryKeywords = {
  TPO: [
    { keyword: '주말', synonyms: ['주말요리', '주말식사', '주말특별식', '주말특별요리'] }
  ]
};

const IngredientDetail: React.FC<IngredientDetailProps> = ({ customTitle }) => {
  const { name = '' } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: SubstituteInfo }>({});
  const [buttonStates, setButtonStates] = useState<{ [id: number]: RecipeActionState }>({});
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [matchRange, setMatchRange] = useState<[number, number]>([30, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>('expiry');
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [filteredRecipes, setFilteredRecipes] = useState<any[]>([]);

  const myIngredients = useMemo(() => getMyIngredients(), []);
  const myIngredientObjects = getMyIngredientObjects();

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        setAllIngredients(parseIngredientNames(csv));
      });
  }, []);

  useEffect(() => {
    // 마이페이지 상세(기록/완료)라면 localStorage에서 불러오기
    if (location.pathname === '/mypage/recorded') {
      const arr = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]');
      setRecipes(arr);
    } else if (location.pathname === '/mypage/completed') {
      const arr = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]');
      setRecipes(arr);
    } else {
      // 실제 레시피 데이터 fetch
      const fetchData = async () => {
        try {
          // 레시피 데이터 가져오기
          const recipeResponse = await axios.get('http://127.0.0.1:5000/api/recipes');
          const ingredient = decodeURIComponent(name);
          
          // 재료 기반 필터링
          const filtered = recipeResponse.data.filter((r: Recipe) => {
            if (!r.used_ingredients) return false;
            const ingredients = r.used_ingredients.split(',').map(i => i.trim());
            return ingredients.includes(ingredient);
          });
          
          setRecipes(filtered);
        } catch (error) {
          console.error('Error fetching data:', error);
          setRecipes([]);
        }
      };

      fetchData();
    }
  }, [name, location.pathname]);

  useEffect(() => {
    const loadSubstituteTable = async () => {
      try {
        const response = await fetch('/ingredient_substitute_table.csv');
        const csvText = await response.text();
        
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        const table: { [key: string]: SubstituteInfo } = {};
        // 첫 번째 줄(헤더)을 제외하고 처리
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',');
          if (values.length >= 6) {
            const ingredient_a = values[1]?.trim() || '';
            const ingredient_b = values[2]?.trim() || '';
            const substitution_direction = values[3]?.trim() || '';
            const similarity_score = parseFloat(values[4]?.trim() || '0');
            const substitution_reason = values[5]?.trim() || '';

            if (ingredient_a) {
              table[ingredient_a] = {
                ingredient_a,
                ingredient_b,
                substitution_direction,
                similarity_score,
                substitution_reason
              };
            }
          }
        }
        setSubstituteTable(table);
      } catch (error) {
        // 에러 발생 시 콘솔에만 출력
      }
    };

    loadSubstituteTable();
  }, []);

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

  const findPossibleSubstitutes = (recipeIngredients: string, userIngredients: string[]): string[] => {
    const recipeIngredientSet = new Set(recipeIngredients.split(',').map(i => i.trim()));
    const userIngredientSet = new Set(userIngredients.map(i => i.trim()));

    const substitutes: string[] = [];

    for (const recipeIngredient of recipeIngredientSet) {
      const substituteInfo = substituteTable[recipeIngredient];

      if (substituteInfo) {
        const possibleSubstitute = substituteInfo.ingredient_b;

        if (userIngredientSet.has(possibleSubstitute)) {
          substitutes.push(`${recipeIngredient} → ${possibleSubstitute}`);
        }
      }
    }

    return substitutes.length > 0 ? substitutes : ['(내 냉장고에 대체 가능한 재료가 없습니다)'];
  };

  const processedRecipes = useMemo(() => {
    let arr = [...recipes].map(recipe => {
    const match = getMatchRate(myIngredients, recipe.used_ingredients);
    const substitutes = findPossibleSubstitutes(recipe.used_ingredients, myIngredients);
    return { 
      ...recipe, 
      match_rate: match.rate, 
      my_ingredients: match.my_ingredients, 
      need_ingredients: match.need_ingredients,
      substitutes: substitutes.length > 0 ? substitutes : ['(내 냉장고에 대체 가능한 재료가 없습니다)'],
      link: recipe.link || `https://blog.naver.com/jjangda1105/${recipe.id}`
    };
  });
    if (sortType === 'match') arr.sort((a, b) => b.match_rate - a.match_rate);
    else if (sortType === 'expiry') arr.sort((a, b) => 0);
    return arr;
  }, [recipes, myIngredients, sortType]);

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

  let sortedExpiryList: any[] = [];
  if (expirySortType === 'expiry') {
    sortedExpiryList = myIngredientObjects.filter((i: any) => i.expiry).sort((a: any, b: any) => (a.expiry > b.expiry ? 1 : -1));
  } else {
    sortedExpiryList = myIngredientObjects.filter((i: any) => i.purchase).sort((a: any, b: any) => (a.purchase > b.purchase ? 1 : -1));
  }

  // Restore sort/filter state from localStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('recipe_sortbar_state_ingredient');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.sortType) setSortType(state.sortType);
        if (state.matchRange) setMatchRange(state.matchRange);
        if (state.maxLack !== undefined) setMaxLack(state.maxLack);
        if (state.appliedExpiryIngredients) setAppliedExpiryIngredients(state.appliedExpiryIngredients);
        if (state.expirySortType) setExpirySortType(state.expirySortType);
      } catch {}
    }
  }, []);

  // Save sort/filter state to localStorage on change
  useEffect(() => {
    sessionStorage.setItem('recipe_sortbar_state_ingredient', JSON.stringify({
      sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType
    }));
  }, [sortType, matchRange, maxLack, appliedExpiryIngredients, expirySortType]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [name, location.pathname]);

  // 필터링된 레시피를 바로 사용하도록 수정
  useEffect(() => {
    setFilteredRecipes(processedRecipes);
  }, [processedRecipes]);

  // 레시피 필터링 함수
  const filterRecipes = (recipes: Recipe[]) => {
    return recipes.filter(recipe => {
      // 1. 키워드 매칭
      const text = (recipe.title || '') + ' ' + (recipe.content || '');
      const keyword = decodeURIComponent(includeKeyword);
      
      // 키워드와 동의어 목록 가져오기
      const keywordObj = categoryKeywords.TPO.find((k: KeywordObject) => 
        typeof k === 'object' && k.keyword === keyword
      );
      
      if (!keywordObj || typeof keywordObj !== 'object') return false;
      
      const allKeywords = [keywordObj.keyword, ...(keywordObj.synonyms || [])];
      
      // 각 키워드별로 독립적으로 매칭 횟수 체크
      const hasEnoughMatches = allKeywords.some(k => {
        if (!k) return false;
        const regex = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = text.match(regex);
        return matches && matches.length >= 2;
      });

      if (!hasEnoughMatches) return false;

      // 2. 재료 매칭
      if (myIngredients.length > 0) {
        const recipeIngredients = recipe.used_ingredients.split(',').map(i => i.trim());
        const matchRate = calculateMatchRate(myIngredients, recipe.used_ingredients);
        if (matchRate.rate < matchRange[0] || matchRate.rate > matchRange[1]) return false;
      }

      // 3. 부족 재료 수 체크
      if (maxLack !== 'unlimited') {
        const recipeIngredients = recipe.used_ingredients.split(',').map(i => i.trim());
        const mySet = new Set(myIngredients.map(i => i.trim()));
        const lackCount = recipeIngredients.filter(i => !mySet.has(i)).length;
        if (lackCount > maxLack) return false;
      }

      return true;
    });
  };

  return (
    <>
      <header className="w-full h-[56px] flex items-center px-2 bg-white">
          <button
          className="px-2 focus:outline-none bg-transparent border-none shadow-none ml-2"
          style={{ minWidth: 40, background: 'transparent' }}
          onClick={() => navigate(-1)}
            aria-label="뒤로가기"
        >
          <img
            src={backIcon}
            alt="뒤로가기"
            style={{ height: 13, width: 13, objectFit: 'contain', background: 'transparent' }}
          />
          </button>
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
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 18, textAlign: 'center' }}>{customTitle || `${name} 관련 레시피`}</div>
        <RecipeSortBar
          recipes={processedRecipes}
          myIngredients={myIngredients}
          onFilteredRecipesChange={setFilteredRecipes}
          sortType={sortType}
          setSortType={setSortType}
          matchRange={matchRange}
          setMatchRange={setMatchRange}
          maxLack={maxLack}
          setMaxLack={setMaxLack}
          appliedExpiryIngredients={appliedExpiryIngredients}
          setAppliedExpiryIngredients={setAppliedExpiryIngredients}
          expirySortType={expirySortType}
          setExpirySortType={setExpirySortType}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 24, height: 14, borderRadius: 7, background: '#D1D1D1', display: 'inline-block', marginRight: 2 }}></span>
              <span style={{ color: '#222', fontSize: '10.4px', minWidth: 30 }}>부족 재료</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 24, height: 14, borderRadius: 7, background: '#555', display: 'inline-block', marginRight: 2 }}></span>
              <span style={{ color: '#222', fontSize: '10.4px', minWidth: 30 }}>대체 가능</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 24, height: 14, borderRadius: 7, background: '#FFD600', display: 'inline-block', marginRight: 2 }}></span>
              <span style={{ color: '#222', fontSize: '10.4px', minWidth: 30 }}>보유 재료</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2" style={{ marginTop: 0 }}>
            {filteredRecipes.map((recipe, index) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                actionState={buttonStates[recipe.id]}
                onAction={(action) => handleRecipeAction(recipe.id, action)}
                isLast={index === filteredRecipes.length - 1}
                myIngredients={myIngredients}
                substituteTable={substituteTable}
                hideIndexNumber={location.pathname === '/mypage/recorded' || location.pathname === '/mypage/completed'}
              />
            ))}
          </div>
        </div>
      </div>
      <BottomNavBar activeTab={location.pathname.startsWith('/mypage') ? 'mypage' : 'popularity'} />
      {toast && <RecipeToast message={toast} />}
    </>
  );
};

export default IngredientDetail;