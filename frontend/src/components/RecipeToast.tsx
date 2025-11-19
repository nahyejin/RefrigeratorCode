import React from 'react';

interface RecipeToastProps {
  message: string;
}

const BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 100,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(34,34,34,0.9)',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 400,
  zIndex: 9999,
  maxWidth: 260,
  width: 'max-content',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
};

const RecipeToast: React.FC<RecipeToastProps> = ({ message }) => (
  <div style={BASE_STYLE}>
    {message}
  </div>
);

export default RecipeToast; 