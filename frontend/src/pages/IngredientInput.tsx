import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const IngredientInput = () => {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  const handleAddIngredient = () => {
    if (inputValue.trim() && !ingredients.includes(inputValue.trim())) {
      setIngredients([...ingredients, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemoveIngredient = (ingredient: string) => {
    setIngredients(ingredients.filter(item => item !== ingredient));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">재료 입력</h1>
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="재료를 입력하세요"
            className="flex-1 p-2 border rounded-l"
          />
          <button
            onClick={handleAddIngredient}
            className="bg-blue-500 text-white px-4 py-2 rounded-r"
          >
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ingredients.map((ingredient, index) => (
            <div
              key={index}
              className="bg-gray-200 px-3 py-1 rounded-full flex items-center"
            >
              <span>{ingredient}</span>
              <button
                onClick={() => handleRemoveIngredient(ingredient)}
                className="ml-2 text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={() => navigate('/recipe-list')}
        className="w-full bg-green-500 text-white py-2 px-4 rounded"
      >
        레시피 추천 받기
      </button>
    </div>
  );
};

export default IngredientInput; 