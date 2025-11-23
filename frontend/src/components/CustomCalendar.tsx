import React, { useState, useRef, useEffect } from 'react';

type CustomCalendarProps = {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
  type?: 'expiry' | 'purchase' | 'range-start' | 'range-end';
  minDate?: Date;
  maxDate?: Date;
};

// 유틸리티 함수들
const Utils = {
  // 날짜가 유효한 범위인지 검증
  isValidDateRange: (date: Date, type?: 'expiry' | 'purchase' | 'range-start' | 'range-end', minDate?: Date, maxDate?: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (minDate) {
      const min = new Date(minDate);
      min.setHours(0, 0, 0, 0);
      if (checkDate < min) return false;
    }
    
    if (maxDate) {
      const max = new Date(maxDate);
      max.setHours(0, 0, 0, 0);
      if (checkDate > max) return false;
    }
    
    if (type === 'purchase') {
      return checkDate <= today;
    } else if (type === 'expiry') {
      // 유통기한은 과거+미래 모두 허용
      return true;
    } else if (type === 'range-start' || type === 'range-end') {
      // 기간 선택은 과거만 허용
      return checkDate <= today;
    }
    
    return true;
  }
};

const CustomCalendar: React.FC<CustomCalendarProps> = ({ 
  selectedDate, 
  onDateSelect, 
  onClose, 
  type,
  minDate,
  maxDate
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    selectedDate 
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) 
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateState, setSelectedDateState] = useState<Date | null>(selectedDate);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // 년도 목록 생성 (1900년부터 현재+10년까지)
  const years = Array.from({ length: today.getFullYear() + 10 - 1899 }, (_, i) => 1900 + i);
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 달력 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setShowYearDropdown(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setShowMonthDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 달력 날짜 배열 생성
  const getCalendarDays = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 주의 첫 번째 날 (일요일)

    const days: (Date | null)[] = [];
    const currentDate = new Date(startDate);

    // 6주 * 7일 = 42일
    for (let i = 0; i < 42; i++) {
      if (currentDate.getMonth() === month) {
        days.push(new Date(currentDate));
      } else {
        days.push(null);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleYearSelect = (selectedYear: number) => {
    setCurrentMonth(new Date(selectedYear, month, 1));
    setShowYearDropdown(false);
  };

  const handleMonthSelect = (selectedMonth: number) => {
    setCurrentMonth(new Date(year, selectedMonth, 1));
    setShowMonthDropdown(false);
  };

  const handleDateClick = (date: Date) => {
    if (Utils.isValidDateRange(date, type, minDate, maxDate)) {
      setSelectedDateState(date);
    }
  };

  const handleSelect = () => {
    if (selectedDateState) {
      onDateSelect(selectedDateState);
    }
  };

  const calendarDays = getCalendarDays();
  const isToday = (date: Date | null) => {
    if (!date) return false;
    const todayCheck = new Date();
    return date.toDateString() === todayCheck.toDateString();
  };

  const isSelected = (date: Date | null) => {
    if (!date || !selectedDateState) return false;
    return date.toDateString() === selectedDateState.toDateString();
  };

  const isDisabled = (date: Date | null) => {
    if (!date) return true;
    return !Utils.isValidDateRange(date, type, minDate, maxDate);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 w-[320px] custom-calendar-container">
      {/* 상단: < > 버튼과 년도/월 드롭다운 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded"
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          <div className="relative" ref={yearDropdownRef}>
            <button
              onClick={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowMonthDropdown(false);
              }}
              className="px-3 py-1 hover:bg-gray-100 rounded text-[14px] font-medium whitespace-nowrap min-w-[70px] flex items-center gap-1"
            >
              <span>{year}년</span>
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={showYearDropdown ? 'rotate-180' : ''}
                style={{ transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showYearDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearSelect(y)}
                    className={`w-full px-4 py-2 text-left text-[14px] hover:bg-gray-100 ${
                      y === year ? 'bg-blue-50 text-blue-600' : ''
                    }`}
                  >
                    {y}년
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="relative" ref={monthDropdownRef}>
            <button
              onClick={() => {
                setShowMonthDropdown(!showMonthDropdown);
                setShowYearDropdown(false);
              }}
              className="px-3 py-1 hover:bg-gray-100 rounded text-[14px] font-medium whitespace-nowrap min-w-[60px] flex items-center gap-1"
            >
              <span>{month + 1}월</span>
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={showMonthDropdown ? 'rotate-180' : ''}
                style={{ transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showMonthDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {months.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleMonthSelect(idx)}
                    className={`w-full px-4 py-2 text-left text-[14px] hover:bg-gray-100 ${
                      idx === month ? 'bg-blue-50 text-blue-600' : ''
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded"
          aria-label="다음 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-[12px] font-medium text-gray-600 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {calendarDays.map((date, idx) => {
          if (!date) {
            return <div key={idx} className="aspect-square" />;
          }

          const disabled = isDisabled(date);
          const selected = isSelected(date);
          const today = isToday(date);

          let buttonStyle: React.CSSProperties = {};
          let buttonClassName = 'aspect-square rounded-lg text-[14px] font-medium ';
          
          if (disabled) {
            buttonClassName += 'text-gray-300 cursor-not-allowed';
            buttonStyle.color = '#D1D5DB'; // gray-300
          } else if (selected) {
            buttonClassName += 'bg-blue-500 text-white hover:bg-blue-600';
            buttonStyle.color = '#FFFFFF'; // white
            buttonStyle.backgroundColor = '#3B82F6'; // blue-500
          } else if (today) {
            buttonClassName += 'bg-blue-50 text-blue-600';
            buttonStyle.color = '#2563EB'; // blue-600
            buttonStyle.backgroundColor = '#EFF6FF'; // blue-50
          } else {
            buttonClassName += 'hover:bg-gray-100 cursor-pointer';
            buttonStyle.color = '#374151'; // gray-700 명시적 색상
          }

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={buttonClassName}
              style={buttonStyle}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 h-10 border border-gray-300 rounded-lg text-[14px] font-medium hover:bg-gray-50"
          style={{ 
            color: '#374151', // gray-700 명시적 색상
            borderColor: '#D1D5DB' // gray-300
          }}
        >
          취소
        </button>
        <button
          onClick={handleSelect}
          disabled={!selectedDateState}
          className={`flex-1 h-10 rounded-lg text-[14px] font-medium text-white ${
            selectedDateState
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          선택
        </button>
      </div>
    </div>
  );
};

export default CustomCalendar;

