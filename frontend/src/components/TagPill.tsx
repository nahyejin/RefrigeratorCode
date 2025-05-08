import * as React from 'react';

interface TagPillProps {
  children: React.ReactNode;
  className?: string;
}

const TagPill: React.FC<TagPillProps> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center bg-[#444444] text-white text-xs font-light px-3 py-[1px] rounded-full mr-2 mb-2 ${className}`}>
    {children}
  </span>
);

export default TagPill; 