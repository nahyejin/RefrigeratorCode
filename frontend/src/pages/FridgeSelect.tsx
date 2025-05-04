import React from 'react';
import { useNavigate } from 'react-router-dom';

const FridgeSelect = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">냉장고 선택</h1>
      <div className="space-y-4">
        <div 
          className="bg-white p-4 rounded-lg shadow cursor-pointer"
          onClick={() => navigate('/ingredient-input')}
        >
          <h2 className="text-xl font-semibold">냉장실</h2>
          <p className="text-gray-600">신선한 식재료를 보관하는 공간</p>
        </div>
        <div 
          className="bg-white p-4 rounded-lg shadow cursor-pointer"
          onClick={() => navigate('/ingredient-input')}
        >
          <h2 className="text-xl font-semibold">냉동실</h2>
          <p className="text-gray-600">오래 보관하는 식재료를 보관하는 공간</p>
        </div>
        <div 
          className="bg-white p-4 rounded-lg shadow cursor-pointer"
          onClick={() => navigate('/ingredient-input')}
        >
          <h2 className="text-xl font-semibold">실온</h2>
          <p className="text-gray-600">상온에서 보관하는 식재료를 보관하는 공간</p>
        </div>
      </div>
    </div>
  );
};

export default FridgeSelect; 