import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type Props = {
  type: 'expiry' | 'purchase';
  isOpen: boolean;
  onClose: () => void;
  onComplete: (date: string | null) => void;
  onBack?: () => void;
};

export default function IngredientDateModal({ type, isOpen, onClose, onComplete, onBack }: Props) {
  const [date, setDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // 입력 필드 변경 (type=date이므로 별도 포맷팅 불필요)

  // 달력에서 날짜 선택 시 yyyy-mm-dd로 입력창에 반영
  const handleCalendarChange = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setInputValue(`${yyyy}-${mm}-${dd}`);
    setCalendarOpen(false);
  };

  // 완료 버튼 클릭
  const handleSubmit = () => {
    // yyyy-mm-dd → yyyy.mm.dd로 변환해서 저장
    if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const formatted = inputValue.replace(/-/g, '.');
      onComplete(formatted);
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
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          <button
            onClick={onBack ? onBack : onClose}
            className="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none outline-none text-base"
            style={{ background: 'none', border: 'none' }}
            aria-label="뒤로가기"
          >
            ↩
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none outline-none text-base"
            style={{ background: 'none', border: 'none' }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="text-center text-[16px] font-bold mb-4 mt-2">재료의 상세정보를 선택해 주세요</div>
        <hr className="mb-4" />
        <div className="mb-2 text-[14px] font-semibold text-[#404040]">
          {type === 'expiry' ? '유통기한은 언제까지 인가요?' : '구매시점은 언제 인가요?'}
        </div>
        <div className="relative mb-4">
          <input
            type="text"
            className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[14px] pr-10"
            placeholder="yyyy-mm-dd"
            maxLength={10}
            value={inputValue}
            onChange={e => {
              let value = e.target.value.replace(/[^0-9]/g, '');
              if (value.length > 8) value = value.slice(0, 8);
              if (value.length === 8) {
                value = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
              }
              setInputValue(value);
            }}
          />
          {/* 달력 아이콘 버튼 */}
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
            onClick={() => setCalendarOpen(true)}
            tabIndex={-1}
            aria-label="달력 열기"
          >
            {/* 달력 SVG 아이콘 */}
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="2"/><path d="M16 3v4M8 3v4M3 9h18" strokeWidth="2"/></svg>
          </button>
          {/* 달력 팝업 */}
          {calendarOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-12 z-50 bg-white rounded-xl shadow-lg p-2">
              <DatePicker
                selected={inputValue.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(inputValue) : null}
                onChange={handleCalendarChange}
                inline
                dateFormat="yyyy-MM-dd"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="flex-1 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center"
            onClick={handleSubmit}
          >
            확인
          </button>
          {type === 'purchase' && (
            <button
              className="w-[120px] h-10 border border-gray-300 rounded-[10px] text-[12px] text-gray-600 ml-2 flex items-center justify-center"
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