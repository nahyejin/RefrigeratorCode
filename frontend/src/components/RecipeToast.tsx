import React from 'react';
import Toast from './Toast';

interface RecipeToastProps {
  message: string;
}

/**
 * 레시피 동작 안내용 토스트.
 * 예전엔 Toast.tsx 와 거의 같은 스타일 정의를 각자 들고 있었음 → Toast 로 위임한다.
 *
 * 여기서 쓰는 문구("레시피를 즐겨찾기에 추가했습니다!" 등)는 전부 줄바꿈 없는 한 문장인데,
 * multiline(줄바꿈 허용) + maxWidth 260px 조합 때문에 짧은 문장도 폭에 걸려 줄바꿈돼
 * 두 줄로 쪼개져 보였다. 여기선 줄바꿈 없이 한 줄로 고정한다.
 */
const RecipeToast: React.FC<RecipeToastProps> = ({ message }) => (
  <Toast message={message} style={{ maxWidth: 320 }} />
);

export default RecipeToast;
