import * as React from 'react';

/**
 * 쿠팡 파트너스 경제적 이해관계(대가성) 표시.
 *
 * 어디에 붙이나 — **광고가 실제로 나오는 자리마다** 붙인다.
 *   가이드(STEP 7)는 문구를 "게시물의 제목 또는 첫 부분에 기재" 하고
 *   "소비자가 쉽게 인식할 수 있도록" 할 것을 요구한다.
 *
 *   처음에는 이걸 화면 맨 아래에 한 번 뒀다가(→ 스크롤을 끝까지 내려야 보임),
 *   다음에는 각 페이지 맨 위로 옮겼다. 그런데 페이지 위에 두니
 *   **광고가 하나도 없는 화면에서도 문구가 먼저 보여 서비스 전체가 광고처럼 읽혔다.**
 *   광고 하나 없는 목록 위에 "수수료를 제공받습니다" 가 떠 있는 것은
 *   정확하지도 않다.
 *
 *   그래서 지금은 광고 소재 자체에 붙인다 —
 *   광고 카드(CoupangAdCard), 구매 안내 시트(CoupangAdSheet),
 *   하단 배너(BottomCoupangAd). 각각의 **첫 부분**에 두므로
 *   "누르기 전에 알 수 있어야 한다" 는 취지도 그대로 지켜진다.
 */
const CoupangDisclaimer: React.FC<{ style?: React.CSSProperties; compact?: boolean }> = ({
  style,
  compact = false,
}) => (
  <p
    style={{
      margin: 0,
      fontSize: compact ? 11 : 12,
      lineHeight: 1.45,
      color: 'var(--ink-400)',
      wordBreak: 'keep-all',
      ...style,
    }}
  >
    {/* 한 줄로 흘리면 폭에 따라 아무 데서나 감겨 읽기 나쁘다.
        쉼표 뒤에서 끊어 두 줄로 고정한다. */}
    이 광고는 쿠팡 파트너스 활동의 일환으로,
    <br />
    이에 따른 일정액의 수수료를 제공받습니다.
  </p>
);

export default CoupangDisclaimer;
