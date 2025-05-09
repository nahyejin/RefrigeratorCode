import React, { useState } from 'react';
import frozenIcon from '../assets/Frozen_storage.png';
import refrigeratedIcon from '../assets/Refrigerated_storage.png';
import roomIcon from '../assets/Store_at_room_temperature.png';
import IngredientDateModal from './IngredientDateModal';

interface IngredientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: string;
  onComplete: (data: {
    ingredient: string;
    storageType: 'frozen' | 'fridge' | 'room';
    hasExpiration: boolean;
    date: string | null;
  }) => void;
}

export default function IngredientDetailModal({ isOpen, onClose, ingredient, onComplete }: IngredientDetailModalProps) {
  const [storageType, setStorageType] = useState<'frozen' | 'fridge' | 'room' | null>(null);
  const [hasExpiration, setHasExpiration] = useState<boolean | null>(null);
  const [step, setStep] = useState<'select' | 'date'>('select');
  const [dateType, setDateType] = useState<'expiry' | 'purchase'>('expiry');

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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={onClose}>
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-[370px] max-w-[92vw] p-8"
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: 'Pretendard, sans-serif' }}
          >
            {/* X 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-[#404040] text-2xl font-bold"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
            >×</button>

            {/* 타이틀 */}
            <div className="text-center text-[16px] font-bold mb-4 text-[#404040]">재료의 상세정보를 선택해 주세요</div>
            <hr className="mb-4" />

            {/* 보관 공간 */}
            <div className="mb-2 text-[13px] font-semibold text-[#404040]">보관 공간</div>
            <div className="flex justify-between items-end mb-6">
              {[{ key: 'frozen', label: '냉동보관', icon: frozenIcon },
                { key: 'fridge', label: '냉장보관', icon: refrigeratedIcon },
                { key: 'room', label: '실온보관', icon: roomIcon }].map(opt => (
                <div
                  key={opt.key}
                  className={`flex flex-col items-center flex-1 cursor-pointer transition
                    ${storageType === opt.key ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                  `}
                  onClick={() => setStorageType(opt.key as 'frozen' | 'fridge' | 'room')}
                >
                  <img src={opt.icon} alt={opt.label} className="w-16 h-16 mb-2" />
                  <span className="text-[13px] font-medium text-[#404040]">{opt.label}</span>
                </div>
              ))}
            </div>

            {/* 소비 기한 */}
            <div className="mb-2 text-[13px] font-semibold text-[#404040]">소비 기한</div>
            <div className="flex justify-between gap-8 mt-2">
              <button
                onClick={() => handleExpirationSelect(true)}
                disabled={!storageType}
                className={`flex flex-col justify-center items-center w-[200px] h-[60px] rounded-[32px] bg-[#FF9800] text-white text-[12px] shadow-md transition hover:brightness-95 p-0
                  ${!storageType ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                style={{ boxShadow: '0 4px 16px 0 #ff980033', lineHeight: '1.3' }}
              >
                유통기한<br />있어요
              </button>
              <button
                onClick={() => handleExpirationSelect(false)}
                disabled={!storageType}
                className={`flex flex-col justify-center items-center w-[200px] h-[60px] rounded-[32px] bg-[#4FC3F7] text-white text-[12px] shadow-md transition hover:brightness-95 p-0
                  ${!storageType ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                style={{ boxShadow: '0 4px 16px 0 #4fc3f733', lineHeight: '1.3' }}
              >
                유통기한<br />없어요·몰라요
              </button>
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
        />
      )}
    </>
  );
} 