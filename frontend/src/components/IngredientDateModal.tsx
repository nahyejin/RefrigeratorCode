import React, { useState, useRef, useEffect } from 'react';
import CloseButton from './ui/CloseButton';
import backIcon from '../assets/뒤로가기_GREY.png';
import CustomCalendar from './CustomCalendar';

type Props = {
  type: 'expiry' | 'purchase';
  isOpen: boolean;
  onClose: () => void;
  onComplete: (date: string | null) => void;
  onBack?: () => void;
  initialDate?: string | null;
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
  },

};

// 텍스트 상수
const TEXTS = {
  title: '재료의 상세정보를 선택해 주세요',
  expiryQuestion: '유통기한은 언제까지 인가요?',
  purchaseQuestion: '구매시점은 언제 인가요?',
  placeholder: 'yyyy-mm-dd',
  confirm: '확인',
  unknown: '잘 모르겠어요',
  cancel: '취소',
  select: '선택'
} as const;


export default function IngredientDateModal({ type, isOpen, onClose, onComplete, onBack, initialDate = null }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const calendarRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 모달이 열릴 때 초기 날짜 설정
  useEffect(() => {
    if (isOpen && initialDate) {
      // initialDate가 yyyy.mm.dd 형식이면 yyyy-mm-dd로 변환
      const formattedDate = initialDate.replace(/\./g, '-');
      if (Utils.isValidDateString(formattedDate)) {
        setInputValue(formattedDate);
        const date = new Date(formattedDate);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
        }
      }
    } else if (isOpen && !initialDate) {
      // 초기 날짜가 없으면 초기화
      setInputValue('');
      setSelectedDate(null);
    }
  }, [isOpen, initialDate]);

  // 달력 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarOpen]);

  // 입력값이 변경되면 selectedDate 업데이트
  useEffect(() => {
    if (Utils.isValidDateString(inputValue)) {
      const date = new Date(inputValue);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    } else {
      setSelectedDate(null);
    }
  }, [inputValue]);

  // 달력에서 날짜 선택 시 yyyy-mm-dd로 입력창에 반영
  const handleCalendarDateSelect = (date: Date) => {
    setInputValue(Utils.formatDateToInput(date));
    setSelectedDate(date);
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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 'var(--z-modal)' }} onClick={onClose}>
      <div
        className="relative bg-white"
        style={{ borderRadius: 20, padding: '24px 20px 20px', width: 'min(340px, calc(100vw - 40px))', boxShadow: '0 16px 48px rgba(0,0,0,0.22)' }}
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
        <CloseButton onClick={onClose} />
        <div className="text-center font-bold text-[15px] mb-4">일자를 선택하세요</div>
        <hr className="mb-4" />
        <div className="mb-2 text-[15px] font-semibold text-[#3A3A42]">
          {type === 'expiry' ? TEXTS.expiryQuestion : TEXTS.purchaseQuestion}
        </div>
        <div className="relative mb-4">
          <input
            type="text"
            className="w-full h-10 border border-gray-300 rounded-lg px-4 text-[15px] pr-10"
            placeholder={TEXTS.placeholder}
            maxLength={CONSTANTS.INPUT_MAX_LENGTH}
            value={inputValue}
            onChange={e => setInputValue(Utils.formatInputValue(e.target.value))}
          />
          {/* 달력 아이콘 버튼 */}
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none outline-none"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
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
          {/* 커스텀 달력 팝업 */}
          {calendarOpen && (
            <>
              <div 
                className="fixed inset-0 bg-black bg-opacity-40"
                style={{ zIndex: 'calc(var(--z-modal) + 1)' }}
                onClick={() => setCalendarOpen(false)}
              />
              <div 
                ref={calendarRef}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ zIndex: 'calc(var(--z-modal) + 2)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <CustomCalendar
                  selectedDate={selectedDate}
                  onDateSelect={handleCalendarDateSelect}
                  onClose={() => setCalendarOpen(false)}
                  type={type}
                />
              </div>
            </>
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
              className="w-[120px] h-10 bg-white border border-gray-300 rounded-[10px] text-[13px] text-gray-600 ml-2 flex items-center justify-center"
              style={{ backgroundColor: '#ffffff', borderColor: '#D2D2D8' }}
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