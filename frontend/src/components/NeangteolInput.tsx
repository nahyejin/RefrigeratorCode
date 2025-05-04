import * as React from 'react';

interface NeangteolInputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const NeangteolInput: React.FC<NeangteolInputProps> = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  className = '',
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-[260px] h-[44px] bg-white rounded-lg px-4 text-[15px] placeholder-[#999] border-none focus:outline-none ${className}`}
    />
  );
};

export default NeangteolInput; 