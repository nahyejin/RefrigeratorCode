import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type Props = {
  type: 'expiry' | 'purchase';
  isOpen: boolean;
  onClose: () => void;
  onComplete: (date: string | null) => void;
};

export default function IngredientDateModal({ type, isOpen, onClose, onComplete }: Props) {
  const [date, setDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // yyyy.mm.dd 포맷 변환
  const formatDate = (d: Date | null) =>
    d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` : '';

  // 입력 필드 변경
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setDate(null);
  };

  // 달력에서 날짜 선택
  const handleDateChange = (d: Date) => {
    setDate(d);
    setInputValue(formatDate(d));
    setShowCalendar(false);
  };

  // 완료 버튼 클릭
  const handleSubmit = () => {
    if (inputValue.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
      onComplete(inputValue);
    }
  };

  // 잘 모르겠어요
  const handleUnknown = () => onComplete(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl shadow-2xl w-[320px] p-6"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'Pretendard, sans-serif' }}
      >
        <button className="absolute top-4 right-4 text-xl" onClick={onClose}>×</button>
        <div className="text-center text-[16px] font-bold mb-4">재료의 상세정보를 선택해 주세요</div>
        <hr className="mb-4" />
        <div className="mb-2 text-[14px] font-semibold text-[#404040]">
          {type === 'expiry' ? '유통기한은 언제까지 인가요?' : '구매시점은 언제 인가요?'}
        </div>
        <input
          className="w-[280px] h-10 border border-gray-300 rounded-lg px-4 text-[14px] mb-4"
          placeholder="yyyy.mm.dd"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowCalendar(true)}
          readOnly={false}
        />
        {showCalendar && (
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-50">
            <DatePicker
              selected={date}
              onChange={handleDateChange}
              inline
              dateFormat="yyyy.MM.dd"
            />
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button
            className="flex-1 h-10 bg-blue-500 text-white rounded-lg"
            onClick={handleSubmit}
          >
            확인
          </button>
          {type === 'purchase' && (
            <button
              className="w-[120px] h-[30px] border border-gray-300 rounded-[10px] text-[12px] text-gray-600 ml-2"
              onClick={handleUnknown}
            >
              잘 모르겠어요
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 