import * as React from 'react';

/**
 * 쿠팡 파트너스 경제적 이해관계(대가성) 표시.
 *
 * 위치가 왜 위인가:
 *   쿠팡 파트너스 이용 가이드는 이 문구를 "게시물의 **제목 또는 첫 부분**에 기재" 하고
 *   "소비자가 쉽게 인식할 수 있도록" 할 것을 요구한다(STEP 7 — 경제적 이해관계 표시).
 *   예전에는 화면 맨 아래에 한 번만 뒀는데, 스크롤을 끝까지 내리지 않으면 보이지 않아
 *   "쉽게 인식" 요건을 만족한다고 보기 어려웠다.
 *   → 광고가 나타나기 **전**, 목록 위쪽에 둔다.
 *
 * 카드마다 반복하지 않는 이유:
 *   재료명이 들어가지 않는 고정 문장이라 목록을 스크롤하는 내내 같은 문장이 반복되면
 *   오히려 읽지 않게 된다. 화면당 한 번, 대신 확실히 보이는 자리에 둔다.
 *   (광고 카드 자체에도 짧은 문구를 함께 넣어 카드만 보고 지나가는 경우를 보완한다)
 */
const CoupangDisclaimer: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <p
    style={{
      margin: '0 auto 10px',
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
