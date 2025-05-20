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
import RecipeSortBar from '../components/RecipeSortBar';
import TopNavBar from '../components/TopNavBar';
import RecipeToast from '../components/RecipeToast';

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

const IngredientDetail: React.FC<IngredientDetailProps> = ({ customTitle }) => {
  const { name = '' } = useParams<{ name: string }>();
  const navigate = useNavigate();
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
  const [matchRange, setMatchRange] = useState<[number, number]>([40, 90]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>('expiry');
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);

  const myIngredients = getMyIngredients();
  const myIngredientObjects = getMyIngredientObjects();

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
      );
      setRecipes(filtered);
    });
  }, [name]);

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
    console.log('=== 대체 재료 찾기 시작 ===');
    console.log('레시피 재료:', recipeIngredients);
    console.log('사용자 재료:', userIngredients);
    console.log('대체 테이블:', substituteTable);

    const recipeIngredientSet = new Set(recipeIngredients.split(',').map(i => i.trim()));
    const userIngredientSet = new Set(userIngredients.map(i => i.trim()));

    const substitutes: string[] = [];

    for (const recipeIngredient of recipeIngredientSet) {
      console.log(`\n[${recipeIngredient}] 대체 정보 찾는 중...`);
      const substituteInfo = substituteTable[recipeIngredient];
      console.log(`[${recipeIngredient}] 대체 정보:`, substituteInfo);

      if (substituteInfo) {
        const possibleSubstitute = substituteInfo.ingredient_b;
        console.log(`[${recipeIngredient}] 가능한 대체재료:`, possibleSubstitute);
        console.log(`[${recipeIngredient}] 사용자 재료에 있는지:`, userIngredientSet.has(possibleSubstitute));

        if (userIngredientSet.has(possibleSubstitute)) {
          substitutes.push(`${recipeIngredient} → ${possibleSubstitute}`);
          console.log(`[${recipeIngredient}] 대체재료 추가됨:`, `${recipeIngredient} → ${possibleSubstitute}`);
        }
      }
    }

    console.log('=== 최종 대체재료 목록 ===', substitutes);
    return substitutes.length > 0 ? substitutes : ['(내 냉장고에 대체 가능한 재료가 없습니다)'];
  };

  let sortedRecipes = [...recipes].map(recipe => {
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

  let sortedExpiryList: any[] = [];
  if (expirySortType === 'expiry') {
    sortedExpiryList = myIngredientObjects.filter((i: any) => i.expiry).sort((a: any, b: any) => (a.expiry > b.expiry ? 1 : -1));
  } else {
    sortedExpiryList = myIngredientObjects.filter((i: any) => i.purchase).sort((a: any, b: any) => (a.purchase > b.purchase ? 1 : -1));
  }

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
        <RecipeSortBar
          recipes={recipes}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
        />
      </div>
      <BottomNavBar activeTab="ingredient" />
      {toast && <RecipeToast message={toast} />}
    </>
  );
};

export default IngredientDetail;