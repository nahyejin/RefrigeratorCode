import * as React from 'react';

interface NeangteolInputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  showPasswordToggle?: boolean;
}

const NeangteolInput: React.FC<NeangteolInputProps> = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  onKeyPress,
  className = '',
  showPasswordToggle = false,
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPasswordType = type === 'password';

  const inputType = isPasswordType && showPassword ? 'text' : type;

  if (showPasswordToggle && isPasswordType) {
    return (
      <div className="relative w-full">
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyPress={onKeyPress}
          className={`w-full h-[44px] bg-white rounded-lg pl-4 pr-10 text-[15px] placeholder-[#999] border border-gray-300 focus:outline-none focus:ring-0 focus:border-gray-400 focus:shadow-none ${className}`}
          style={{ backgroundColor: '#fff', boxShadow: 'none', outline: 'none' }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
          style={{ padding: '4px' }}
        >
          {showPassword ? (
            // 눈 아이콘 (숨기기)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          ) : (
            // 눈 아이콘 (보기)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          )}
        </button>
      </div>
    );
  }

  // className에 w-full이나 w-[260px]가 없으면 기본값 적용
  const hasWidthClass = className.includes('w-');
  const defaultWidthClass = hasWidthClass ? '' : 'w-[260px]';
  
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyPress={onKeyPress}
      className={`${defaultWidthClass} h-[44px] bg-white rounded-lg px-4 text-[15px] placeholder-[#999] border border-gray-300 focus:outline-none focus:ring-0 focus:border-gray-400 focus:shadow-none ${className}`}
      style={{ backgroundColor: '#fff', boxShadow: 'none', outline: 'none' }}
    />
  );
};

export default NeangteolInput; 