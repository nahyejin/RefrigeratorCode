// 공통 더미 데이터/함수 모음

export const dummyRecipes = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다.',
    used_ingredients: '오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
    author: '꼬마츄츄',
    date: '25-03-08',
    like: 77,
    comment: 12,
    substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    body: '미리 양념장을 만들어서 볶으셔도 좋고, 저처럼 바로 재료에 다 때려 넣고 볶아도 맛있는 대패삼겹살 제육볶음 레시피 만들 수 있답니다.',
    used_ingredients: '삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
    author: '꼬마츄츄',
    date: '25-04-09',
    like: 55,
    comment: 8,
    substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '미나리 오삼불고기. 술안주로 좋지요~~',
    body: '언제 먹어도 맛있죠. 누구나 다 좋아하죠. 오징어 볶음도 맛있고, 제육볶음도 맛있고 고민될 땐 오삼불고기죠 ^^.',
    used_ingredients: '오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
    author: '껌딱지',
    date: '25-04-06',
    like: 61,
    comment: 10,
    substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
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