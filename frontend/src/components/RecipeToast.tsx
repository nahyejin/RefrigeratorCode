import React from 'react';

interface RecipeToastProps {
  message: string;
}

const RecipeToast: React.FC<RecipeToastProps> = ({ message }) => (
  <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 bg-[rgba(34,34,34,0.9)] text-white py-3 px-6 rounded-xl font-normal text-[15px] z-[9999] shadow-lg max-w-[260px] w-max whitespace-nowrap overflow-hidden text-ellipsis text-center">
    {message}
  </div>
);

export default RecipeToast; 