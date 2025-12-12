import React from 'react';
import { useNavigate } from 'react-router-dom';

interface RegisterPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  message: string;
  subMessage?: string;
}

const RegisterPromptModal: React.FC<RegisterPromptModalProps> = ({
  visible,
  onClose,
  onConfirm,
  message,
  subMessage
}) => {
  const navigate = useNavigate();

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" 
      style={{ zIndex: 1001 }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-lg w-[320px] max-w-[95vw] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-sm text-gray-600" style={{ lineHeight: '1.4' }}>
            <div>{message}</div>
            <div style={{ marginTop: '2px' }}>
              {subMessage || '회원가입이 필요해요'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
            style={{ outline: 'none' }}
          >
            나중에
          </button>
          <button
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              }
              onClose();
              navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
            }}
            className="flex-1 h-10 bg-[#FFD600] text-[#222] rounded-lg text-sm font-semibold hover:bg-yellow-300"
            style={{ outline: 'none', border: 'none' }}
          >
            회원가입하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPromptModal;

