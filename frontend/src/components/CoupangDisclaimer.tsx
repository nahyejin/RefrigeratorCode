import * as React from 'react';

/**
 * 쿠팡 파트너스 고지 문구.
 *
 * 예전에는 이 문장이 **구매 버튼이 뜨는 카드마다** 붙어 있었다.
 * 재료명이 들어가지 않는 고정 안내 문장인데도 목록을 스크롤하는 내내 반복돼
 * 화면이 무거워 보였다 → 목록 화면당 맨 아래에 한 번만 노출한다.
 *
 * 광고가 하나도 없는 화면에서는 렌더하지 않는 것이 맞으므로,
 * 페이지에서 목록 하단에만 배치할 것.
 */
const CoupangDisclaimer: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <p
    style={{
      margin: '20px auto 4px',
      maxWidth: 400,
      padding: '0 8px',
      fontSize: 12,
      lineHeight: 1.5,
      color: 'var(--ink-400)',
      textAlign: 'center',
      wordBreak: 'keep-all',
      ...style,
    }}
  >
    이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
  </p>
);

export default CoupangDisclaimer;
