import * as React from 'react';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { preloadCoupangAds } from '../utils/recipeUtils';
import { trackCoupangClick } from '../utils/trackCoupangClick';
import CoupangDisclaimer from './CoupangDisclaimer';

interface CoupangAdCardProps {
  ingredient: string;
  recipeId?: number;
  lackingCount: number;
  width: number | string;
  /**
   * 높이. 가로 캐러셀에서는 옆 레시피 카드와 같은 칸을 채워야 줄이 안 깨져서
   * 준다. 세로 목록에서는 줄 이유가 없다 — 내용만큼만 쓴다.
   */
  height?: number | string;
}

/** 바깥으로 나간다는 표시. 눌러서 쿠팡으로 넘어간다는 걸 글자 옆에서 알린다. */
const ExternalArrow = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{ flexShrink: 0 }}
  >
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

/**
 * 레시피 목록 사이에 끼우는 쿠팡 광고.
 *
 * ── 왜 카드가 아니라 한 줄인가 (2026-09-09) ──────────────────────────
 *
 * 원래는 테두리 있는 회색 카드였다. **상품 이미지가 언젠가 들어올 자리**를
 * 비워 두고 잡은 크기였는데, 이미지는 못 넣는다 — 파트너스 간편 링크는 URL 만
 * 주고, 이미지·가격을 가져오려면 최종 승인이 필요한 Open API 가 있어야 한다.
 *
 * 그래서 **상품 카드인 척하는데 상품이 없는** 모양이 됐다. 만들다 만 것처럼
 * 보이고, 게다가 레시피 카드와 같은 테두리·같은 크기라 **목록의 한 항목**처럼
 * 읽혔다. 광고는 항목이 아니라 사이에 끼운 안내다.
 *
 * 이미지 없이 링크만 있는 광고는 원래 이렇게 붙인다 — 본문에 녹는 한 줄.
 * 테두리도 배경도 없다(위아래 선까지 뺐다 — 선이 있으면 결국 상자로 읽힌다).
 * 재료 이름도 22px 로 크게 외칠 이유가 없어 문장 안에 넣었다.
 *
 * **두 화면이 같은 모양이다.** 세로 목록(냉장고요리)과 가로 캐러셀(요즘인기)이
 * 다른 점은 `height` 뿐이다 — 캐러셀은 옆 카드와 같은 칸을 채워야 해서 높이를
 * 받는다.
 *
 * **「광고」 배지와 대가성 문구는 그대로 둔다.** 눈에 덜 띄게 만드는 것과
 * 광고임을 감추는 것은 다르다. 누르기 전에 보여야 한다.
 */
const CoupangAdCard: React.FC<CoupangAdCardProps> = ({
  ingredient,
  recipeId,
  lackingCount,
  width,
  height,
}) => {
  /**
   * **광고 CSV 를 이 카드가 직접 읽는다.**
   *
   * `resolveCoupangUrl()` 은 미리 읽어 둔 캐시를 볼 뿐 스스로 읽지 않는다.
   * 읽는 코드는 목록에서 안 쓰는 `CoupangProductAd` 안에만 있었고
   * `preloadCoupangAds()` 는 아무도 부르지 않아서, 링크를 249개 채워도
   * 화면에는 **파트너스 링크가 아니라 그냥 쿠팡 검색**이 붙었다.
   */
  const [adsReady, setAdsReady] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    preloadCoupangAds()
      .then(() => { if (alive) setAdsReady(true); })
      .catch(() => { /* 못 읽으면 검색 링크로 남는다 */ });
    return () => { alive = false; };
  }, []);

  const url = React.useMemo(
    () => resolveCoupangUrl(ingredient),
    // `adsReady` 가 바뀌면 다시 계산한다 — 그때 캐시가 채워져 있다.
    [ingredient, adsReady]
  );

  // **다 읽기 전에는 그리지 않는다.** 먼저 그리면 그 순간의 링크는 파트너스
  // 것이 아니라 그냥 쿠팡 검색이라, 그 사이에 누르면 수수료가 안 붙는다.
  if (!adsReady) return null;

  // 연결할 상품이 없으면 빈 자리를 남기지 않고 아예 렌더하지 않는다
  if (!url) return null;

  const onClick = () => {
    trackCoupangClick({
      source: 'feed_card',
      ingredient,
      lackingCount,
      recipeId,
    });
  };

  const badge = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 18,
          padding: '0 6px',
          borderRadius: 4,
          background: 'var(--ink-900)',
          color: '#FFFFFF',
          fontSize: 10.5,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        광고
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>쿠팡 파트너스</span>
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        boxSizing: 'border-box',
        // **테두리도 배경도 없다.**
        //
        // 원래는 테두리 있는 회색 카드였다. 상품 이미지가 언젠가 들어올 자리를
        // 비워 두고 잡은 크기였는데 이미지는 못 넣는다 — 간편 링크는 URL 만
        // 준다. 그래서 상품 카드인 척하는데 상품이 없는 모양이 됐고, 레시피
        // 카드와 같은 테두리라 **목록의 한 항목**처럼 읽혔다.
        // 광고는 항목이 아니라 사이에 끼운 안내다.
        padding: height ? 16 : '14px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {badge}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          // **검정 글자로 둔다.**
          //
          // 링크를 파란색으로 하면 "바깥으로 나간다" 는 게 더 분명하지만,
          // 이 앱은 이미 노랑·초록·빨강이 많이 쓰여 색을 하나 더 들이면
          // 목록이 시끄러워진다. 바깥으로 나가는 신호는 **화살표**가 맡는다.
          color: 'var(--ink-900)',
          fontSize: 15,
          fontWeight: 700,
          textDecoration: 'none',
          maxWidth: '100%',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {ingredient} 쿠팡에서 보기
        </span>
        <ExternalArrow />
      </a>

      {/* 대가성 문구는 **누르기 전에** 보여야 한다 */}
      <CoupangDisclaimer compact />
    </div>
  );
};

export default CoupangAdCard;
