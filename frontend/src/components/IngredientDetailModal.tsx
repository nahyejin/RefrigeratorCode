import React, { useState } from 'react';
import CloseButton from './ui/CloseButton';
import Portal from './Portal';
// 예전엔 이모지풍 PNG(얼음/눈송이/온도계) 3장을 썼는데, 그림체가 앱의 다른 요소와
// 따로 놀아 촌스러워 보였음 → 선으로 그린 SVG 아이콘으로 교체 (색은 토큰을 따름)
const StorageIcon: React.FC<{ kind: 'frozen' | 'fridge' | 'room' }> = ({ kind }) => {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { width: 26, height: 26, flexShrink: 0, display: 'block' },
  };
  if (kind === 'frozen') {
    // 눈결정
    return (
      <svg {...common} aria-hidden>
        <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
        <path d="M12 6.6l-2 -2M12 6.6l2 -2M12 17.4l-2 2M12 17.4l2 2" />
      </svg>
    );
  }
  if (kind === 'fridge') {
    // 냉장고
    return (
      <svg {...common} aria-hidden>
        <rect x="5.5" y="2.8" width="13" height="18.4" rx="2.6" />
        <path d="M5.5 10.6h13M9 6.4v2M9 13.4v2.4" />
      </svg>
    );
  }
  // 실온 — 온도계
  return (
    <svg {...common} aria-hidden>
      <path d="M10 14.2V5.4a2 2 0 1 1 4 0v8.8a3.6 3.6 0 1 1-4 0z" />
      <path d="M12 9.4v5" />
    </svg>
  );
};
import IngredientDateModal from './IngredientDateModal';

interface IngredientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: string;
  initialStorageType?: 'frozen' | 'fridge' | 'room' | null;
  initialDate?: string | null;
  initialDateType?: 'expiry' | 'purchase' | null;
  onComplete: (data: {
    ingredient: string;
    storageType: 'frozen' | 'fridge' | 'room';
    hasExpiration: boolean;
    date: string | null;
  }) => void;
}

// 상수 정의
const CONSTANTS = {
  BUTTON_WIDTH: 200,
  BUTTON_HEIGHT: 60,
  ICON_SIZE: 52
} as const;

// 스타일 상수
const STYLES = {
  closeButton: {
    background: 'none',
    border: 'none',
    width: 24,
    height: 24,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  expiryButton: {
    boxShadow: '0 4px 16px 0 #ff980033',
    lineHeight: '1.3'
  },
  noExpiryButton: {
    boxShadow: '0 4px 16px 0 #4fc3f733',
    lineHeight: '1.3'
  }
};

// 보관 공간 옵션 데이터
const STORAGE_OPTIONS = [
  { key: 'frozen', label: '냉동보관' },
  { key: 'fridge', label: '냉장보관' },
  { key: 'room', label: '실온보관' }
] as const;

// 소비 기한 옵션 데이터
const EXPIRATION_OPTIONS = [
  {
    key: true,
    label: '유통기한\n있어요',
    className: 'expiry-yes',
    style: STYLES.expiryButton
  },
  {
    key: false,
    label: '유통기한\n없어요·몰라요',
    className: 'expiry-no',
    style: STYLES.noExpiryButton
  }
] as const;

export default function IngredientDetailModal({ 
  isOpen, 
  onClose, 
  ingredient, 
  initialStorageType = null,
  initialDate = null,
  initialDateType = null,
  onComplete 
}: IngredientDetailModalProps) {
  const [storageType, setStorageType] = useState<'frozen' | 'fridge' | 'room' | null>(null);
  const [hasExpiration, setHasExpiration] = useState<boolean | null>(null);
  const [step, setStep] = useState<'select' | 'date'>('select');
  const [dateType, setDateType] = useState<'expiry' | 'purchase'>('expiry');

  // 모달이 열릴 때 초기값 설정
  React.useEffect(() => {
    if (isOpen) {
      // 보관 공간 초기값 설정
      if (initialStorageType) {
        setStorageType(initialStorageType);
      }
      // 날짜 정보 초기값 설정 (하지만 첫 번째 화면부터 시작)
      if (initialDate) {
        // 날짜가 있으면 유통기한 또는 구매일이 있다는 의미
        setHasExpiration(initialDateType === 'expiry' ? true : false);
        setDateType(initialDateType || 'expiry');
      } else {
        // 날짜가 없으면 초기 상태 유지
        setHasExpiration(null);
      }
      // 항상 첫 번째 화면(선택 화면)부터 시작
      setStep('select');
    }
  }, [isOpen, initialStorageType, initialDate, initialDateType]);

  const handleStorageSelect = (type: 'frozen' | 'fridge' | 'room') => {
    setStorageType(type);
  };

  const handleExpirationSelect = (hasExp: boolean) => {
    setHasExpiration(hasExp);
    if (storageType) {
      setDateType(hasExp ? 'expiry' : 'purchase');
      setStep('date');
    }
  };

  const handleDateComplete = (date: string | null) => {
    if (storageType !== null && hasExpiration !== null) {
      onComplete({
        ingredient,
        storageType,
        hasExpiration,
        date,
      });
    }
    setStep('select');
    setHasExpiration(null);
    setStorageType(null);
  };

  React.useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setHasExpiration(null);
      setStorageType(null);
    }
  }, [isOpen]);

  return isOpen && (
    <>
      {step === 'select' && (
        <Portal>
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 'var(--z-modal)' }} onClick={onClose}>
          <div
            className="relative bg-white"
            style={{
              borderRadius: 20,
              // 3차에서 340px 로 줄였다가 내용(보관 3칸 + 유통기한 2칸)이 가로로 잘렸음.
              // 이 팝업은 내용이 넓어 예외적으로 조금 더 넓게 둔다.
              padding: '20px 16px 16px',
              width: 'min(360px, calc(100vw - 24px))',
              boxSizing: 'border-box',
              boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            }}
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: 'Pretendard, sans-serif' }}
          >
            <CloseButton onClick={onClose} />

            {/* 타이틀 */}
            {/* 제목이 우상단 닫기 버튼과 겹쳐 잘려 보였음 → 좌우 여백을 두고 공통 제목 규격(17px) 적용 */}
            <div
              className="mb-4"
              style={{
                textAlign: 'center',
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--ink-900)',
                padding: '0 44px',
                lineHeight: 1.35,
                wordBreak: 'keep-all',
              }}
            >
              재료의 상세정보를 선택해 주세요
            </div>
            <hr className="mb-4" />

            {/* 보관 공간 */}
            <div className="mb-2 text-[15px] font-semibold text-[#3A3A42]">보관 공간</div>
            <div className="mb-6" style={{ display: 'flex', gap: 8 }}>
              {STORAGE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStorageType(opt.key as 'frozen' | 'fridge' | 'room')}
                  aria-pressed={storageType === opt.key}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '14px 6px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    // 선택 상태를 파란 ring 대신 브랜드 톤으로 (앱 전체와 통일)
                    background: storageType === opt.key ? 'var(--brand-soft)' : 'var(--surface)',
                    border: `1px solid ${storageType === opt.key ? 'var(--brand-strong)' : 'var(--line-200)'}`,
                    color: storageType === opt.key ? 'var(--brand-on-soft)' : 'var(--ink-500)',
                    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  <StorageIcon kind={opt.key as 'frozen' | 'fridge' | 'room'} />
                  <span style={{ fontSize: 14, fontWeight: storageType === opt.key ? 700 : 500 }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            {/* 소비 기한 */}
            <div className="mb-2 text-[15px] font-semibold text-[#3A3A42]">소비 기한</div>
            <div className="flex mt-2" style={{ gap: 10 }}>
              {EXPIRATION_OPTIONS.map(option => (
                <button
                  key={String(option.key)}
                  onClick={() => handleExpirationSelect(option.key)}
                  disabled={!storageType}
                  className={`flex flex-col justify-center items-center rounded-[32px] text-white text-[13px] shadow-md transition hover:brightness-95 p-0
                    ${option.className}
                    ${!storageType ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={{
                    ...option.style,
                    flex: 1,
                    minWidth: 0,
                    height: CONSTANTS.BUTTON_HEIGHT
                  }}
                >
                  {option.label.split('\n').map((line, index) => (
                    <React.Fragment key={index}>
                      {line}
                      {index < option.label.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </button>
              ))}
            </div>
          </div>
        </div>
    </Portal>
      )}
      {step === 'date' && (
        <IngredientDateModal
          type={dateType}
          isOpen={true}
          onClose={onClose}
          onComplete={handleDateComplete}
          onBack={() => setStep('select')}
          initialDate={initialDate}
        />
      )}
    </>
  );
} 