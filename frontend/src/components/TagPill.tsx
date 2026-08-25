import React from 'react';
import Chip from './ui/Chip';

interface TagPillProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 기존 호출부 호환용 래퍼. 신규 코드는 `ui/Chip` 을 직접 쓸 것.
 * 예전엔 폰트를 'Noto Sans KR' 로 따로 지정하고 있어서 앱 전체(Pretendard)와 톤이 달랐음.
 */
const TagPill: React.FC<TagPillProps> = ({ children, onClick, className = '', style }) => (
  <Chip
    size="sm"
    interactive={!!onClick}
    onClick={onClick}
    className={className}
    style={{ marginRight: 8, marginBottom: 4, ...style }}
  >
    {children}
  </Chip>
);

export default TagPill;
