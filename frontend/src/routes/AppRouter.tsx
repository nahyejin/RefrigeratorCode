import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import FridgeSelect from '../pages/FridgeSelect';
import IngredientInput from '../pages/IngredientInput';
import RecipeList from '../pages/RecipeList';
import RecipeDetail from '../pages/RecipeDetail';
import Popular from '../pages/Popular';
import MyPage from '../pages/MyPage';
import MyFridge from '../pages/MyFridge';
import IngredientDetail from '../pages/IngredientDetail';
import RecordedRecipeListPage from '../pages/RecordedRecipeListPage';
import CompletedRecipeListPage from '../pages/CompletedRecipeListPage';
import RecordedRecipeDetailPage from '../pages/RecordedRecipeDetailPage';
import CompletedRecipeDetailPage from '../pages/CompletedRecipeDetailPage';

const AppRouter = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/my-fridge" element={<MyFridge />} />
        <Route path="/fridge-select" element={<FridgeSelect />} />
        <Route path="/ingredient-input" element={<IngredientInput />} />
        <Route path="/recipe-list" element={<RecipeList />} />
        <Route path="/recipe-detail/:id" element={<RecipeDetail />} />
        <Route path="/popular" element={<Popular />} />
        <Route path="/my-page" element={<MyPage />} />
        <Route path="/ingredient/:name" element={<IngredientDetail />} />
        <Route path="/mypage/recorded" element={<RecordedRecipeListPage />} />
        <Route path="/mypage/completed" element={<CompletedRecipeListPage />} />
        <Route path="/mypage/recorded/:id" element={<RecordedRecipeDetailPage />} />
        <Route path="/mypage/completed/:id" element={<CompletedRecipeDetailPage />} />
      </Routes>
    </Router>
  );
};

export default AppRouter; 