import * as React from 'react';

interface SectionHeaderProps {
  title: string;
  /** 왼쪽 아이콘 이미지 URL (플랫폼 로고 등). 없으면 제목만 */
  iconUrl?: string;
  /** 제목 아래 한 줄 설명 */
  description?: string;
}

/**
 * 목록 페이지의 섹션 제목.
 *
 * 예전에는 섹션마다 마크업이 달랐다 — 어떤 건 ⭐ 이모지를 제목 문자열에 섞어 넣고,
 * 어떤 건 이미지 아이콘을 쓰고, 정렬을 맞추려고 `position: relative; top: 6px` 같은
 * 임시 보정이 들어가 있었다. 게다가 제목 아래 2px 짜리 진한 회색 줄이 화면을
 * 토막 내서 섹션이 "잘려" 보였다.
 *
 * 여기서: 아이콘은 이미지로만(의미 있는 것만), 이모지는 쓰지 않고,
 * 구분선은 옅은 1px 로 낮춘다.
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({ title, iconUrl, description }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {iconUrl && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 20,
            height: 20,
            flexShrink: 0,
            background: `url(${iconUrl}) no-repeat center/contain`,
          }}
        />
      )}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--ink-900)',
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
    {description && (
      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.45 }}>
        {description}
      </p>
    )}
  </div>
);

export default SectionHeader;
