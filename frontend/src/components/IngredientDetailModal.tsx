import React, { useState } from 'react';
import frozenIcon from '../assets/Frozen_storage.png';
import refrigeratedIcon from '../assets/Refrigerated_storage.png';
import roomIcon from '../assets/Store_at_room_temperature.png';
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
  ICON_SIZE: 64
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
  { key: 'frozen', label: '냉동보관', icon: frozenIcon },
  { key: 'fridge', label: '냉장보관', icon: refrigeratedIcon },
  { key: 'room', label: '실온보관', icon: roomIcon }
] as const;

// 소비 기한 옵션 데이터
const EXPIRATION_OPTIONS = [
  {
    key: true,
    label: '유통기한\n있어요',
    className: 'bg-[#FF9800]',
    style: STYLES.expiryButton
  },
  {
    key: false,
    label: '유통기한\n없어요·몰라요',
    className: 'bg-[#4FC3F7]',
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 1001 }} onClick={onClose}>
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-[370px] max-w-[92vw] p-8"
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: 'Pretendard, sans-serif' }}
          >
            {/* X 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none outline-none text-base"
              style={STYLES.closeButton}
              aria-label="닫기"
            >
              ×
            </button>

            {/* 타이틀 */}
            <div className="text-center text-[16px] font-bold mb-4 text-[#404040]">재료의 상세정보를 선택해 주세요</div>
            <hr className="mb-4" />

            {/* 보관 공간 */}
            <div className="mb-2 text-[13px] font-semibold text-[#404040]">보관 공간</div>
            <div className="flex justify-between items-end mb-6">
              {STORAGE_OPTIONS.map(opt => (
                <div
                  key={opt.key}
                  className={`flex flex-col items-center flex-1 cursor-pointer transition
                    ${storageType === opt.key ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                  `}
                  onClick={() => setStorageType(opt.key as 'frozen' | 'fridge' | 'room')}
                >
                  <img 
                    src={opt.icon} 
                    alt={opt.label} 
                    className="w-16 h-16 mb-2" 
                    style={{ width: CONSTANTS.ICON_SIZE, height: CONSTANTS.ICON_SIZE }}
                  />
                  <span className="text-[13px] font-medium text-[#404040]">{opt.label}</span>
                </div>
              ))}
            </div>

            {/* 소비 기한 */}
            <div className="mb-2 text-[13px] font-semibold text-[#404040]">소비 기한</div>
            <div className="flex justify-between gap-8 mt-2">
              {EXPIRATION_OPTIONS.map(option => (
                <button
                  key={String(option.key)}
                  onClick={() => handleExpirationSelect(option.key)}
                  disabled={!storageType}
                  className={`flex flex-col justify-center items-center rounded-[32px] text-white text-[12px] shadow-md transition hover:brightness-95 p-0
                    ${option.className}
                    ${!storageType ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={{
                    ...option.style,
                    width: CONSTANTS.BUTTON_WIDTH,
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