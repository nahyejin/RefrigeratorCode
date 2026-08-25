import * as React from 'react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const BASE_STYLE =
  'bg-[#3A3A42] text-white text-sm font-semibold px-4 py-2 rounded-md w-full h-12 hover:bg-[#3A3A42] transition';

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ children, className = '', ...props }) => (
  <button className={`${BASE_STYLE} ${className}`} {...props}>
    {children}
  </button>
);

export default PrimaryButton; 