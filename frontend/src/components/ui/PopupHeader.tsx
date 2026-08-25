import * as React from 'react';
import CloseButton from './CloseButton';

interface PopupHeaderProps {
  title: React.ReactNode;
  onClose?: () => void;
  /** 제목 왼쪽에 두는 요소 (뒤로가기 등) */
  leading?: React.ReactNode;
  /** 아래 구분선 표시 */
  divider?: boolean;
}

/**
 * 팝업 상단 바.
 *
 * 예전에는 팝업마다 제목 크기와 상단 높이가 달랐다 —
 *   달력 15px / 날짜입력 15px / 내 정보 수정 18px / 정렬 모달 18px,
 *   높이는 `minHeight: 56 + paddingTop 18` 처럼 임의 값이 섞여 있었음.
 * 팝업을 옮겨 다닐 때 제목 줄이 위아래로 튀어 보이는 원인이었다.
 * → 높이 52px, 제목 17px/700 으로 고정한다.
 */
const PopupHeader: React.FC<PopupHeaderProps> = ({ title, onClose, leading, divider = true }) => (
  <div
    style={{
      position: 'relative',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 52px',
      borderBottom: divider ? '1px solid var(--line-200)' : 'none',
      flexShrink: 0,
    }}
  >
    {leading && (
      <div style={{ position: 'absolute', left: 8, display: 'flex', alignItems: 'center' }}>{leading}</div>
    )}
    <div
      style={{
        fontSize: 17,
        fontWeight: 700,
        color: 'var(--ink-900)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}
    >
      {title}
    </div>
    {onClose && <CloseButton onClick={onClose} style={{ top: 8, right: 8 }} />}
  </div>
);

export default PopupHeader;
