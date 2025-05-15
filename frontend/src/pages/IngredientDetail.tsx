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

// 더미 fetch 함수 (RecipeList.tsx와 동일)
function fetchRecipesDummy(name?: string): Promise<any[]> {
  // 키워드별 더미 데이터
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
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '두릅 대패삼겹살 제육볶음 레시피',
        body: '미리 양념장을 만들어서 볶으셔도 좋고, 저처럼 두릅과 함께 바로 재료에 다 때려 넣고 볶아도 맛있는 대패삼겹살 제육볶음 레시피 만들 수 있답니다.',
        used_ingredients: '두릅,삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
        author: '꼬마츄츄',
        date: '25-04-09',
        like: 55,
        comment: 8,
        substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
        title: '두릅 미나리 오삼불고기. 술안주로 좋지요~~',
        body: '언제 먹어도 맛있죠. 누구나 다 좋아하죠. 두릅 오징어 볶음도 맛있고, 제육볶음도 맛있고 고민될 땐 오삼불고기죠 ^^.',
        used_ingredients: '두릅,오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
        author: '껌딱지',
        date: '25-04-06',
        like: 61,
        comment: 10,
        substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '두릅나물 무침 레시피',
        body: '봄철 대표 나물 두릅으로 만드는 초간단 무침 레시피입니다.',
        used_ingredients: '두릅,고추장,참기름,깨소금,간장,마늘',
        author: '나물장인',
        date: '25-04-10',
        like: 42,
        comment: 5,
        substitutes: ['두릅→고사리', '고추장→된장'],
      },
    ],
    '머위나물': [
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '머위나물 오징어볶음 레시피 만드는법 간단',
        body: '머위나물과 오징어로 만드는 간단한 볶음 레시피입니다.',
        used_ingredients: '머위나물,오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
        author: '머위달인',
        date: '25-03-08',
        like: 67,
        comment: 9,
        substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
      },
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '머위나물 대패삼겹살 제육볶음 레시피',
        body: '머위나물과 대패삼겹살로 만드는 제육볶음 레시피입니다.',
        used_ingredients: '머위나물,삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
        author: '머위달인',
        date: '25-04-09',
        like: 45,
        comment: 6,
        substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
        title: '머위나물 미나리 오삼불고기',
        body: '머위나물, 미나리, 오징어, 제육이 어우러진 오삼불고기 레시피입니다.',
        used_ingredients: '머위나물,오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
        author: '머위달인',
        date: '25-04-06',
        like: 51,
        comment: 7,
        substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '머위나물 무침 레시피',
        body: '봄철 머위나물로 만드는 초간단 무침 레시피입니다.',
        used_ingredients: '머위나물,고추장,참기름,깨소금,간장,마늘',
        author: '머위달인',
        date: '25-04-10',
        like: 32,
        comment: 3,
        substitutes: ['머위나물→고사리', '고추장→된장'],
      },
    ],
    '도다리': [
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '도다리 오징어볶음 레시피 만드는법 간단',
        body: '도다리와 오징어로 만드는 간단한 볶음 레시피입니다.',
        used_ingredients: '도다리,오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
        author: '도다리달인',
        date: '25-03-08',
        like: 57,
        comment: 8,
        substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
      },
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '도다리 대패삼겹살 제육볶음 레시피',
        body: '도다리와 대패삼겹살로 만드는 제육볶음 레시피입니다.',
        used_ingredients: '도다리,삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
        author: '도다리달인',
        date: '25-04-09',
        like: 35,
        comment: 4,
        substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
        title: '도다리 미나리 오삼불고기',
        body: '도다리, 미나리, 오징어, 제육이 어우러진 오삼불고기 레시피입니다.',
        used_ingredients: '도다리,오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
        author: '도다리달인',
        date: '25-04-06',
        like: 41,
        comment: 6,
        substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '도다리 무침 레시피',
        body: '봄철 도다리로 만드는 초간단 무침 레시피입니다.',
        used_ingredients: '도다리,고추장,참기름,깨소금,간장,마늘',
        author: '도다리달인',
        date: '25-04-10',
        like: 22,
        comment: 2,
        substitutes: ['도다리→고사리', '고추장→된장'],
      },
    ],
    '저소노화': [
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '저소노화 감자전 레시피',
        body: '저소노화에 좋은 감자와 다양한 재료로 만드는 감자전 레시피입니다.',
        used_ingredients: '감자,양파,전분,소금,후추,식용유,당근,파프리카,베이컨,치즈',
        author: '테마달인',
        date: '25-05-01',
        like: 120,
        comment: 15,
        substitutes: ['감자→고구마', '전분→감자'],
      },
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '저소노화 다이어트 김밥',
        body: '저소노화에 좋은 재료로 만든 다이어트 김밥 레시피입니다.',
        used_ingredients: '오이,김,밥,당근,계란,참치,마요네즈,시금치,단무지,햄',
        author: '테마달인',
        date: '25-05-02',
        like: 98,
        comment: 11,
        substitutes: ['당근→오이', '밥→곤약밥'],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '저소노화 황태해장국',
        body: '저소노화에 좋은 황태와 채소로 만드는 해장국 레시피입니다.',
        used_ingredients: '황태,무,대파,달걀,마늘,국간장,참기름,후추,청양고추,두부',
        author: '테마달인',
        date: '25-05-03',
        like: 87,
        comment: 8,
        substitutes: ['두부→황태', '청양고추→고추'],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '저소노화 봄나물 무침',
        body: '저소노화에 좋은 봄나물로 만드는 초간단 무침 레시피입니다.',
        used_ingredients: '봄나물,고추장,참기름,깨소금,간장,마늘',
        author: '테마달인',
        date: '25-05-04',
        like: 44,
        comment: 4,
        substitutes: ['봄나물→시금치', '고추장→된장'],
      },
    ],
    '어버이날': [
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '어버이날 감자전 레시피',
        body: '어버이날에 어울리는 감자전 레시피입니다.',
        used_ingredients: '감자,양파,전분,소금,후추,식용유,당근,파프리카,베이컨,치즈',
        author: '테마달인',
        date: '25-05-08',
        like: 110,
        comment: 13,
        substitutes: ['감자→고구마', '전분→감자'],
      },
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '어버이날 다이어트 김밥',
        body: '어버이날에 건강하게 먹을 수 있는 다이어트 김밥 레시피입니다.',
        used_ingredients: '오이,김,밥,당근,계란,참치,마요네즈,시금치,단무지,햄',
        author: '테마달인',
        date: '25-05-08',
        like: 90,
        comment: 10,
        substitutes: ['당근→오이', '밥→곤약밥'],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '어버이날 황태해장국',
        body: '어버이날에 어울리는 황태해장국 레시피입니다.',
        used_ingredients: '황태,무,대파,달걀,마늘,국간장,참기름,후추,청양고추,두부',
        author: '테마달인',
        date: '25-05-08',
        like: 80,
        comment: 9,
        substitutes: ['두부→황태', '청양고추→고추'],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '어버이날 봄나물 무침',
        body: '어버이날에 어울리는 봄나물 무침 레시피입니다.',
        used_ingredients: '봄나물,고추장,참기름,깨소금,간장,마늘',
        author: '테마달인',
        date: '25-05-08',
        like: 42,
        comment: 5,
        substitutes: ['봄나물→시금치', '고추장→된장'],
      },
    ],
    '기관지': [
      {
        id: 1,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '기관지 감자전 레시피',
        body: '기관지 건강에 좋은 감자전 레시피입니다.',
        used_ingredients: '감자,양파,전분,소금,후추,식용유,당근,파프리카,베이컨,치즈',
        author: '테마달인',
        date: '25-05-10',
        like: 100,
        comment: 12,
        substitutes: ['감자→고구마', '전분→감자'],
      },
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '기관지 다이어트 김밥',
        body: '기관지 건강에 좋은 재료로 만든 다이어트 김밥 레시피입니다.',
        used_ingredients: '오이,김,밥,당근,계란,참치,마요네즈,시금치,단무지,햄',
        author: '테마달인',
        date: '25-05-10',
        like: 85,
        comment: 7,
        substitutes: ['당근→오이', '밥→곤약밥'],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '기관지 황태해장국',
        body: '기관지 건강에 좋은 황태해장국 레시피입니다.',
        used_ingredients: '황태,무,대파,달걀,마늘,국간장,참기름,후추,청양고추,두부',
        author: '테마달인',
        date: '25-05-10',
        like: 77,
        comment: 6,
        substitutes: ['두부→황태', '청양고추→고추'],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: '기관지 봄나물 무침',
        body: '기관지 건강에 좋은 봄나물 무침 레시피입니다.',
        used_ingredients: '봄나물,고추장,참기름,깨소금,간장,마늘',
        author: '테마달인',
        date: '25-05-10',
        like: 39,
        comment: 3,
        substitutes: ['봄나물→시금치', '고추장→된장'],
      },
    ],
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
      {
        id: 2,
        thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
        title: `${key}로 만든 초간단 볶음`,
        body: `${key}와 채소를 활용한 간단 볶음 레시피입니다.`,
        used_ingredients: `${key},당근,양파,간장,설탕,참기름`,
        author: '예시봇',
        date: '25-05-15',
        like: 2,
        comment: 1,
        substitutes: [`${key}→비슷한재료`],
      },
      {
        id: 3,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: `${key} 활용 영양만점 반찬`,
        body: `${key}를 활용한 영양만점 반찬 레시피입니다.`,
        used_ingredients: `${key},계란,파,마늘,참기름,깨소금`,
        author: '예시봇',
        date: '25-05-15',
        like: 3,
        comment: 2,
        substitutes: [`${key}→다른반찬재료`],
      },
      {
        id: 4,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        title: `${key}로 만드는 건강 샐러드`,
        body: `${key}와 신선한 채소로 만드는 건강 샐러드 레시피입니다.`,
        used_ingredients: `${key},상추,오이,방울토마토,드레싱`,
        author: '예시봇',
        date: '25-05-15',
        like: 4,
        comment: 0,
        substitutes: [`${key}→샐러드재료`],
      },
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

// 필터 선택 상태 관리
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
  const [buttonStates, setButtonStates] = useState<{ [id: number]: { done: boolean; share: boolean; write: boolean } }>({});
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
      // name이 used_ingredients, title, body에 포함된 레시피만 필터
      const filtered = data.filter(r =>
        r.used_ingredients.includes(name) ||
        r.title.includes(name) ||
        r.body.includes(name)
      ).slice(0, 30);
      setRecipes(filtered);
    });
  }, [name]);

  // 무한 스크롤
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

  // 정렬 로직
  let sortedRecipes = [...recipes].map(recipe => {
    const match = getMatchRate(myIngredients, recipe.used_ingredients);
    return { ...recipe, match_rate: match.rate, my_ingredients: match.my_ingredients, need_ingredients: match.need_ingredients };
  });
  if (sortType === 'match') sortedRecipes.sort((a, b) => b.match_rate - a.match_rate);
  else if (sortType === 'expiry') sortedRecipes.sort((a, b) => 0); // TODO: 유통기한 임박순 정렬 구현 필요

  // 버튼 클릭 핸들러
  const handleButtonClick = (id: number, type: 'done' | 'share' | 'write', recipe: any) => {
    const prevState = buttonStates[id] || { done: false, share: false, write: false };
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
      {/* TopNavBar 대신 직접 header 구현: 뒤로가기 버튼과 검색 아이콘이 같은 라인에 */}
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
          maxWidth: 400, // Matched to RecipeList.tsx
          minHeight: '100vh',
          boxSizing: 'border-box',
          paddingLeft: 14, // Matched to RecipeList.tsx
          paddingRight: 14, // Matched to RecipeList.tsx
          paddingTop: 32, // Matched to RecipeList.tsx
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
        {/* 정렬/필터 바 - Matched to RecipeList.tsx */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            width: '100%',
            marginTop: 32, // Added marginTop
          }}
        >
          <select
            style={{ // Matched to RecipeList.tsx
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
            {/* Consider adding other sortOptions from RecipeList if applicable */}
          </select>
          <button
            style={{ // Matched to RecipeList.tsx
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 16px',
              borderRadius: 999, // Equivalent to rounded-full
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
            includeKeyword={includeKeyword} // Passed from state
            setIncludeKeyword={setIncludeKeyword} // Passed from state
          />
        )}
        <div className="flex flex-col gap-2">
          {sortedRecipes.slice(0, visibleCount).map((recipe: any, idx: number, arr: any[]) => {
            const recipeSpecificIngredients = [
              ...(recipe.need_ingredients?.map((ing: string) => ({ ing, type: 'need' })) || []).filter((item: {ing: string}) => item.ing && item.ing.trim() !== ''), // Added trim check
              ...(recipe.my_ingredients?.map((ing: string) => ({ ing, type: 'have' })) || []).filter((item: {ing: string}) => item.ing && item.ing.trim() !== ''), // Added trim check
            ];
            const btnState = buttonStates[recipe.id] || { done: false, share: false, write: false }; // Ensure all states initialized
            return (
              <div
                key={recipe.id}
                style={{ // Adopted styling from RecipeList.tsx
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
                      onClick={(e) => { e.preventDefault(); handleButtonClick(recipe.id, 'done', recipe); }}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()} // Added from RecipeList
                    >
                      <img
                        src={btnState.done ? doneBlackIcon : doneIcon} // Use doneBlackIcon
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
                      onClick={(e) => { e.preventDefault(); handleButtonClick(recipe.id, 'share', recipe); }}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()} // Added from RecipeList
                    >
                      <img
                        src={btnState.share ? shareBlackIcon : shareIcon} // Use shareBlackIcon
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
                      onClick={(e) => { e.preventDefault(); handleButtonClick(recipe.id, 'write', recipe); }}
                      tabIndex={0}
                      onMouseDown={e => e.preventDefault()} // Added from RecipeList
                    >
                      <img
                        src={btnState.write ? writeBlackIcon : writeIcon} // Use writeBlackIcon
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
                  {recipeSpecificIngredients // Changed from allIngredients to recipeSpecificIngredients
                    .filter(({ ing }) => ing && ing.trim() !== '') // Ensure ing is not undefined or empty
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