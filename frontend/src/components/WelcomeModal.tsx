import React from 'react';
import { useNavigate } from 'react-router-dom';

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  visible,
  onClose
}) => {
  const navigate = useNavigate();

  if (!visible) return null;

  return (
    <div 
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]"
      style={{ 
        maxWidth: 'calc(100% - 32px)', 
        width: 'max-content',
        minWidth: '280px'
      }}
    >
      <div 
        className="rounded-lg px-5 py-4 shadow-lg"
        style={{ 
          background: '#ffffff',
          fontSize: '13px',
          fontWeight: 400,
          lineHeight: '1.5',
          textAlign: 'center',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          border: '1px solid #e5e7eb',
          color: '#222'
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <div>기본 재료를 미리 준비해뒀어요.</div>
            <div>추가·삭제로 내냉장고를 관리해보세요.</div>
            <div>로그인하면 안전하게 보관돼요.</div>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              style={{ outline: 'none', border: 'none', cursor: 'pointer' }}
            >
              닫기
            </button>
            <button
              onClick={() => {
                // 로그인 후 가이드를 표시하기 위한 플래그 저장
                const guideShown = localStorage.getItem('myfridge_guide_shown');
                if (!guideShown) {
                  localStorage.setItem('show_guide_after_login', 'true');
                }
                onClose();
                navigate('/login');
              }}
              className="px-4 py-1.5 bg-[#FFD600] text-[#222] rounded-lg text-sm font-medium hover:bg-[#FFE033] transition"
              style={{ outline: 'none', border: 'none', cursor: 'pointer' }}
            >
              로그인하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;

