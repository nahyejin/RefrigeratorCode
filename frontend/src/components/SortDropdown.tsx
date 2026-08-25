import React, { useState, useRef, useEffect } from 'react';

const SORT_OPTIONS = [
  { value: 'expiry', label: '유통기한 임박순' },
  { value: 'purchase', label: '구매일 오래된순' },
  { value: 'name', label: '가나다순' },
];

export type SortType = 'expiry' | 'purchase' | 'name';

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
        className="border border-gray-300 rounded h-6 py-0 pl-2 pr-6 text-[13px] font-medium bg-white text-[#3A3A42] focus:outline-none transition min-w-[110px] relative"
        style={{ 
          textAlign: 'left',
          height: 28,
          border: '1px solid #D2D2D8',
          borderRadius: 6,
          fontSize: 13,
          padding: '0 22px 0 8px',
          fontWeight: 600,
          background: '#FFFFFF',
          color: '#1A1A1E',
          minWidth: 100,
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
        <span>{selectedOption.label}</span>
        <span style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          fontSize: 15,
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