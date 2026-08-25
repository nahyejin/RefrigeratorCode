import React from 'react';
import { useNavigate } from 'react-router-dom';

interface RegisterPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  message: string;
  /** 두 번째 줄. `null`이면 두 번째 줄 없음(첫 줄만). 미전달 시 기본: 회원가입이 필요해요 */
  subMessage?: string | null;
  dismissLabel?: string;
  confirmLabel?: string;
}

const RegisterPromptModal: React.FC<RegisterPromptModalProps> = ({
  visible,
  onClose,
  onConfirm,
  message,
  subMessage,
  dismissLabel = '나중에',
  confirmLabel = '회원가입하기',
}) => {
  const navigate = useNavigate();

  if (!visible) return null;

  const showSecondLine = subMessage !== null;
  const secondLineText = subMessage === undefined || subMessage === '' ? '회원가입이 필요해요' : subMessage;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-[320px] max-w-[95vw] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-sm text-gray-600" style={{ lineHeight: '1.4' }}>
            <div>{message}</div>
            {showSecondLine && (
              <div style={{ marginTop: '2px' }}>{secondLineText}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
            style={{ outline: 'none' }}
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              }
              onClose();
              navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
            }}
            className="flex-1 h-10 bg-[#FFD600] text-[#1A1A1E] rounded-lg text-sm font-semibold hover:bg-yellow-300"
            style={{ outline: 'none', border: 'none' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPromptModal;
