import * as React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const BASE_STYLE =
  'w-full h-11 px-4 border border-[#D2D2D8] rounded-md text-sm placeholder-gray-400';

const TextInput: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <input
    className={`${BASE_STYLE} ${className}`}
    {...props}
  />
);

export default TextInput; 