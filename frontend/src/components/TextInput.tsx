import * as React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const TextInput: React.FC<TextInputProps> = ({ className = '', ...props }) => (
  <input
    className={`w-full h-11 px-4 border border-[#CCCCCC] rounded-md text-sm placeholder-gray-400 ${className}`}
    {...props}
  />
);

export default TextInput; 