import * as React from 'react';

export type SectionIconKind =
  | 'frozen'      // 냉동보관
  | 'fridge'      // 냉장보관
  | 'room'        // 실온보관
  | 'special'     // 특별한 날
  | 'favorite'    // 즐겨찾기
  | 'recorded'    // 기록
  | 'completed';  // 완료

interface SectionIconProps {
  kind: SectionIconKind;
  size?: number;
  color?: string;
}

/**
 * 섹션 제목 왼쪽 표식.
 *
 * 예전에는 화면마다 표현이 달랐다 —
 *   내냉장고는 이모지(🧊 ❄️ 🌡️), 요즘인기는 ⭐ 를 제목 문자열에 섞어 넣고,
 *   마이페이지만 SVG 를 쓰고 있었다.
 * 이모지는 기기·OS 마다 그림체와 크기가 제각각이라(같은 화면 안에서도 톤이 안 맞음)
 * 앱 전체를 선으로 그린 SVG 로 통일한다. 색은 글자색을 따라간다.
 */
const SectionIcon: React.FC<SectionIconProps> = ({ kind, size = 19, color = 'currentColor' }) => {
  const base = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    style: { width: size, height: size, flexShrink: 0, display: 'block' },
  };

  switch (kind) {
    case 'frozen': // 눈결정
      return (
        <svg {...base}>
          <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
          <path d="M12 6.6l-2-2M12 6.6l2-2M12 17.4l-2 2M12 17.4l2 2" />
        </svg>
      );
    case 'fridge': // 냉장고
      return (
        <svg {...base}>
          <rect x="5.5" y="2.8" width="13" height="18.4" rx="2.6" />
          <path d="M5.5 10.6h13M9 6.4v2M9 13.4v2.4" />
        </svg>
      );
    case 'room': // 온도계
      return (
        <svg {...base}>
          <path d="M10 14.2V5.4a2 2 0 1 1 4 0v8.8a3.6 3.6 0 1 1-4 0z" />
          <path d="M12 9.4v5" />
        </svg>
      );
    case 'special': // 반짝임
      return (
        <svg {...base}>
          <path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9z" />
          <path d="M18.4 15.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      );
    case 'favorite': // 별
      return (
        <svg {...base}>
          <path d="M12 2.9l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
        </svg>
      );
    case 'recorded': // 메모
      return (
        <svg {...base}>
          <path d="M5.5 4.6h9.2l4.3 4.3v10.5a1.6 1.6 0 0 1-1.6 1.6H5.5a1.6 1.6 0 0 1-1.6-1.6V6.2a1.6 1.6 0 0 1 1.6-1.6z" />
          <path d="M14.4 4.6v4.6h4.6M7.8 13h8M7.8 16.6h5.4" />
        </svg>
      );
    case 'completed': // 체크
    default:
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="8.6" />
          <path d="M8.4 12.2l2.6 2.6 4.8-5.2" />
        </svg>
      );
  }
};

export default SectionIcon;
