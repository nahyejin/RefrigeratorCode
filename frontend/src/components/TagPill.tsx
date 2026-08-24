import React from 'react';

interface TagPillProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const BASE_STYLE: React.CSSProperties = {
  fontFamily: 'Noto Sans KR, Arial, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: 400,
  color: '#3A3A3A',
  background: '#EFEFF2',
  border: '1px solid #E3E3E7',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  height: 28,
  marginRight: 8,
  marginBottom: 4,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  letterSpacing: '-0.1px',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility',
  textShadow: 'none',
};

const TagPill: React.FC<TagPillProps> = ({ children, onClick, className = '', style }) => (
  <span
    className={`custom-pill ${className}`}
    style={{ ...BASE_STYLE, ...style }}
    onClick={onClick}
  >
    {children}
  </span>
);

export default TagPill; 