import React from 'react';

interface ToastProps {
  message: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const Toast: React.FC<ToastProps> = ({ message, children, style }) => (
  <div
    style={{
      position: 'fixed',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(34,34,34,0.9)',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: 12,
      fontWeight: 400,
      fontSize: 15,
      zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      maxWidth: 320,
      width: 'max-content',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      ...style,
    }}
  >
    <span style={{ fontWeight: 600, color: '#fff', marginRight: 8, letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block' }}>{message}</span>
    {children}
  </div>
);

export default Toast; 