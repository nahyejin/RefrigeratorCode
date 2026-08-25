import React, { useState, useRef, useEffect } from 'react';
import CloseButton from './ui/CloseButton';

type CustomCalendarProps = {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
  type?: 'expiry' | 'purchase' | 'range-start' | 'range-end' | 'range';
  minDate?: Date;
  maxDate?: Date;
  // 기간 선택 모드
  mode?: 'single' | 'range';
  selectedStartDate?: Date | null;
  selectedEndDate?: Date | null;
  onRangeSelect?: (startDate: Date | null, endDate: Date | null) => void;
  onSelect?: () => void; // 선택 버튼 클릭 시 호출
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
  maxDate,
  mode = 'single',
  selectedStartDate,
  selectedEndDate,
  onRangeSelect,
  onSelect
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    selectedDate 
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) 
      : selectedStartDate
      ? new Date(selectedStartDate.getFullYear(), selectedStartDate.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateState, setSelectedDateState] = useState<Date | null>(selectedDate);
  const [rangeStartDate, setRangeStartDate] = useState<Date | null>(() => {
    if (mode === 'range' && selectedStartDate) {
      return new Date(selectedStartDate.getFullYear(), selectedStartDate.getMonth(), selectedStartDate.getDate());
    }
    return null;
  });
  const [rangeEndDate, setRangeEndDate] = useState<Date | null>(() => {
    if (mode === 'range' && selectedEndDate) {
      return new Date(selectedEndDate.getFullYear(), selectedEndDate.getMonth(), selectedEndDate.getDate());
    }
    return null;
  });
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // 년도 목록 생성 (2000년부터 현재+3년까지, 최신순)
  const currentYear = today.getFullYear();
  const startYear = 2000;
  const endYear = currentYear + 3;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).reverse();
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
    if (!Utils.isValidDateRange(date, type, minDate, maxDate)) {
      return;
    }

    if (mode === 'range') {
      // 기간 선택 모드
      // 날짜만 비교 (시간 제외)
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      console.log('handleDateClick - range mode:', {
        dateOnly,
        rangeStartDate,
        rangeEndDate,
        hasStart: !!rangeStartDate,
        hasEnd: !!rangeEndDate
      });
      
      if (!rangeStartDate || (rangeStartDate && rangeEndDate)) {
        // 시작일 선택 또는 재선택
        console.log('Setting start date:', dateOnly);
        setRangeStartDate(dateOnly);
        setRangeEndDate(null);
        setIsSelectingRange(true);
        if (onRangeSelect) {
          onRangeSelect(dateOnly, null);
        }
      } else if (rangeStartDate && !rangeEndDate) {
        // 종료일 선택
        const startOnly = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate());
        
        if (dateOnly.getTime() < startOnly.getTime()) {
          // 종료일이 시작일보다 이전이면 시작일과 종료일 교체
          console.log('Reversing range:', dateOnly, startOnly);
          setRangeEndDate(startOnly);
          setRangeStartDate(dateOnly);
          setIsSelectingRange(false);
          if (onRangeSelect) {
            onRangeSelect(dateOnly, startOnly);
          }
        } else if (dateOnly.getTime() === startOnly.getTime()) {
          // 같은 날짜를 다시 클릭하면 단일 날짜로 유지
          console.log('Same date clicked, keeping single');
          setRangeEndDate(null);
          setIsSelectingRange(false);
          if (onRangeSelect) {
            onRangeSelect(dateOnly, null);
          }
        } else {
          // 정상적인 종료일 선택
          console.log('Setting end date:', startOnly, dateOnly);
          setRangeEndDate(dateOnly);
          setIsSelectingRange(false);
          if (onRangeSelect) {
            onRangeSelect(startOnly, dateOnly);
          }
        }
      }
    } else {
      // 단일 날짜 선택 모드
      setSelectedDateState(date);
    }
  };

  const handleSelect = () => {
    if (onSelect) {
      // onSelect가 제공되면 그것을 호출 (외부에서 처리)
      onSelect();
    } else {
      // 기존 로직 (onSelect가 없을 때만)
      if (mode === 'range') {
        // 기간 선택 모드: 시작일이 있으면 적용
        if (rangeStartDate) {
          const finalEndDate = rangeEndDate || rangeStartDate;
          onDateSelect(rangeStartDate);
          if (onRangeSelect) {
            onRangeSelect(rangeStartDate, finalEndDate);
          }
        }
      } else {
        // 단일 날짜 선택 모드
        if (selectedDateState) {
          onDateSelect(selectedDateState);
        }
      }
    }
  };

  const calendarDays = getCalendarDays();
  const isToday = (date: Date | null) => {
    if (!date) return false;
    const todayCheck = new Date();
    return date.toDateString() === todayCheck.toDateString();
  };

  const isSelected = (date: Date | null) => {
    if (!date) return false;
    
    if (mode === 'range') {
      // 기간 선택 모드
      // 날짜만 비교 (시간 제외)
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      if (rangeStartDate) {
        const startOnly = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate());
        
        // 시작일 확인
        if (dateOnly.getTime() === startOnly.getTime()) {
          return true;
        }
        
        // 종료일이 있으면 기간 내 날짜 확인
        if (rangeEndDate) {
          const endOnly = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate());
          
          // 종료일 확인
          if (dateOnly.getTime() === endOnly.getTime()) {
            return true;
          }
          
          // 기간 내 날짜 확인 (시작일과 종료일 사이)
          const dateTime = dateOnly.getTime();
          const startTime = startOnly.getTime();
          const endTime = endOnly.getTime();
          return dateTime >= startTime && dateTime <= endTime;
        }
      }
      return false;
    } else {
      // 단일 날짜 선택 모드
      if (!selectedDateState) return false;
      return date.toDateString() === selectedDateState.toDateString();
    }
  };

  const isInRange = (date: Date | null) => {
    if (!date || mode !== 'range') return false;
    if (!rangeStartDate || !rangeEndDate) return false;
    
    // 날짜만 비교 (시간 제외)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startOnly = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate());
    const endOnly = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate());
    
    const dateTime = dateOnly.getTime();
    const startTime = startOnly.getTime();
    const endTime = endOnly.getTime();
    
    // 시작일과 종료일 사이의 날짜 (시작일과 종료일 제외)
    return dateTime > startTime && dateTime < endTime;
  };
  
  // 기간 내 날짜인지 확인 (시작일과 종료일 포함)
  const isInSelectedRange = (date: Date | null) => {
    if (!date || mode !== 'range') return false;
    if (!rangeStartDate || !rangeEndDate) return false;
    
    // 날짜만 비교 (시간 제외)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startOnly = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate());
    const endOnly = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate());
    
    const dateTime = dateOnly.getTime();
    const startTime = startOnly.getTime();
    const endTime = endOnly.getTime();
    
    // 시작일과 종료일 사이의 날짜 (시작일과 종료일 포함)
    return dateTime >= startTime && dateTime <= endTime;
  };

  const isDisabled = (date: Date | null) => {
    if (!date) return true;
    return !Utils.isValidDateRange(date, type, minDate, maxDate);
  };

  return (
    <div className="bg-white rounded-xl p-4 w-[320px] custom-calendar-container relative" style={{ boxShadow: 'none' }} data-calendar-range-mode={mode === 'range' ? 'true' : 'false'}>
      {/* 상단 제목 영역 */}
      <div className="relative mb-4">
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, color: 'var(--ink-900)' }}>일자를 선택하세요</div>
        {/* 상단 X 버튼 */}
        <CloseButton onClick={onClose} style={{ top: 4, right: 4 }} />
      </div>
      {/* 상단: < > 버튼과 년도/월 드롭다운 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded border-none outline-none"
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          <div className="relative" ref={yearDropdownRef} style={{ overflow: 'visible', zIndex: 'var(--z-dropdown)' }}>
            <button
              onClick={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowMonthDropdown(false);
              }}
              className="px-3 py-1 hover:bg-gray-100 rounded text-[15px] font-medium whitespace-nowrap min-w-[70px] flex items-center gap-1"
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
              <div 
                className="custom-scrollbar"
                style={{ 
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #D2D2D8',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  zIndex: 'var(--z-dropdown)',
                  minWidth: '100%',
                  width: '100%',
                  maxHeight: '180px',
                  overflow: 'hidden',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  display: 'block',
                  scrollbarWidth: 'auto',
                  scrollbarColor: '#6A6A73 #F5F5F7'
                }}
              >
                {years.map((y) => (
                  <div
                    key={y}
                    onClick={() => handleYearSelect(y)}
                    style={{ 
                      width: '100%',
                      minHeight: '36px',
                      maxHeight: '36px',
                      height: '36px',
                      padding: '0 16px',
                      margin: 0,
                      display: 'flex', 
                      alignItems: 'center',
                      boxSizing: 'border-box',
                      background: y === year ? '#eff6ff' : 'transparent',
                      color: y === year ? '#2563eb' : '#1A1A1E',
                      cursor: 'pointer',
                      fontSize: '15px',
                      textAlign: 'left',
                      flexShrink: 0,
                      lineHeight: '36px',
                      border: 'none',
                      borderBottom: '1px solid #F5F5F7'
                    }}
                    onMouseEnter={(e) => {
                      if (y !== year) {
                        e.currentTarget.style.backgroundColor = '#F5F5F7';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (y !== year) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {y}년
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="relative" ref={monthDropdownRef} style={{ overflow: 'visible', zIndex: 'var(--z-dropdown)' }}>
            <button
              onClick={() => {
                setShowMonthDropdown(!showMonthDropdown);
                setShowYearDropdown(false);
              }}
              className="px-3 py-1 hover:bg-gray-100 rounded text-[15px] font-medium whitespace-nowrap min-w-[60px] flex items-center gap-1"
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
              <div 
                className="custom-scrollbar"
                style={{ 
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #D2D2D8',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  zIndex: 'var(--z-dropdown)',
                  minWidth: '100%',
                  width: '100%',
                  maxHeight: '180px',
                  overflow: 'hidden',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  display: 'block',
                  scrollbarWidth: 'auto',
                  scrollbarColor: '#6A6A73 #F5F5F7'
                }}
              >
                {months.map((m, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleMonthSelect(idx)}
                    style={{ 
                      width: '100%',
                      minHeight: '36px',
                      maxHeight: '36px',
                      height: '36px',
                      padding: '0 16px',
                      margin: 0,
                      display: 'flex', 
                      alignItems: 'center',
                      boxSizing: 'border-box',
                      background: idx === month ? '#eff6ff' : 'transparent',
                      color: idx === month ? '#2563eb' : '#1A1A1E',
                      cursor: 'pointer',
                      fontSize: '15px',
                      textAlign: 'left',
                      flexShrink: 0,
                      lineHeight: '36px',
                      border: 'none',
                      borderBottom: '1px solid #F5F5F7'
                    }}
                    onMouseEnter={(e) => {
                      if (idx !== month) {
                        e.currentTarget.style.backgroundColor = '#F5F5F7';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (idx !== month) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded border-none outline-none"
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
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
          <div key={day} className="text-center text-[13px] font-medium text-gray-600 py-1">
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
          const inRange = isInRange(date);
          const inSelectedRange = isInSelectedRange(date);
          const today = isToday(date);
          // 날짜만 비교 (시간 제외)
          const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const isStartDate = mode === 'range' && rangeStartDate && 
            dateOnly.getTime() === new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate()).getTime();
          const isEndDate = mode === 'range' && rangeEndDate && 
            dateOnly.getTime() === new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate()).getTime();
          
          // 기간 내 날짜인지 확인 (시작일과 종료일 제외)
          const isMiddleDate = mode === 'range' && rangeStartDate && rangeEndDate && inSelectedRange && !isStartDate && !isEndDate;
          
          // 디버깅: 특정 날짜에 대해 로그 출력
          if (mode === 'range' && rangeStartDate && rangeEndDate && date.getDate() >= 1 && date.getDate() <= 11 && date.getMonth() === 11) {
            console.log(`Date ${date.getDate()}:`, {
              isStartDate,
              isEndDate,
              isMiddleDate,
              inRange,
              inSelectedRange,
              rangeStartDate: rangeStartDate.getDate(),
              rangeEndDate: rangeEndDate.getDate()
            });
          }

          let buttonStyle: React.CSSProperties = {};
          let buttonClassName = 'aspect-square rounded-lg text-[15px] font-medium ';
          
          if (disabled) {
            buttonClassName += 'text-gray-300 cursor-not-allowed';
            buttonStyle.color = '#D2D2D8'; // gray-300
          } else if (mode === 'range' && (isStartDate || isEndDate)) {
            // 기간 선택 모드: 시작일 또는 종료일 (짙은 파란색) - 최우선
            buttonClassName += 'bg-blue-500 text-white hover:bg-blue-600';
            buttonStyle.color = '#FFFFFF'; // white
            buttonStyle.backgroundColor = '#3B82F6'; // blue-500
          } else if (mode === 'range' && rangeStartDate && rangeEndDate && (isMiddleDate || inRange)) {
            // 기간 선택 모드: 기간 내 날짜 (연한 파란색) - 시작일과 종료일 사이
            // rangeStartDate와 rangeEndDate가 모두 있을 때만 표시
            buttonClassName += 'bg-blue-100 text-blue-700 hover:bg-blue-200';
            // 인라인 스타일로 명시적으로 설정 (CSS 클래스보다 우선순위 높음)
            buttonStyle.backgroundColor = '#DBEAFE'; // blue-100
            buttonStyle.color = '#1E40AF'; // blue-800
            buttonStyle.border = 'none';
            buttonStyle.outline = 'none';
            buttonStyle.boxShadow = 'none';
          } else if (mode === 'range' && selected && !rangeEndDate) {
            // 기간 선택 모드에서 시작일만 선택된 경우 (단일 날짜)
            buttonClassName += 'bg-blue-500 text-white hover:bg-blue-600';
            buttonStyle.color = '#FFFFFF'; // white
            buttonStyle.backgroundColor = '#3B82F6'; // blue-500
          } else if (selected && mode !== 'range') {
            // 단일 선택 모드
            buttonClassName += 'bg-blue-500 text-white hover:bg-blue-600';
            buttonStyle.color = '#FFFFFF'; // white
            buttonStyle.backgroundColor = '#3B82F6'; // blue-500
          } else if (today) {
            buttonClassName += 'bg-blue-50 text-blue-600';
            buttonStyle.color = '#2563EB'; // blue-600
            buttonStyle.backgroundColor = '#EFF6FF'; // blue-50
          } else {
            buttonClassName += 'hover:bg-gray-100 cursor-pointer';
            buttonStyle.color = '#3A3A42'; // gray-700 명시적 색상
          }

          // 인라인 스타일이 확실히 적용되도록 명시적으로 설정
          const finalStyle: React.CSSProperties = {
            ...buttonStyle,
            backgroundColor: buttonStyle.backgroundColor || undefined,
            color: buttonStyle.color || undefined,
            border: buttonStyle.border || undefined,
            outline: buttonStyle.outline || undefined,
            boxShadow: buttonStyle.boxShadow || undefined
          };

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={buttonClassName}
              style={finalStyle}
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
          className="flex-1 h-10 border border-gray-300 rounded-lg text-[15px] font-medium hover:bg-gray-50"
          style={{ 
            color: '#3A3A42', // gray-700 명시적 색상
            borderColor: '#D2D2D8' // gray-300
          }}
        >
          취소
        </button>
        <button
          onClick={handleSelect}
          disabled={mode === 'single' ? !selectedDateState : !rangeStartDate}
          className={`flex-1 h-10 rounded-lg text-[15px] font-medium text-white ${
            (mode === 'single' && selectedDateState) || (mode === 'range' && rangeStartDate)
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

