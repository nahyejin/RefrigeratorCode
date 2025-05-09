import React from 'react';

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
  return (
    <select
      className={`border border-gray-300 rounded h-6 py-0 pl-2 pr-2 text-[11px] font-medium bg-white text-[#404040] focus:outline-none focus:ring-2 focus:ring-blue-200 transition ${className || ''}`}
      value={value}
      onChange={e => onChange(e.target.value as SortType)}
      style={{ minWidth: 110 }}
      aria-label="정렬 기준 선택"
    >
      {SORT_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

export default SortDropdown; 