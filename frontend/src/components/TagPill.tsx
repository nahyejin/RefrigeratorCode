import * as React from 'react';

interface TagPillProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const TagPill: React.FC<TagPillProps> = ({ children, className = '', style }) => (
  <span
    className={`inline-flex flex-nowrap items-center bg-[#444444] text-white text-[11px] font-light px-2 h-6 rounded-full mr-2 mb-[3px] overflow-hidden whitespace-nowrap ${className}`}
    style={style}
  >
    {children}
  </span>
);

export default TagPill; 