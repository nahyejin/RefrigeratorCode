import React, { useEffect, useState } from 'react';
import AppRouter from './routes/AppRouter';
import SplashScreen from './components/SplashScreen';
import OfflineIndicator from './components/OfflineIndicator';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    // 실제 API 연동: 전체 레시피 개수 가져오기
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    fetch(`${apiUrl}/api/recipes`)
      .then(res => res.json())
      .then(data => {
        console.log('스플래시 화면 - API 응답:', data);
        // data.total이 있으면 사용, 없으면 data.recipes의 길이 사용
        const count = data.total || (Array.isArray(data.recipes) ? data.recipes.length : 0);
        console.log('스플래시 화면 - 총 레시피 수:', count);
        setRecipeCount(count);
      })
      .catch(error => {
        console.error('스플래시 화면 - API 호출 실패:', error);
        setRecipeCount(0);
      });
    
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen recipeCount={recipeCount} />;
  }

  return (
    <>
      <OfflineIndicator />
      <AppRouter />
    </>
  );
}

export default App;
