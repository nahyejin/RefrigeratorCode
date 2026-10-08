import React, { useState, useRef, useEffect } from 'react';

// `short` 는 **닫혀 있을 때만** 쓴다.
// 보관함 머리줄에는 이 드롭다운 말고도 `모두삭제` 와 재료 수·임박 표시가 함께
// 서는데, `유통기한 임박순`(8자)이 그 줄에서 가장 넓은 칸을 차지해 나머지를
// 밀어냈다. 무엇으로 정렬 중인지는 짧은 말로도 통하고, 고를 때 펼치는 목록에는
// 긴 설명을 그대로 둔다 — 줄이는 건 **이미 고른 것을 다시 읽는 자리**뿐이다.
export type SortType = 'expiry' | 'purchase' | 'name';

// 타입을 붙여 둔다. 전에는 `value` 가 그냥 `string` 으로 추론돼
// `onChange(option.value)` 가 타입 오류였다.
const SORT_OPTIONS: { value: SortType; label: string; short: string }[] = [
  { value: 'expiry', label: '유통기한 임박순', short: '임박순' },
  { value: 'purchase', label: '구매일 오래된순', short: '구매일순' },
  { value: 'name', label: '가나다순', short: '가나다순' },
];

interface SortDropdownProps {
  value: SortType;
  onChange: (value: SortType) => void;
  className?: string;
}

const SortDropdown: React.FC<SortDropdownProps> = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = SORT_OPTIONS.find(opt => opt.value === value) || SORT_OPTIONS[0];

  return (
    <div 
      ref={dropdownRef}
      className={`relative ${className || ''}`}
      style={{ zIndex: 1 }} // 낮은 z-index로 다른 요소들 뒤에 위치
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="border border-gray-300 rounded h-6 py-0 pl-2 pr-6 text-[13px] font-medium bg-white text-[#3A3A42] focus:outline-none transition relative"
        style={{ 
          textAlign: 'left',
          height: 28,
          border: '1px solid #D2D2D8',
          borderRadius: 6,
          // 13 -> 12, 오른쪽 여백 22 -> 17.
          // 보관함 머리줄에서 이 칸이 가장 넓어, 재료 수·임박 표시를 아랫줄로
          // 밀어내고 있었다(2026-10-08).
          fontSize: 12,
          padding: '0 17px 0 7px',
          fontWeight: 600,
          background: '#FFFFFF',
          color: '#1A1A1E',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
          position: 'relative'
        }}
        aria-label="정렬 기준 선택"
      >
        <span>{selectedOption.short || selectedOption.label}</span>
        <span style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          fontSize: 13,
          color: '#9A9AA2'
        }}>∨</span>
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D2D2D8',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 10, // 드롭다운이 열렸을 때만 높은 z-index
          overflow: 'visible',
          minWidth: '130px'
        }}>
          {SORT_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: 600,
                color: value === option.value ? '#2563EB' : '#1A1A1E',
                backgroundColor: value === option.value ? '#EFF6FF' : '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                borderTop: option.value !== 'expiry' ? '1px solid #F5F5F7' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = '#F5F5F7';
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SortDropdown; 