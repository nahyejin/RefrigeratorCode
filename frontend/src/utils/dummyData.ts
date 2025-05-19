// 공통 더미 데이터/함수 모음

export const dummyRecipes = [
  {
    id: 1,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '간단한 파스타 레시피',
    body: '맛있는 파스타를 만드는 방법입니다.',
    used_ingredients: '파스타,올리브오일,마늘,소금,후추',
    author: '요리사',
    date: '25-04-06',
    like: 120,
    comment: 15,
    link: 'https://example.com/recipe/1',
    substitutes: ['파스타→스파게티', '올리브오일→식용유']
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
    title: '건강한 샐러드',
    body: '신선한 채소로 만드는 건강한 샐러드입니다.',
    used_ingredients: '상추,토마토,오이,올리브오일,소금',
    author: '영양사',
    date: '25-04-05',
    like: 85,
    comment: 8,
    link: 'https://example.com/recipe/2',
    substitutes: ['상추→양상추', '올리브오일→식용유']
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '미나리 오삼불고기',
    body: '언제 먹어도 맛있죠. 누구나 다 좋아하죠.',
    used_ingredients: '오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
    author: '껌딱지',
    date: '25-04-06',
    like: 61,
    comment: 10,
    link: 'https://example.com/recipe/3',
    substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다', '고추장→된장', '설탕→올리고당']
  },
  // ... (필요시 추가)
];

export function fetchRecipesDummy(name?: string) {
  if (!name) return Promise.resolve(dummyRecipes);
  // name이 포함된 더미 데이터만 반환 (간단 필터)
  return Promise.resolve(dummyRecipes.filter(r => r.title.includes(name) || r.body?.includes(name) || r.used_ingredients?.includes(name)));
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