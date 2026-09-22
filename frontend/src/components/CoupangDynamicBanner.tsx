import * as React from 'react';

/**
 * 쿠팡 파트너스 **다이내믹 배너**(iframe) — 레시피 조리 시트의 「조리 순서」 바로 위(높이 50), 요리 캘린더 맨 아래.
 *
 * 왜 이 자리·이 광고인가(2026-09-22):
 *   조리 시트와 캘린더는 한참 들여다보는 화면이라 광고가 눈에 오래 머문다. 보기만 해도 돈이 되는
 *   노출형(AdMob 등)은 광고 ID·ATT·스토어 개인정보 신고를 전부 바꿔야 하고 지금 사용자 수로는
 *   수익이 몇천 원 수준이라 미뤘다. 쿠팡 배너는 여전히 구매형이지만 **누른 뒤 24시간 안에 산 모든
 *   상품**에 수수료가 붙고, 광고 ID 를 쓰지 않아 스토어 신고를 바꿀 필요가 없다.
 *
 * 설정: 쿠팡 파트너스 → 배너 → 다이내믹 배너에서 만든 코드의 `id` 를 BANNER_ID 에 넣는다.
 *   비어 있으면 아무것도 그리지 않는다(고지 문구도 — 광고 없이 "수수료를 받습니다"만 남지 않게).
 *   iframe 주소 형식: ads-partners.coupang.com/widgets.html?id=…&template=carousel&trackingCode=…
 *
 * 앱(WebView) 안에서 배너를 눌렀을 때 쿠팡이 어디서 열리는지는 실기기에서 확인할 것.
 */
const BANNER_ID = '1032264'; // 파트너스 다이내믹 배너 「쿡매치 레시피 하단」(2026-09-22 생성)
const TRACKING_CODE = 'AF2929738'; // 파트너스 트래킹 코드(간편 링크와 같은 계정)
const BANNER_HEIGHT = 110;
const AD_BOX_BG = '#EFEFF2'; // 광고 상자 배경 — 월 목표 카드(surface-sub)보다 한 단계 진하게 해서 서로 구분
const AD_BOX_PAD_X = 8;

const CoupangDynamicBanner: React.FC<{
  style?: React.CSSProperties;
  /** 배너 높이(px). 조리 시트 안처럼 내용 사이에 끼울 때는 낮게(50) — 기본은 캘린더 맨 아래용 */
  height?: number;
}> = ({ style, height = BANNER_HEIGHT }) => {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    // 배너는 요청한 폭에 맞춰 상품 개수를 정한다 — 실제 자리 폭을 재서 넘긴다
    if (boxRef.current) setWidth(Math.round(boxRef.current.getBoundingClientRect().width) - AD_BOX_PAD_X * 2);
  }, []);

  if (!BANNER_ID) return null;

  const src = 'https://ads-partners.coupang.com/widgets.html?' + new URLSearchParams({
    id: BANNER_ID,
    template: 'carousel',
    trackingCode: TRACKING_CODE,
    subId: '',
    width: String(width || 340),
    height: String(height),
    tsource: '',
  }).toString();

  return (
    <div style={{ marginTop: 20, ...style }}>
      {/* 회색 상자로 감싸 본문과 구분한다(2026-09-22) — 레시피 내용 사이에 끼어 있어서 "중요한 본문인가?"
          싶게 보였다. 대가성 문구도 상자 안에 둬서 이 영역 전체가 광고라는 게 한눈에 보이게. */}
      <div ref={boxRef} style={{ background: AD_BOX_BG, borderRadius: 12, padding: `6px ${AD_BOX_PAD_X}px 8px` }}>
        <FitDisclaimer />
        {width > 0 && (
          <iframe
            title="쿠팡 추천 상품"
            src={src}
            width="100%"
            height={height}
            frameBorder={0}
            scrolling="no"
            referrerPolicy="unsafe-url"
            loading="lazy"
            style={{ display: 'block', border: 0, borderRadius: 8, background: '#FFFFFF' }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * 대가성 문구를 **한 줄로** — 자리 폭에 들어갈 때까지 글씨를 줄인다(11px → 최소 8.5px).
 *
 * 폰(폭 ~340px)에서는 11px 로는 한 줄에 안 들어가 문장 중간 어중간한 곳에서 감겼고, 쉼표 뒤에서 두 줄로
 * 끊어 봤더니 "굳이 두 줄까지?" 라는 의견이라 한 줄 + 작은 글씨로 바꿨다(2026-09-22).
 * 최소 크기에서도 안 들어가는 아주 좁은 화면만 쉼표 뒤에서 두 줄로 내린다 — 문구는 쿠팡 가이드상
 * "쉽게 인식할 수 있어야" 해서 더 작게 만들지는 않는다.
 */
const TEXT_A = '이 광고는 쿠팡 파트너스 활동의 일환으로,';
const TEXT_B = '이에 따른 일정액의 수수료를 제공받습니다.';
const MAX_FONT = 11;
const MIN_FONT = 8.5;

const FitDisclaimer: React.FC = () => {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [font, setFont] = React.useState(MAX_FONT);
  const [wrap, setWrap] = React.useState(false);

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
      let f = MAX_FONT;
      probe.style.fontSize = f + 'px';
      while (probe.offsetWidth > avail && f > MIN_FONT) {
        f -= 0.5;
        probe.style.fontSize = f + 'px';
      }
      setFont(f);
      setWrap(probe.offsetWidth > avail);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const textStyle: React.CSSProperties = { lineHeight: 1.4, letterSpacing: '-0.2px' };
  return (
    <div ref={boxRef} style={{ position: 'relative', margin: '0 0 5px' }}>
      <span ref={measureRef} aria-hidden
            style={{ ...textStyle, position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', left: 0, top: 0 }}>
        {TEXT_A} {TEXT_B}
      </span>
      <p style={{ ...textStyle, margin: 0, fontSize: font, color: 'var(--ink-500)', textAlign: 'center',
                  whiteSpace: wrap ? 'normal' : 'nowrap' }}>
        {TEXT_A}{wrap ? <br /> : ' '}{TEXT_B}
      </p>
    </div>
  );
};

export default CoupangDynamicBanner;
