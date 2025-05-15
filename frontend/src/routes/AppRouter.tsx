import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import FridgeSelect from '../pages/FridgeSelect';
import IngredientInput from '../pages/IngredientInput';
import RecipeList from '../pages/RecipeList';
import RecipeDetail from '../pages/RecipeDetail';
import Popular from '../pages/Popular';
import MyPage from '../pages/MyPage';
import MyFridge from '../pages/MyFridge';
import IngredientDetail from '../pages/IngredientDetail';

const AppRouter = () => {
  return (
    <BrowserRouter>
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
        <Route path="/mypage/recorded" element={<IngredientDetail customTitle="내가 기록한 레시피" />} />
        <Route path="/mypage/completed" element={<IngredientDetail customTitle="내가 완료한 레시피" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter; 