import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// =====================
// 상수
// =====================

const INPUT_PLACEHOLDER = '재료를 입력하세요';
const ADD_BUTTON_LABEL = '추가';
const SUBMIT_BUTTON_LABEL = '레시피 추천 받기';
const TITLE = '재료 입력';

// =====================
// 메인 컴포넌트
// =====================

const IngredientInput: React.FC = () => {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  // =====================
  // 이벤트 핸들러
  // =====================

  const handleAddIngredient = () => {
    const value = inputValue.trim();
    if (value && !ingredients.includes(value)) {
      setIngredients([...ingredients, value]);
      setInputValue('');
    }
  };

  const handleRemoveIngredient = (ingredient: string) => {
    setIngredients(ingredients.filter(item => item !== ingredient));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddIngredient();
  };

  const handleSubmit = () => {
    // TODO: 실제 추천 페이지로 ingredients 전달
    navigate('/recipe-list');
  };

  // =====================
  // 렌더링
  // =====================

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">{TITLE}</h1>
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex mb-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={INPUT_PLACEHOLDER}
            className="flex-1 p-2 border rounded-l"
          />
          <button
            onClick={handleAddIngredient}
            className="bg-blue-500 text-white px-4 py-2 rounded-r"
          >
            {ADD_BUTTON_LABEL}
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
                aria-label="재료 삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={handleSubmit}
        className="w-full bg-green-500 text-white py-2 px-4 rounded"
      >
        {SUBMIT_BUTTON_LABEL}
      </button>
    </div>
  );
};

export default IngredientInput; 