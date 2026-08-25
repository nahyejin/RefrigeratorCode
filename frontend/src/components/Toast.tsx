import React from 'react';

interface ToastProps {
  message: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 100,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(34,34,34,0.9)',
  color: '#FFFFFF',
  padding: '12px 24px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 400,
  zIndex: 9999,
  maxWidth: 320,
  width: 'max-content',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const MESSAGE_STYLE: React.CSSProperties = {
  color: '#FFFFFF',
  marginRight: 8,
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  display: 'inline-block',
  fontWeight: 400,
};

const Toast: React.FC<ToastProps> = ({ message, children, style }) => (
  <div style={{ ...BASE_STYLE, ...style }}>
    <span style={MESSAGE_STYLE}>{message}</span>
    {children}
  </div>
);

export default Toast; 