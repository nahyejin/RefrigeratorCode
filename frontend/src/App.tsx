import React, { useEffect, useState } from 'react';
import AppRouter from './routes/AppRouter';
import SplashScreen from './components/SplashScreen';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    // 실제 API 연동: 모든 레시피를 받아와서 개수 세기
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    fetch(`${apiUrl}/api/recipes`)
      .then(res => res.json())
      .then(data => setRecipeCount(Array.isArray(data) ? data.length : 0));
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen recipeCount={recipeCount} />;
  }

  return <AppRouter />;
}

export default App;
