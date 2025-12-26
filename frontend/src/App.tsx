import React, { useEffect, useRef, useState } from 'react';
import AppRouter from './routes/AppRouter';
import SplashScreen from './components/SplashScreen';
import OfflineIndicator from './components/OfflineIndicator';

function App() {
  // 한 번이라도 스플래시를 본 세션에서는 다시 표시하지 않음 (모바일 새로고침 시 재등장 방지)
  const hasSeenSplashRef = useRef(sessionStorage.getItem('splashShown') === 'true');
  const [showSplash, setShowSplash] = useState(!hasSeenSplashRef.current);
  const [recipeCount, setRecipeCount] = useState(0);
  const [splashKey, setSplashKey] = useState(0);
  const recipeCountSetTimeRef = useRef<number | null>(null);
  const splashTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 스플래시 화면을 강제로 표시하기 위한 디버깅
  console.log('App component rendered, showSplash:', showSplash);
  console.log(import.meta.env);

  useEffect(() => {
    if (!showSplash) return;

    // 실제 API 연동: 전체 레시피 개수 가져오기
    // 환경변수가 없으면 프로덕션 URL 사용 (로컬 개발 시 백엔드 서버 실행 필요)
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://refrigeratorcode-production.up.railway.app';
    
    console.log('[App] API URL:', apiUrl);
    
    fetch(`${apiUrl}/api/recipes`)
      .then(res => res.json())
      .then(data => {
        console.log('스플래시 화면 - API 응답:', data);
        // data.total이 있으면 사용, 없으면 data.recipes의 길이 사용
        const count = data.total || (Array.isArray(data.recipes) ? data.recipes.length : 0);
        console.log('스플래시 화면 - 총 레시피 수:', count);
        setRecipeCount(count);
        setSplashKey(prev => prev + 1);
        
        // 레시피 수가 설정된 시점 기록
        recipeCountSetTimeRef.current = Date.now();
        
        // 레시피 수가 설정된 후 최소 2초는 더 표시
        if (splashTimerRef.current) {
          clearTimeout(splashTimerRef.current);
        }
        splashTimerRef.current = setTimeout(() => {
          console.log('스플래시 화면 종료 (레시피 수 집계 후 2초 경과)');
          setShowSplash(false);
          sessionStorage.setItem('splashShown', 'true');
        }, 2000);
      })
      .catch(error => {
        console.error('스플래시 화면 - API 호출 실패:', error);
        setRecipeCount(0);
        // API 실패 시에도 최소 표시 시간 보장
        recipeCountSetTimeRef.current = Date.now();
        if (splashTimerRef.current) {
          clearTimeout(splashTimerRef.current);
        }
        splashTimerRef.current = setTimeout(() => {
          console.log('스플래시 화면 종료 (API 실패 후 2초 경과)');
          setShowSplash(false);
          sessionStorage.setItem('splashShown', 'true');
        }, 2000);
      });
    
    // 최대 표시 시간 (레시피 수가 오래 걸려도 최대 5초 후에는 종료)
    const maxTimer = setTimeout(() => {
      console.log('스플래시 화면 종료 (최대 표시 시간 도달)');
      setShowSplash(false);
      sessionStorage.setItem('splashShown', 'true');
    }, 5000);

    return () => {
      if (splashTimerRef.current) {
        clearTimeout(splashTimerRef.current);
      }
      clearTimeout(maxTimer);
    };
  }, [showSplash]);

  // recipeCount가 변경될 때마다 로그 출력
  useEffect(() => {
    console.log('App.tsx - recipeCount changed to:', recipeCount);
  }, [recipeCount]);

  console.log('App.tsx - showSplash:', showSplash, 'recipeCount:', recipeCount);
  
  if (showSplash) {
    console.log('App.tsx - Rendering SplashScreen with recipeCount:', recipeCount, 'key:', splashKey);
    return <SplashScreen key={splashKey} recipeCount={recipeCount} />;
  }

  return (
    <>
      <OfflineIndicator />
      <AppRouter />
    </>
  );
}

export default App;

