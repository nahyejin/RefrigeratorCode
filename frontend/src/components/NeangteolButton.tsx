import * as React from 'react';

interface NeangteolButtonProps {
  children: React.ReactNode;
  color?: string; // Tailwind 색상 클래스
  textColor?: string;
  icon?: React.ReactNode;
  className?: string;
  border?: boolean;
  onClick?: () => void;
}

const NeangteolButton: React.FC<NeangteolButtonProps> = ({
  children,
  color = 'bg-white',
  textColor = 'text-black',
  icon,
  className = '',
  border = false,
  onClick,
}: NeangteolButtonProps) => {
  return (
    <button
      type="button"
      className={`w-[320px] h-[44px] rounded-lg flex items-center justify-center font-bold text-[15px] ${color} ${textColor} ${border ? 'border border-[#ddd]' : ''} ${className}`}
      onClick={onClick}
    >
      {icon && <span className="mr-2 flex items-center">{icon}</span>}
      {children}
    </button>
  );
};

export default NeangteolButton; 