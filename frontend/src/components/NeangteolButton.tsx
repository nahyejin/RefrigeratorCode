import * as React from 'react';

interface NeangteolButtonProps {
  children: React.ReactNode;
  color?: string; // Tailwind 색상 클래스
  textColor?: string;
  icon?: React.ReactNode;
  className?: string;
  border?: boolean;
  onClick?: () => void;
  disabled?: boolean; // 처리 중·입력 부족일 때 클릭을 막고 흐리게 보인다
}

const NeangteolButton: React.FC<NeangteolButtonProps> = ({
  children,
  color = 'bg-white',
  textColor = 'text-black',
  icon,
  className = '',
  border = false,
  onClick,
  disabled = false,
}: NeangteolButtonProps) => {
  return (
    <button
      type="button"
      className={`w-[320px] h-[44px] rounded-lg flex items-center justify-center font-bold text-[16px] ${color} ${textColor} ${border ? 'border border-[#D2D2D8]' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="mr-2 flex items-center">{icon}</span>}
      {children}
    </button>
  );
};

export default NeangteolButton; 