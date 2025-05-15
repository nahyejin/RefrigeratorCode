import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/냉털이 로고 white.png';
import searchIcon from '../assets/navigator_search.png';
import writeIcon from '../assets/write.svg';
import doneIcon from '../assets/done.svg';
import shareIcon from '../assets/share.svg';
import 기록하기버튼 from '../assets/기록하기버튼.svg';
import 완료하기버튼 from '../assets/완료하기버튼.svg';
import 공유하기버튼 from '../assets/공유하기버튼.svg';
import BottomNavBar from '../components/BottomNavBar';
import IngredientDetail from './IngredientDetail';

const dummyRecorded = [
  {
    id: 1,
    thumbnail: 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg',
    title: '오징어볶음 레시피 만드는법 간단',
    author: '꼬마츄츄',
    date: '25-03-08',
    match: 38,
    summary: '저는 평소 찬밥과 곁들여 먹기 딱 좋은... 오징어볶음 레시피입니다.',
    used_ingredients: ['오징어','고추','대파','양파','당근','고추장','참기름','고춧가루','올리고당','설탕','다진마늘','간장','후추'],
    substitutes: ['양파→대파', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장', '다진마늘→마늘가루', '간장→소금'],
  },
  {
    id: 2,
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    title: '대패삼겹살 제육볶음 레시피',
    author: '꼬마츄츄',
    date: '25-04-09',
    match: 36,
    summary: '미리 양념장을 만들어서 볶으셔도 좋고, 저처럼 바로 재료에 다 때려 넣고 볶아도 맛있는 대패삼겹살 제육볶음 레시피 만들 수 있답니다.',
    used_ingredients: ['삼겹살','후추','양파','대파','고추','간장','다진마늘','설탕','맛술','미림','오징어'],
    substitutes: ['맛술→소주', '미림→청주', '오징어→한치', '고추장→된장', '설탕→올리고당', '참기름→들기름', '고춧가루→고추장'],
  },
  {
    id: 3,
    thumbnail: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
    title: '미나리 오삼불고기. 술안주로 좋지요~~',
    author: '껌딱지',
    date: '25-04-06',
    match: 23,
    summary: '언제 먹어도 맛있죠. 누구나 다 좋아하죠. 오징어 볶음도 맛있고, 제육볶음도 맛있고 고민될 땐 오삼불고기죠 ^^.',
    used_ingredients: ['오징어','고추장','고춧가루','간장','된장','다진마늘','후춧가루','설탕','맛술','미나리','치킨스톡','코인육수','매실액'],
    substitutes: ['맛술→소주', '미나리→쪽파', '치킨스톡→미원', '코인육수→다시다, 멸치액젓', '고추장→된장', '설탕→올리고당', '참기름→들기름'],
  },
];

const RecordedRecipeListPage = () => {
  return <IngredientDetail customTitle="내가 기록한 레시피" />;
};

export default RecordedRecipeListPage; 