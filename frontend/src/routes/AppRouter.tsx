import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import SplashScreen from '../components/SplashScreen';
import Login from '../pages/Login';
import FridgeSelect from '../pages/FridgeSelect';
import IngredientInput from '../pages/IngredientInput';
import RecipeList from '../pages/RecipeList';
import MyPage from '../pages/MyPage';
import IngredientDetail from '../pages/IngredientDetail';

// =====================
// 라우트 상수
// =====================

const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  MY_FRIDGE: '/my-fridge',
  FRIDGE_SELECT: '/fridge-select',
  INGREDIENT_INPUT: '/ingredient-input',
  RECIPE_LIST: '/recipe-list',
  RECIPE_DETAIL: '/recipe-detail/:id',
  POPULAR: '/popular',
  MY_PAGE: '/my-page',
  INGREDIENT_DETAIL: '/ingredient/:name',
  MY_RECORDED: '/mypage/recorded',
  MY_COMPLETED: '/mypage/completed',
} as const;

// =====================
// 지연 로딩 컴포넌트
// =====================

const Popular = lazy(() => import('../pages/Popular'));
const MyFridge = lazy(() => import('../pages/MyFridge'));
const RecipeDetail = lazy(() => import('../pages/RecipeDetail'));

// =====================
// 라우터 컴포넌트
// =====================

/**
 * 애플리케이션의 메인 라우터
 * 지연 로딩을 통해 성능을 최적화하고, 스플래시 스크린을 제공합니다.
 */
function AppRouter() {
  return (
    <Router>
      <Suspense fallback={<SplashScreen recipeCount={0} />}>
        <Routes>
          {/* 홈 페이지 - RecipeList로 리다이렉트 */}
          <Route 
            path={ROUTES.HOME} 
            element={<RecipeList />} 
          />
          
          {/* 로그인 페이지 */}
          <Route 
            path={ROUTES.LOGIN} 
            element={<Login />} 
          />
          
          {/* 내 냉장고 페이지 */}
          <Route 
            path={ROUTES.MY_FRIDGE} 
            element={<MyFridge />} 
          />
          
          {/* 냉장고 선택 페이지 */}
          <Route 
            path={ROUTES.FRIDGE_SELECT} 
            element={<FridgeSelect />} 
          />
          
          {/* 재료 입력 페이지 */}
          <Route 
            path={ROUTES.INGREDIENT_INPUT} 
            element={<IngredientInput />} 
          />
          
          {/* 레시피 목록 페이지 */}
          <Route 
            path={ROUTES.RECIPE_LIST} 
            element={<RecipeList />} 
          />
          
          {/* 레시피 상세 페이지 */}
          <Route 
            path={ROUTES.RECIPE_DETAIL} 
            element={<RecipeDetail />} 
          />
          
          {/* 인기 레시피 페이지 */}
          <Route 
            path={ROUTES.POPULAR} 
            element={<Popular />} 
          />
          
          {/* 마이페이지 */}
          <Route 
            path={ROUTES.MY_PAGE} 
            element={<MyPage />} 
          />
          
          {/* 재료 상세 페이지 */}
          <Route 
            path={ROUTES.INGREDIENT_DETAIL} 
            element={<IngredientDetail />} 
          />
          
          {/* 내가 기록한 레시피 */}
          <Route 
            path={ROUTES.MY_RECORDED} 
            element={<IngredientDetail customTitle="내가 기록한 레시피" />} 
          />
          
          {/* 내가 완료한 레시피 */}
          <Route 
            path={ROUTES.MY_COMPLETED} 
            element={<IngredientDetail customTitle="내가 완료한 레시피" />} 
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default AppRouter; 