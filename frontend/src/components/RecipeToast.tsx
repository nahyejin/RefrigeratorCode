import React from 'react';

interface RecipeToastProps {
  message: string;
}

const RecipeToast: React.FC<RecipeToastProps> = ({ message }) => {
  return (
    <div
      className="fixed bottom-[100px] left-1/2 -translate-x-1/2 bg-[rgba(34,34,34,0.9)] text-white py-3 px-6 rounded-xl font-normal z-[9999] shadow-lg max-w-[260px] w-max text-center"
      style={{
        fontSize: 13,
        whiteSpace: 'pre-line', // 줄바꿈 허용
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        wordBreak: 'keep-all',
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
};

export default RecipeToast; 