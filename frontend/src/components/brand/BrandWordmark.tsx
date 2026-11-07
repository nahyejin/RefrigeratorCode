/**
 * BrandWordmark — 쿡매치 글자 로고. 굵고 둥근 한글 「쿡매치」 + 작은 영문 「CookMatch」 (락업 가로형의 글자 부분).
 *
 * 이미지 파일(PNG) 없이 글자로 그린다 — 크기·색을 CSS 로 바꿀 수 있고 해상도 걱정이 없다.
 * 이름 표기는 한글 「쿡매치」, 영문 「CookMatch」(C·M 대문자, 붙여 씀)로 통일한다. 「Cookmatch」는 쓰지 않는다.
 *
 * 쓰는 곳: 헤더(TopNavBar, 마크 없이 글자만 — 헤더에 마크까지 넣으면 혼잡), 스플래시(마크 아래).
 */
import * as React from 'react';

export interface BrandWordmarkProps {
  /** 한글 「쿡매치」 글자 크기(px). 영문은 비율대로 작게 따라간다 */
  size?: number;
  /** 한글 색. 기본 --ink-900 */
  color?: string;
  /** 영문 「CookMatch」 색. 기본 --ink-400 */
  subColor?: string;
  /** 영문 줄을 숨긴다(아주 좁은 자리) */
  hideEnglish?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  size = 19, color = 'var(--ink-900, #1A1A1E)', subColor = 'var(--ink-400, #9A9AA2)', hideEnglish = false, className, style,
}) => (
  <span
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: Math.max(4, Math.round(size * 0.3)),
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <span style={{ fontSize: size, fontWeight: 900, letterSpacing: '-0.03em', color }}>쿡매치</span>
    {!hideEnglish && (
      <span style={{ fontSize: Math.max(9, Math.round(size * 0.55)), fontWeight: 600, letterSpacing: '0.03em', color: subColor }}>
        CookMatch
      </span>
    )}
  </span>
);

export default BrandWordmark;
