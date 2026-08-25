import React from 'react';
import Portal from './Portal';

interface ToastProps {
  message: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  /** 여러 줄 메시지를 그대로 보여줄지 (기본: 한 줄, 넘치면 말줄임) */
  multiline?: boolean;
}

const BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 100,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(26,26,30,0.92)',
  color: '#FFFFFF',
  padding: '12px 24px',
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 400,
  zIndex: 'var(--z-toast)',
  maxWidth: 320,
  width: 'max-content',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
};

const SINGLE_LINE: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const MULTI_LINE: React.CSSProperties = {
  whiteSpace: 'pre-line',
  lineHeight: 1.5,
};

/**
 * 화면 하단 토스트.
 * Portal로 body 직속 렌더 — sticky/transform 조상 안에서 호출돼도 층위에 갇히지 않는다.
 */
const Toast: React.FC<ToastProps> = ({ message, children, style, multiline }) => (
  <Portal>
    <div style={{ ...BASE_STYLE, ...(multiline ? MULTI_LINE : SINGLE_LINE), ...style }}>
      <span
        style={{
          color: '#FFFFFF',
          letterSpacing: '0.04em',
          fontWeight: 400,
          ...(multiline ? MULTI_LINE : SINGLE_LINE),
        }}
      >
        {message}
      </span>
      {children}
    </div>
  </Portal>
);

export default Toast;
