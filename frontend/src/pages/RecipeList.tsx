import axios, { AxiosResponse } from 'axios';
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
import { Recipe, RecipeActionState, FilterState, SubstituteInfo } from '../types/recipe';
import { getMyIngredients, sortRecipes } from '../utils/recipeUtils';
import RecipeToast from '../components/RecipeToast';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import RecipeSortBar from '../components/RecipeSortBar';
import { getIngredientPillInfo } from '../utils/recipeUtils';

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

const initialFilterState: FilterState = {
  효능: [],
  영양분: [],
  대상: [],
  TPO: [],
  스타일: [],
};

// 게시일자 포맷 변환 함수
function formatDate(dateString: string): string {
  let d = new Date(dateString);
  if (isNaN(d.getTime())) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[0].slice(2)}-${parts[1]}-${parts[2]}`;
    }
    return dateString;
  }
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// D-day 계산 함수
function getDDay(expiry: string) {
  if (!expiry) return '';
  const today = new Date();
  const exp = new Date(expiry);
  if (isNaN(exp.getTime())) return expiry;
  const diff = Math.floor((exp.getTime() - today.setHours(0,0,0,0)) / (1000*60*60*24));
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${Math.abs(diff)}`;
}

const RecipeList: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortType, setSortType] = useState('match');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterState>(initialFilterState);
  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [selectedTime, setSelectedTime] = useState('상관없음');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeActionStates, setRecipeActionStates] = useState<Record<number, RecipeActionState>>({});
  const [toast, setToast] = useState('');
  const [includeKeyword, setIncludeKeyword] = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [substituteTable, setSubstituteTable] = useState<{ [key: string]: SubstituteInfo }>({});
  const [matchRateModalOpen, setMatchRateModalOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [matchRange, setMatchRange] = useState<[number, number]>([0, 100]);
  const [maxLack, setMaxLack] = useState<number | 'unlimited'>('unlimited');
  const [expirySortType, setExpirySortType] = useState<'expiry'|'purchase'>('expiry');
  const [selectedExpiryIngredients, setSelectedExpiryIngredients] = useState<string[]>([]);
  const [appliedExpiryIngredients, setAppliedExpiryIngredients] = useState<string[]>([]);
  
  const myIngredients = getMyIngredients();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/ingredient_profile_dict_with_substitutes.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const header = lines[0].split(',');
        const nameIdx = header.indexOf('ingredient_name');
        if (nameIdx === -1) return;
        setAllIngredients(
          lines.slice(1)
            .map(line => line.split(',')[nameIdx]?.trim())
            .filter(name => !!name && name !== 'ingredient_name')
        );
      });
  }, []);

  useEffect(() => {
    fetch('/ingredient_substitute_table.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const aIdx = header.indexOf('ingredient_a');
        const bIdx = header.indexOf('ingredient_b');
        const dirIdx = header.indexOf('substitution_direction');
        const scoreIdx = header.indexOf('similarity_score');
        const reasonIdx = header.indexOf('substitution_reason');
        
        if (aIdx === -1 || bIdx === -1) return;
        
        const table: { [key: string]: SubstituteInfo } = {};
        lines.slice(1).forEach(line => {
          const cols = line.split(',');
          const a = cols[aIdx]?.trim();
          const b = cols[bIdx]?.trim();
          const direction = cols[dirIdx]?.trim() || '';
          const score = parseFloat(cols[scoreIdx]?.trim() || '0');
          const reason = cols[reasonIdx]?.trim() || '';
          
          if (a && b) {
            table[a] = {
              ingredient_a: a,
              ingredient_b: b,
              substitution_direction: direction,
              similarity_score: score,
              substitution_reason: reason
            };
          }
        });
        setSubstituteTable(table);
      });
  }, []);

  useEffect(() => {
    // Try to fetch from backend first
    axios.get('http://127.0.0.1:5000/api/recipes')
      .then((res: AxiosResponse<any>) => {
        console.log('API Response length:', res.data.length);
        setRecipes(res.data);
      })
      .catch((err: unknown) => {
        console.error('Backend fetch failed, using dummy data:', err);
        // Fallback to dummy data
        fetchRecipesDummy().then(data => {
          console.log('Dummy data length:', data.length);
          setRecipes(data);
        });
      });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 &&
        visibleCount < recipes.length
      ) {
        console.log('Increasing visibleCount from', visibleCount, 'to', visibleCount + 10);
        setVisibleCount(prev => prev + 10);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, recipes.length]);

  const handleRecipeAction = (recipeId: number, action: keyof RecipeActionState, recipe: Recipe) => {
    const prevState = recipeActionStates[recipeId] || { done: false, share: false, write: false };
    const isActive = prevState[action];
    
    setRecipeActionStates(prev => ({
      ...prev,
      [recipeId]: { ...prevState, [action]: !isActive }
    }));

    switch (action) {
      case 'done':
        setToast(isActive ? '레시피 완료를 취소했습니다!' : '레시피를 완료했습니다!');
        break;
      case 'write':
        setToast(isActive ? '레시피 기록을 취소했습니다!' : '레시피를 기록했습니다!');
        break;
      case 'share':
        navigator.clipboard.writeText(window.location.origin + `/recipe-detail/${recipe.id}`);
        setToast('URL이 복사되었습니다!');
        break;
    }
    
    setTimeout(() => setToast(''), 1500);
  };

  // 매칭률/부족개수 필터 적용
  const filteredRecipes = sortRecipes(recipes, sortType, myIngredients).filter(recipe => {
    // 매칭률 필터
    const matchRate = recipe.match_rate ?? 0;
    const inMatchRange = matchRate >= matchRange[0] && matchRate <= matchRange[1];
    // 부족 개수 필터
    const lackCount = recipe.need_ingredients ? recipe.need_ingredients.length : 0;
    let lackOk = true;
    if (maxLack !== 'unlimited') {
      if (maxLack === 5) {
        lackOk = lackCount >= 5;
      } else {
        lackOk = lackCount <= maxLack;
      }
    }
    // 임박재료 필터 (AND 조건: 선택된 모든 재료가 레시피에 포함되어야 함)
    let expiryOk = true;
    if (appliedExpiryIngredients.length > 0) {
      expiryOk = appliedExpiryIngredients.every(ing => (recipe.used_ingredients || '').includes(ing));
    }

    // 디버깅을 위한 로그 추가
    console.log('Recipe filtering:', {
      title: recipe.title,
      matchRate,
      inMatchRange,
      lackCount,
      lackOk,
      expiryOk,
      used_ingredients: recipe.used_ingredients,
      appliedExpiryIngredients
    });

    return inMatchRange && lackOk && expiryOk;
  });

  // 필터링된 레시피 수 로그
  console.log('Filtered recipes count:', filteredRecipes.length);
  console.log('Match range:', matchRange);
  console.log('Max lack:', maxLack);
  console.log('Applied expiry ingredients:', appliedExpiryIngredients);

  function getMyIngredientObjects() {
    try {
      const data = JSON.parse(localStorage.getItem('myfridge_ingredients') || 'null');
      if (data && Array.isArray(data.frozen) && Array.isArray(data.fridge) && Array.isArray(data.room)) {
        return [...data.frozen, ...data.fridge, ...data.room];
      }
    } catch {}
    return [];
  }
  const myIngredientObjects = getMyIngredientObjects();
  let sortedExpiryList = [];
  if (expirySortType === 'expiry') {
    sortedExpiryList = myIngredientObjects.filter(i => i.expiry).sort((a, b) => (a.expiry > b.expiry ? 1 : -1));
  } else {
    sortedExpiryList = myIngredientObjects.filter(i => i.purchase).sort((a, b) => (a.purchase > b.purchase ? 1 : -1));
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
        <h2 className="text-lg font-bold mb-4 text-center">내 냉장고 기반 레시피 추천</h2>
        <RecipeSortBar
          recipes={(recipes as any[]).map(recipe => ({
            ...recipe,
            body: recipe.content || recipe.body || '',
            date: recipe.post_time ? formatDate(recipe.post_time) : (recipe.date || ''),
          }))}
          myIngredients={myIngredients}
          substituteTable={substituteTable}
        />
        {/* 레시피 리스트 */}
        <div className="flex flex-col gap-2 mt-4">
          {filteredRecipes.map((recipe, idx) => {
            const needIngredientsForPill = (recipe.used_ingredients || '').split(',').map((i) => (i ? i.trim() : '')).filter(Boolean);
            const myIngredientsSafe = myIngredients.map(i =>
              typeof i === 'string'
                ? i
                : (i && typeof i === 'object' && 'name' in i ? (i as any).name : '')
            );
            const pillInfo = getIngredientPillInfo({
              needIngredients: needIngredientsForPill,
              myIngredients: myIngredientsSafe,
              substituteTable,
            });
            if (idx < 20) {
              console.log({
                idx,
                title: recipe.title,
                myIngredients: myIngredientsSafe,
                needIngredientsForPill,
                pillInfo
              });
            }
            return (
              <div key={recipe.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                {/* 썸네일, 제목 등 기존 RecipeCard 내용은 필요에 따라 추가 */}
                <RecipeCard
                  recipe={recipe}
                  index={idx}
                  onAction={() => {}}
                  isLast={false}
                  actionState={undefined}
                  myIngredients={myIngredients}
                  substituteTable={substituteTable}
                />
                {/* 재료 pill 직접 렌더링 */}
                <div className="custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, marginBottom: 4, overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'auto', alignItems: 'center', paddingBottom: 4 }}>
                  {pillInfo.pills.map((ing) => {
                    const normalize = (s: string) => (s || '').trim().toLowerCase();
                    const mySet = new Set(myIngredients.map(normalize));
                    const isMine = mySet.has(normalize(ing));
                    if (idx < 1) {
                      console.log({
                        ing,
                        normalizeIng: normalize(ing),
                        myIngredients,
                        myIngredientsNormalized: myIngredients.map(normalize),
                        isMine
                      });
                    }
                    if (isMine) {
                      return (
                        <span key={ing} className="bg-customYellow text-[#444] rounded-full px-3 py-0.5 font-medium text-[10.4px]">{ing}</span>
                      );
                    } else if (pillInfo.notMineSub.map(normalize).includes(normalize(ing))) {
                      return (
                        <span key={ing} className="bg-customDarkGray text-white rounded-full px-3 py-0.5 font-medium text-[10.4px]">{ing}</span>
                      );
                    } else {
                      return (
                        <span key={ing} className="bg-customGray text-white rounded-full px-3 py-0.5 font-medium text-[10.4px]">{ing}</span>
                      );
                    }
                  })}
                </div>
                {/* 대체 가능 태그 */}
                <div className="mt-1 custom-scrollbar pr-1" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, overflowX: 'auto', maxWidth: '100%', alignItems: 'center', paddingBottom: 4 }}>
                  <span className="bg-[#FFE066] text-[#444] rounded px-3 py-1 font-bold" style={{ fontSize: '12px', flex: '0 0 auto' }}>대체 가능 :</span>
                  {pillInfo.substitutes.length > 0 ? (
                    pillInfo.substitutes.map((sub: any, idx: any) => (
                      <span key={sub} className="ml-2 font-semibold text-[#444]" style={{ fontSize: '12px', flex: '0 0 auto' }}>{sub}</span>
                    ))
                  ) : (
                    <span className="ml-2 text-[12px] text-[#B0B0B0] font-normal" style={{ flex: '0 0 auto' }}>(내 냉장고에 대체 가능한 재료가 없습니다)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNavBar activeTab="recipe" />
      {toast && <RecipeToast message={toast} />}
    </>
  );
};

export default RecipeList;