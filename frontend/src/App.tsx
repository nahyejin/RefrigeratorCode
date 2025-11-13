import React, { useEffect, useState } from 'react';
import AppRouter from './routes/AppRouter';
import SplashScreen from './components/SplashScreen';
import OfflineIndicator from './components/OfflineIndicator';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [recipeCount, setRecipeCount] = useState(0);
  const [splashKey, setSplashKey] = useState(0);
  
  // 스플래시 화면을 강제로 표시하기 위한 디버깅
  console.log('App component rendered, showSplash:', showSplash);

  useEffect(() => {
    // 실제 API 연동: 전체 레시피 개수 가져오기
    const apiUrl = import.meta.env?.VITE_API_BASE_URL || 'https://refrigeratorcode-production.up.railway.app';
    fetch(`${apiUrl}/api/recipes`)
      .then(res => res.json())
      .then(data => {
        console.log('스플래시 화면 - API 응답:', data);
        // data.total이 있으면 사용, 없으면 data.recipes의 길이 사용
        const count = data.total || (Array.isArray(data.recipes) ? data.recipes.length : 0);
        console.log('스플래시 화면 - 총 레시피 수:', count);
        setRecipeCount(count);
        setSplashKey(prev => prev + 1);
      })
      .catch(error => {
        console.error('스플래시 화면 - API 호출 실패:', error);
        setRecipeCount(0);
      });
    
    // 스플래시 화면을 5초 동안 표시
    const timer = setTimeout(() => {
      console.log('스플래시 화면 종료');
      setShowSplash(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

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
