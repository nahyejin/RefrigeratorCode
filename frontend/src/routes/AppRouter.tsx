import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, useState } from 'react';
import SplashScreen from '../components/SplashScreen';
import ScrollToTop from '../components/ScrollToTop';
import TopNavBar from '../components/TopNavBar';
import ErrorBoundary from '../components/ErrorBoundary';
import HomeInstallPrompt from '../components/HomeInstallPrompt';
import RecipeChatWidget from '../components/RecipeChatWidget';
import ShareRequestPopup from '../components/ShareRequestPopup';
import { AuthProvider } from '../context/AuthContext';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import FindEmail from '../pages/FindEmail';
import ResetPassword from '../pages/ResetPassword';
import FridgeSelect from '../pages/FridgeSelect';
import IngredientInput from '../pages/IngredientInput';
import RecipeList from '../pages/RecipeList';
import MyPage from '../pages/MyPage';
import IngredientDetail from '../pages/IngredientDetail';
import AuthSuccess from '../pages/AuthSuccess';
import JoinHousehold from '../pages/JoinHousehold';
import CookingCalendar from '../pages/CookingCalendar';
import { evaluateVisitForUsageGuide } from '../utils/onboardingPrompts';

// =====================
// 라우트 상수
// =====================

const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FIND_EMAIL: '/find-email',
  RESET_PASSWORD: '/reset-password',
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
  MY_FAVORITE: '/mypage/favorite',
  JOIN_HOUSEHOLD: '/join-household',
  COOKING_CALENDAR: '/cooking-calendar',
} as const;

// =====================
// 지연 로딩 컴포넌트
// =====================

const Popular = lazy(() => import('../pages/Popular'));
const MyFridge = lazy(() => import('../pages/MyFridge'));
const RecipeDetail = lazy(() => import('../pages/RecipeDetail'));
// 어드민은 반드시 lazy 로 둔다 — 일반 사용자 번들에 관리자 화면 코드가 실리면
// 용량도 늘고 내부 구조가 그대로 노출된다. (권한 검사는 서버가 따로 한다)
const Admin = lazy(() => import('../pages/Admin'));

// =====================
// 라우터 컴포넌트
// =====================

/**
 * 애플리케이션의 메인 라우터
 * 지연 로딩을 통해 성능을 최적화하고, 스플래시 스크린을 제공합니다.
 */
// GNB를 표시할 경로 목록 (로그인 페이지 등은 제외)
const SHOW_NAVBAR_PATHS = ['/', '/recipe-list', '/my-fridge', '/popular', '/my-page', '/ingredient', '/mypage', '/recipe-detail'];

function AppContent() {
  const location = useLocation();
  const showNavBar = SHOW_NAVBAR_PATHS.some(path => location.pathname.startsWith(path));
  useState(() => evaluateVisitForUsageGuide());
  
  return (
    <>
      {/* GNB는 항상 표시 (로그인 페이지 제외) */}
      {showNavBar && <TopNavBar />}
      {/* 라우트 지연 로딩 시 GNB 아래에만 스피너 표시 */}
      <Suspense
        fallback={
          <div
            style={{
              position: 'fixed',
              top: showNavBar ? '56px' : '0',
              left: 0,
              right: 0,
              width: '100%',
              padding: '12px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              zIndex: 'var(--z-nav)',
              backgroundColor: 'transparent',
              minHeight: showNavBar ? 'calc(100vh - 56px)' : '100vh'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                paddingTop: '20px'
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 44 44"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="로딩 중"
              >
                <g fill="none" fillRule="evenodd" strokeWidth="4">
                  <circle cx="22" cy="22" r="20" stroke="#E6E6EA" />
                  <path d="M42 22c0-11.046-8.954-20-20-20" stroke="#9A9AA2">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 22 22"
                      to="360 22 22"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              </svg>
            </div>
          </div>
        }
      >
        <Routes>
          {/* 홈 페이지 - MyFridge로 랜딩 */}
          <Route 
            path={ROUTES.HOME} 
            element={
              <ErrorBoundary>
                <MyFridge />
              </ErrorBoundary>
            } 
          />
          
          {/* 로그인 페이지 */}
          <Route 
            path={ROUTES.LOGIN} 
            element={<Login />} 
          />
          
          {/* 회원가입 페이지 */}
          <Route 
            path={ROUTES.SIGNUP} 
            element={<Signup />} 
          />
          
          {/* 이메일 찾기 페이지 */}
          <Route 
            path={ROUTES.FIND_EMAIL} 
            element={<FindEmail />} 
          />
          
          {/* 비밀번호 찾기 페이지 */}
          <Route 
            path={ROUTES.RESET_PASSWORD} 
            element={<ResetPassword />} 
          />
          
          {/* 소셜 로그인 콜백 */}
          <Route 
            path="/auth/callback/:provider" 
            element={<AuthSuccess />} 
          />
          
          {/* 소셜 로그인 성공 */}
          <Route
            path="/auth/success"
            element={<AuthSuccess />}
          />

          {/* 가족 그룹 초대 링크로 진입 */}
          <Route
            path={ROUTES.JOIN_HOUSEHOLD}
            element={<JoinHousehold />}
          />

          {/* 요리 캘린더 */}
          <Route
            path={ROUTES.COOKING_CALENDAR}
            element={<CookingCalendar />}
          />

          {/* 내 냉장고 페이지 */}
          <Route 
            path={ROUTES.MY_FRIDGE} 
            element={
              <ErrorBoundary>
                <MyFridge />
              </ErrorBoundary>
            } 
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

          {/* 내가 즐겨찾는 레시피 */}
          <Route 
            path={ROUTES.MY_FAVORITE} 
            element={<IngredientDetail customTitle="내가 즐겨찾는 레시피" />} 
          />

          {/* 어드민. 서버가 /api/admin/* 마다 is_admin 을 확인하므로 경로를
              아는 것만으로는 아무것도 볼 수 없다. */}
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Suspense>
      <HomeInstallPrompt />
      <RecipeChatWidget />
      <ShareRequestPopup />
    </>
  );
}

function AppRouter() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default AppRouter; 