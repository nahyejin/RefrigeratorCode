import * as React from 'react';
import Button from './ui/Button';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * 기존 호출부 호환용 래퍼. 신규 코드는 `ui/Button` 을 직접 쓸 것.
 * (예전엔 자체 Tailwind 클래스 문자열을 들고 있었는데, 공통 버튼과 높이·색이 달라
 *  화면마다 버튼이 제각각으로 보이는 원인이었음)
 */
const PrimaryButton: React.FC<PrimaryButtonProps> = ({ children, className = '', ...props }) => (
  <Button variant="secondary" size="lg" block className={className} {...props}>
    {children}
  </Button>
);

export default PrimaryButton;
