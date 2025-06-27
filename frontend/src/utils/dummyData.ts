import { Recipe } from '../types/recipe';

// =====================
// 상수
// =====================

const PLATFORMS = {
  NAVER: 'naver',
  YOUTUBE: 'youtube',
} as const;

const CATEGORIES = {
  KOREAN: '한식',
  WESTERN: '양식',
  CHINESE: '중식',
  JAPANESE: '일식',
  DESSERT: '디저트',
} as const;

// =====================
// 타입 정의
// =====================

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];
export type Category = typeof CATEGORIES[keyof typeof CATEGORIES];

// =====================
// 더미 데이터
// =====================

/**
 * 테스트용 더미 레시피 데이터
 */
export const dummyRecipes: Recipe[] = [
  {
    id: 1,
    title: '김치찌개',
    body: '매콤달콤한 김치찌개 레시피입니다.',
    content: '매콤달콤한 김치찌개 레시피입니다.',
    author: '요리사',
    date: '2024-01-15',
    thumbnail: 'https://example.com/kimchi-stew.jpg',
    link: 'https://example.com/recipe/1',
    platform: PLATFORMS.NAVER,
    channel: PLATFORMS.NAVER,
    used_ingredients: '김치, 돼지고기, 두부, 파, 양파',
    likes: 150,
    comments: 25,
    like_count: 150,
    comment_count: 25,
    hits: 1200,
    match_rate: 85,
    my_ingredients: ['김치', '돼지고기', '두부'],
    need_ingredients: ['파', '양파'],
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    substitutes: ['돼지고기→소고기', '파→양파'],
  },
  {
    id: 2,
    title: '파스타 카르보나라',
    body: '크림소스가 듬뿍 들어간 파스타 카르보나라입니다.',
    content: '크림소스가 듬뿍 들어간 파스타 카르보나라입니다.',
    author: '요리사',
    date: '2024-01-14',
    thumbnail: 'https://example.com/carbonara.jpg',
    link: 'https://example.com/recipe/2',
    platform: PLATFORMS.YOUTUBE,
    channel: PLATFORMS.YOUTUBE,
    used_ingredients: '스파게티, 베이컨, 계란, 파마산치즈, 후추',
    likes: 200,
    comments: 30,
    like_count: 200,
    comment_count: 30,
    hits: 1800,
    match_rate: 60,
    my_ingredients: ['스파게티', '계란'],
    need_ingredients: ['베이컨', '파마산치즈', '후추'],
    created_at: '2024-01-14T15:30:00Z',
    updated_at: '2024-01-14T15:30:00Z',
    substitutes: ['파마산치즈→체다치즈'],
  },
  {
    id: 3,
    title: '마파두부',
    body: '매콤한 마파두부 요리입니다.',
    content: '매콤한 마파두부 요리입니다.',
    author: '요리사',
    date: '2024-01-13',
    thumbnail: 'https://example.com/mapo-tofu.jpg',
    link: 'https://example.com/recipe/3',
    platform: PLATFORMS.NAVER,
    channel: PLATFORMS.NAVER,
    used_ingredients: '두부, 돼지고기, 고추, 마늘, 생강',
    likes: 120,
    comments: 18,
    like_count: 120,
    comment_count: 18,
    hits: 950,
    match_rate: 70,
    my_ingredients: ['두부', '돼지고기', '마늘'],
    need_ingredients: ['고추', '생강'],
    created_at: '2024-01-13T12:00:00Z',
    updated_at: '2024-01-13T12:00:00Z',
    substitutes: ['돼지고기→소고기'],
  },
  {
    id: 4,
    title: '초코케이크',
    body: '부드러운 초코케이크 만드는 방법입니다.',
    content: '부드러운 초코케이크 만드는 방법입니다.',
    author: '요리사',
    date: '2024-01-12',
    thumbnail: 'https://example.com/chocolate-cake.jpg',
    link: 'https://example.com/recipe/4',
    platform: PLATFORMS.YOUTUBE,
    channel: PLATFORMS.YOUTUBE,
    used_ingredients: '밀가루, 코코아파우더, 설탕, 계란, 우유',
    likes: 180,
    comments: 22,
    like_count: 180,
    comment_count: 22,
    hits: 1400,
    match_rate: 40,
    my_ingredients: ['밀가루', '설탕'],
    need_ingredients: ['코코아파우더', '계란', '우유'],
    created_at: '2024-01-12T09:15:00Z',
    updated_at: '2024-01-12T09:15:00Z',
    substitutes: [],
  },
  {
    id: 5,
    title: '우동',
    body: '일본식 우동 요리입니다.',
    content: '일본식 우동 요리입니다.',
    author: '요리사',
    date: '2024-01-11',
    thumbnail: 'https://example.com/udon.jpg',
    link: 'https://example.com/recipe/5',
    platform: PLATFORMS.NAVER,
    channel: PLATFORMS.NAVER,
    used_ingredients: '우동면, 다시, 간장, 파, 김',
    likes: 90,
    comments: 12,
    like_count: 90,
    comment_count: 12,
    hits: 750,
    match_rate: 30,
    my_ingredients: ['파'],
    need_ingredients: ['우동면', '다시', '간장', '김'],
    created_at: '2024-01-11T16:45:00Z',
    updated_at: '2024-01-11T16:45:00Z',
    substitutes: ['우동면→소면', '다시→멸치육수'],
  },
];

/**
 * 테스트용 더미 재료 목록
 */
export const dummyIngredients: string[] = [
  '김치',
  '돼지고기',
  '두부',
  '스파게티',
  '계란',
  '마늘',
  '밀가루',
  '설탕',
  '파',
];

/**
 * 테스트용 더미 대체재료 테이블
 */
export const dummySubstituteTable = {
  '돼지고기': { ingredient_b: '소고기' },
  '파마산치즈': { ingredient_b: '체다치즈' },
  '우동면': { ingredient_b: '소면' },
  '다시': { ingredient_b: '멸치육수' },
};

export function fetchRecipesDummy(name?: string) {
  if (!name) return Promise.resolve(dummyRecipes);
  // name이 포함된 더미 데이터만 반환 (간단 필터)
  return Promise.resolve(dummyRecipes.filter(r => r.title.includes(name) || r.content?.includes(name) || r.used_ingredients?.includes(name)));
}

export const dummyRecorded = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '요즘 틱톡에서 유행하는 초간단 안주레시피',
    match: 80,
  },
  // ... (필요시 추가)
];

export const dummyCompleted = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    match: 85,
  },
  // ... (필요시 추가)
]; 