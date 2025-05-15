import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import FilterModal from '../components/FilterModal';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import writeIcon from '../assets/write.svg';
import doneBlackIcon from '../assets/done_black.svg';
import shareBlackIcon from '../assets/share_black.svg';
import writeBlackIcon from '../assets/write_black.svg';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import IngredientDetail from './IngredientDetail';

const dummyCompleted = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    body: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다. 저는 평소 잔거리 고를 때 마트에 가서 한 번 쭉~ 둘러 본 다음에 오늘 세일하는거 뭔가 보고 결정을 해요. 지난주 어느날에는 마트에 갔는데 오징어 세일이라 집어 왔어요 ㅎ. 그래서 이걸로 오징어요리 뭐할까하다 그냥 제일 간단한 물기없는 오징어볶음 레시피 …',
    used_ingredients: '오징어,고추,대파,양파,당근,고추장,참기름,고춧가루,올리고당,설탕,다진마늘,간장,후추',
    author: '꼬마츄츄',
    date: '25-03-08',
    substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
    match: 38,
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    body: '미리 양념장을 만들어서 볶으셔도 좋고, 저처럼 그냥 바로 재료에 다 때려 넣고 볶아도 맛있는 대패삼겹살 제육볶음 레시피 만들 수 있답니다. 개인적으로 아주 좋아하는 메뉴이기 때문에 앞다리살, 목살, 삼겹살, 뒷다리살 등 구입을 해오면 볶아먹게 되는 것 같습니다. 고기와 채소, 양념이 어우러져 정말 맛있어요!',
    used_ingredients: '삼겹살,후추,양파,대파,고추,간장,다진마늘,설탕,맛술,미림,오징어',
    author: '꼬마츄츄',
    date: '25-04-09',
    substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
    match: 36,
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '미나리 오삼불고기. 술안주로 좋지요~~',
    body: '언제 먹어도 맛있죠. 누구나 다 좋아하죠. 오징어 볶음도 맛있고, 제육볶음도 맛있고 고민될 땐 오삼불고기죠 ^^. 밥한그릇 뚝딱하게 만드는 애정하는 메뉴입니다. 자. 먼저 통오징어를 먼저 손질해 줍니다. 오징어 몸통안으로 손가락을 넣어 오징어 몸통과 내장이 연결되어 …',
    used_ingredients: '오징어,고추장,고춧가루,간장,된장,다진마늘,후춧가루,설탕,맛술,미나리,치킨스톡,코인육수,매실액',
    author: '껌딱지',
    date: '25-04-06',
    substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
    match: 23,
  },
];

const sortOptions = [
  { key: 'match', label: '재료매칭률순' },
  { key: 'date', label: '최신순' },
];

function getMatchRate(recipeIngredients: string) {
  // For demo, just return 38/36/23 as in dummyCompleted
  // In real, parse and calculate
  return Math.floor(Math.random() * 60) + 20;
}

const CompletedRecipeListPage = () => {
  return <IngredientDetail customTitle="내가 완료한 레시피" />;
};

export default CompletedRecipeListPage; 