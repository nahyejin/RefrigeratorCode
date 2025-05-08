import * as React from 'react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ children, className = '', ...props }) => (
  <button
    className={`bg-[#3C3C3C] text-white text-sm font-semibold px-4 py-2 rounded-md w-full h-12 hover:bg-[#2e2e2e] transition ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default PrimaryButton; 