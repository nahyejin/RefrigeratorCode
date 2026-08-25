import React from 'react';
import Toast from './Toast';

interface RecipeToastProps {
  message: string;
}

/**
 * 레시피 동작 안내용 토스트.
 * 예전엔 Toast.tsx 와 거의 같은 스타일 정의를 각자 들고 있었음 → Toast 로 위임한다.
 * (여러 줄 메시지를 그대로 보여줘야 해서 multiline 만 다름)
 */
const RecipeToast: React.FC<RecipeToastProps> = ({ message }) => (
  <Toast message={message} multiline style={{ maxWidth: 260 }} />
);

export default RecipeToast;
