import * as React from 'react';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { trackCoupangClick } from '../utils/trackCoupangClick';
import CoupangDisclaimer from './CoupangDisclaimer';

interface CoupangAdCardProps {
  /** 광고할 재료 (바로 앞 레시피 카드의 부족 재료 중 하나) */
  ingredient: string;
  /** 광고를 고른 근거가 된 레시피 — 측정용 */
  recipeId?: number;
  lackingCount?: number;
  width: number | string;
  height: number | string;
}

/**
 * 목록 안에 레시피 카드와 **같은 규격**으로 끼워 넣는 쿠팡 광고 카드.
 *
 * 왜 카드로 만드는가:
 *   예전에는 레시피 카드 하단에 CTA 버튼을 붙였는데,
 *   - 버튼이 있는 카드와 없는 카드의 높이가 달라져 가로 캐러셀의 고정 높이가 깨졌고
 *     (실측: 슬롯 286px 인데 실제 카드는 236~239px → 카드마다 47px 이 빈 채로 남음)
 *   - 자리를 항상 예약하면 광고가 없는 카드에 빈 공간이 생겼다.
 *   카드 한 장을 통째로 광고로 쓰면 높이가 흔들리지 않고, 광고임을 분명히 밝힐 수 있다.
 *
 * 정책상 지킨 것 (쿠팡 파트너스 이용 가이드 STEP 7):
 *   - **광고임을 먼저 밝힌다.** 대가성 문구를 카드의 첫 부분에 둔다
 *     (가이드: "문구는 게시물의 제목 또는 첫 부분에 기재")
 *   - **커버형 배너 금지**: 광고 위에 "밀어서 확인" 같은 문구나, 조작을 연상시키는
 *     장치를 덧씌워 클릭을 유도하지 않는다. 카드 안에는 광고 표시와 구매 버튼만 둔다.
 *     (캐러셀 좌우 화살표는 광고 이전부터 있던 목록 이동 장치이고 모든 카드에 동일하게
 *      적용되며, 세로 위치가 달라 이 카드의 구매 버튼을 덮지 않는다)
 *   - **자동실행 금지**: 카드를 지나가는 것만으로는 아무 일도 일어나지 않고,
 *     사용자가 버튼을 눌렀을 때만 쿠팡으로 이동한다
 *   - 쿠팡 로고·BI 는 쓰지 않고 상호명만 글자로 표기한다 (지식재산권 조항)
 */
const CoupangAdCard: React.FC<CoupangAdCardProps> = ({ ingredient, recipeId, lackingCount, width, height }) => {
  const url = resolveCoupangUrl(ingredient);

  // 연결할 상품이 없으면 빈 카드를 남기지 않고 아예 렌더하지 않는다
  if (!url) return null;

  return (
    <div
      style={{
        width,
        height,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        borderRadius: 14,
        background: 'var(--surface-sub)',
        border: '1px solid var(--line-200)',
      }}
    >
      {/* 광고임을 가장 먼저 밝힌다 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 20,
            padding: '0 7px',
            borderRadius: 5,
            background: 'var(--ink-900)',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          광고
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>쿠팡 파트너스</span>
      </div>

      {/* 대가성 문구는 카드의 **첫 부분** 에 — 구매 버튼을 누르기 전에 보이도록 */}
      <CoupangDisclaimer compact style={{ marginBottom: 14 }} />

      {/* 예전엔 "앞 레시피에 부족한 재료" 라고 적었는데, 이건 우리가 이 재료를 고른
          **내부 규칙**이지 사용자가 알아야 할 정보가 아니다.
          사용자에게 필요한 건 "무엇에 대한 광고인가" 하나뿐이라 재료명만 남긴다.

          위아래로 여백을 똑같이 나눠 재료명을 카드 가운데에 둔다
          (아래로만 밀면 문구와 버튼 사이가 텅 비어 보인다) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ink-900)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ingredient}
        </div>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackCoupangClick({
            source: 'feed_card',
            ingredient,
            lackingCount,
            recipeId,
            page: window.location.pathname,
          });
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 44,
          borderRadius: 10,
          background: 'var(--surface)',
          border: '1px solid var(--line-300)',
          color: 'var(--ink-900)',
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        쿠팡에서 보기
      </a>
    </div>
  );
};

export default CoupangAdCard;
