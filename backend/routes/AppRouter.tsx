import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import FridgeSelect from '../pages/FridgeSelect';
import IngredientInput from '../pages/IngredientInput';
import RecipeList from '../pages/RecipeList';
import RecipeDetail from '../pages/RecipeDetail';
import Popular from '../pages/Popular';
import MyPage from '../pages/MyPage';

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/fridge" element={<FridgeSelect />} />
      <Route path="/ingredients" element={<IngredientInput />} />
      <Route path="/recipes" element={<RecipeList />} />
      <Route path="/recipes/:id" element={<RecipeDetail />} />
      <Route path="/popular" element={<Popular />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="*" element={<Login />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter; 