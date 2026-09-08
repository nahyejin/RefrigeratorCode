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
    {/* **줄을 억지로 끊지 않는다.**
        예전에는 쉼표 뒤에 `<br />` 를 박아 두 줄로 고정했다. 폭이 좁을 때
        아무 데서나 감기는 걸 막으려던 것인데, 냉장고요리처럼 **폭이 넉넉한
        곳에서는 한 줄이면 될 것을 굳이 두 줄로 만들어** 광고가 커 보였다.
        `wordBreak: keep-all` 이 낱말 단위로 감아 주므로 그냥 흘려도 된다. */}
    이 광고는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
  </p>
);

export default CoupangDisclaimer;
