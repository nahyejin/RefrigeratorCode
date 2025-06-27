import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import backIcon from '../assets/뒤로가기_GREY.png';

type Props = {
  type: 'expiry' | 'purchase';
  isOpen: boolean;
  onClose: () => void;
  onComplete: (date: string | null) => void;
  onBack?: () => void;
};

// 상수 정의
const CONSTANTS = {
  INPUT_MAX_LENGTH: 10,
  DATE_DIGIT_LENGTH: 8,
  BUTTON_SIZE: 24,
  ICON_SIZE: 13,
  CALENDAR_ICON_SIZE: 20
} as const;

// 스타일 상수
const STYLES = {
  button: {
    background: 'none',
    border: 'none',
    padding: 0,
    width: CONSTANTS.BUTTON_SIZE,
    height: CONSTANTS.BUTTON_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    width: CONSTANTS.ICON_SIZE,
    height: CONSTANTS.ICON_SIZE,
    objectFit: 'contain' as const,
    display: 'block'
  },
  calendarIcon: {
    width: CONSTANTS.CALENDAR_ICON_SIZE,
    height: CONSTANTS.CALENDAR_ICON_SIZE
  }
};

// 유틸리티 함수들
const Utils = {
  // 날짜를 yyyy-mm-dd 형식으로 포맷팅
  formatDateToInput: (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  // 입력값을 yyyy-mm-dd 형식으로 변환
  formatInputValue: (value: string): string => {
    // 숫자만 추출
    const digits = value.replace(/[^0-9]/g, '');
    
    // 8자리로 제한
    if (digits.length > CONSTANTS.DATE_DIGIT_LENGTH) {
      return digits.slice(0, CONSTANTS.DATE_DIGIT_LENGTH);
    }
    
    // 8자리인 경우 yyyy-mm-dd 형식으로 변환
    if (digits.length === CONSTANTS.DATE_DIGIT_LENGTH) {
      return digits.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    }
    
    return digits;
  },

  // yyyy-mm-dd를 yyyy.mm.dd로 변환
  formatDateForStorage: (dateString: string): string => {
    return dateString.replace(/-/g, '.');
  },

  // 날짜 문자열이 유효한지 검증
  isValidDateString: (dateString: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  }
};

// 텍스트 상수
const TEXTS = {
  title: '재료의 상세정보를 선택해 주세요',
  expiryQuestion: '유통기한은 언제까지 인가요?',
  purchaseQuestion: '구매시점은 언제 인가요?',
  placeholder: 'yyyy-mm-dd',
  confirm: '확인',
  unknown: '잘 모르겠어요'
} as const;

export default function IngredientDateModal({ type, isOpen, onClose, onComplete, onBack }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // 달력에서 날짜 선택 시 yyyy-mm-dd로 입력창에 반영
  const handleCalendarChange = (date: Date | null) => {
    if (!date) return;
    setInputValue(Utils.formatDateToInput(date));
    setCalendarOpen(false);
  };

  // 완료 버튼 클릭
  const handleSubmit = () => {
    if (Utils.isValidDateString(inputValue)) {
      const formatted = Utils.formatDateForStorage(inputValue);
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
        <div className="absolute top-1 left-1 flex gap-1 z-10">
          <button
            onClick={onBack ? onBack : onClose}
            className="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none outline-none text-base"
            style={STYLES.button}
            aria-label="뒤로가기"
          >
            <img src={backIcon} alt="뒤로가기" style={STYLES.backIcon} />
          </button>
        </div>
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none outline-none text-base"
            style={STYLES.button}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="text-center text-[16px] font-bold mb-4 mt-2">{TEXTS.title}</div>
        <hr className="mb-4" />
        <div className="mb-2 text-[14px] font-semibold text-[#404040]">
          {type === 'expiry' ? TEXTS.expiryQuestion : TEXTS.purchaseQuestion}
        </div>
        <div className="relative mb-4">
          <input
            type="text"
            className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[14px] pr-10"
            placeholder={TEXTS.placeholder}
            maxLength={CONSTANTS.INPUT_MAX_LENGTH}
            value={inputValue}
            onChange={e => setInputValue(Utils.formatInputValue(e.target.value))}
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
            <svg 
              style={STYLES.calendarIcon} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="2"/>
              <path d="M16 3v4M8 3v4M3 9h18" strokeWidth="2"/>
            </svg>
          </button>
          {/* 달력 팝업 */}
          {calendarOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-12 z-50 bg-white rounded-xl shadow-lg p-2">
              {/* @ts-expect-error DatePicker type issue with React 18/19 */}
              <DatePicker
                selected={Utils.isValidDateString(inputValue) ? new Date(inputValue) : null}
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
            {TEXTS.confirm}
          </button>
          {type === 'purchase' && (
            <button
              className="w-[120px] h-10 border border-gray-300 rounded-[10px] text-[12px] text-gray-600 ml-2 flex items-center justify-center"
              onClick={handleUnknown}
            >
              {TEXTS.unknown}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 