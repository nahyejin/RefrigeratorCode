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
const CoupangDisclaimer: React.FC<{
  style?: React.CSSProperties;
  compact?: boolean;
  /**
   * 쉼표(`일환으로,`) 뒤에서 줄을 끊는다.
   *
   * **폭이 좁은 자리에서만** 쓴다. 이 문구는 한 줄로 두면 200px 을 넘게
   * 차지해서, 가로 캐러셀(요즘인기)에서는 **문구가 광고 카드의 폭을 혼자
   * 정해 버린다** — 카드를 줄이려 해도 이것 때문에 못 줄인다.
   * 쉼표에서 끊으면 두 줄이 거의 같은 길이라 폭이 절반으로 준다.
   *
   * 반대로 세로 목록(냉장고요리)처럼 폭이 넉넉한 곳에서는 켜지 않는다 —
   * 한 줄이면 될 것을 두 줄로 만들면 광고가 커 보인다.
   */
  twoLines?: boolean;
}> = ({ style, compact = false, twoLines = false }) => (
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
    {/* **기본은 줄을 억지로 끊지 않는다.**
        예전에는 쉼표 뒤에 `<br />` 를 늘 박아 두 줄로 고정했다. 폭이 좁을 때
        아무 데서나 감기는 걸 막으려던 것인데, 냉장고요리처럼 **폭이 넉넉한
        곳에서는 한 줄이면 될 것을 굳이 두 줄로 만들어** 광고가 커 보였다.
        `wordBreak: keep-all` 이 낱말 단위로 감아 주므로 그냥 흘려도 된다.
        폭이 좁은 자리에서만 `twoLines` 로 되살린다. */}
    이 광고는 쿠팡 파트너스 활동의 일환으로,{twoLines ? <br /> : ' '}
    이에 따른 일정액의 수수료를 제공받습니다.
  </p>
);

/**
 * 대가성 문구를 **항상 한 줄로** — 자리 폭에 들어갈 때까지 글씨를 줄인다(maxFont → 최소 7px).
 * 쓰는 곳: 다이내믹 배너(CoupangDynamicBanner), 부족한 재료 구매 시트(CoupangAdSheet).
 *
 * 폰(폭 ~340px)에서는 11px 로는 한 줄에 안 들어가 문장 중간 어중간한 곳에서 감겼고, 쉼표 뒤에서 두 줄로
 * 끊어 봤더니 "굳이 두 줄까지?" 라는 의견이라 한 줄 + 작은 글씨로 바꿨다(2026-09-22).
 * 처음엔 최소 8.5px 에서도 안 들어가면 두 줄로 내렸는데, 화면마다 한 줄·두 줄이 섞여 보여 "줄바꿈 없이
 * 통일" 요청으로 두 줄을 없앴다(2026-09-23). 폰 폭(320px 이상)에서는 7px 안에 들어간다.
 */
const TEXT_A = '이 광고는 쿠팡 파트너스 활동의 일환으로,';
const TEXT_B = '이에 따른 일정액의 수수료를 제공받습니다.';
const MIN_FONT = 7;

export const OneLineCoupangDisclaimer: React.FC<{
  /** 폭이 넉넉할 때의 글씨 크기 — 여기서부터 줄여 나간다 */
  maxFont?: number;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
}> = ({ maxFont = 12, align = 'left', style }) => {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [font, setFont] = React.useState(maxFont);

  React.useLayoutEffect(() => {
    const box = boxRef.current, probe = measureRef.current;
    if (!box || !probe) return;
    let lastWidth = -1;
    const fit = () => {
      // **폭이 바뀔 때만** 다시 잰다. 처음엔 보이는 글자 자체의 크기를 바꿔 가며 쟀고 높이 변화에도
      // 반응했는데, 두 줄 ↔ 한 줄로 바뀌며 높이가 변할 때마다 다시 재서 상자가 계속 떨렸다(2026-09-22).
      // 이제는 안 보이는 한 줄짜리 복사본으로만 재고, 보이는 문구는 결과만 받는다.
      const avail = box.clientWidth;
      if (avail === lastWidth) return;
      lastWidth = avail;
      let f = maxFont;
      probe.style.fontSize = f + 'px';
      while (probe.offsetWidth > avail && f > MIN_FONT) {
        f -= 0.5;
        probe.style.fontSize = f + 'px';
      }
      setFont(f);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [maxFont]);

  const textStyle: React.CSSProperties = { lineHeight: 1.4, letterSpacing: '-0.2px' };
  return (
    <div ref={boxRef} style={{ position: 'relative', ...style }}>
      <span ref={measureRef} aria-hidden
            style={{ ...textStyle, position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', left: 0, top: 0 }}>
        {TEXT_A} {TEXT_B}
      </span>
      <p style={{ ...textStyle, margin: 0, fontSize: font, color: 'var(--ink-500)', textAlign: align,
                  whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {TEXT_A} {TEXT_B}
      </p>
    </div>
  );
};

export default CoupangDisclaimer;
