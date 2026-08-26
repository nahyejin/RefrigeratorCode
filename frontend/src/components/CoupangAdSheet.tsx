import * as React from 'react';
import Sheet from './ui/Sheet';
import Button from './ui/Button';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { trackCoupangClick } from '../utils/trackCoupangClick';

interface CoupangAdSheetProps {
  /** 열려 있을 재료명. null 이면 닫힘 */
  ingredient: string | null;
  onClose: () => void;
  /** 측정용 — 이 광고가 뜬 레시피 */
  recipeId?: number;
  lackingCount?: number;
}

/**
 * 부족 재료를 눌렀을 때 뜨는 구매 안내 시트.
 *
 * 왜 바로 쿠팡으로 보내지 않는가:
 *   예전에는 부족 재료 pill 을 누르면 곧바로 쿠팡으로 창이 열렸다.
 *   그런데 pill 은 화면에서 "이 레시피에 없는 재료" 를 알려주는 **정보 표시**로 보인다.
 *   누르는 사람은 재료 설명이나 대체재를 기대하지, 광고를 클릭한다고 생각하지 않는다.
 *
 *   쿠팡 파트너스 운영정책은 광고 클릭이 "사용자가 그 클릭을 의도했을 경우에만
 *   발생할 것" 을 전제로 하고, 의도에 반하는 클릭 유도를 금지하고 있다.
 *   (이용 가이드 STEP 7 — 자동실행 금지)
 *   그래서 pill 은 **광고를 보여주기만** 하고, 쿠팡으로 나가는 클릭은
 *   여기서 사용자가 직접 누르게 한다.
 *
 * 고지 문구를 이 안에도 넣는 이유:
 *   가이드는 대가성 문구를 "게시물의 제목 또는 첫 부분" 에 두라고 안내한다.
 *   이 시트는 그 자체로 광고가 노출되는 화면이므로, 구매 버튼보다 위에 문구를 둔다.
 */
const CoupangAdSheet: React.FC<CoupangAdSheetProps> = ({ ingredient, onClose, recipeId, lackingCount }) => {
  if (!ingredient) return null;

  const url = resolveCoupangUrl(ingredient);

  const handleBuy = () => {
    if (!url) return;
    trackCoupangClick({
      source: 'pill',
      ingredient,
      lackingCount,
      recipeId,
      page: window.location.pathname,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="부족한 재료 구매">
      <div style={{ paddingBottom: 4 }}>
        {/* 대가성 문구는 광고보다 위에 — 가이드가 "첫 부분" 을 요구한다 */}
        <p
          style={{
            margin: 0,
            marginBottom: 14,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--ink-400)',
            wordBreak: 'keep-all',
          }}
        >
          이 안내는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--surface-sub)',
            marginBottom: 16,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-400)', marginBottom: 2 }}>이 레시피에 부족한 재료</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--ink-900)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ingredient}
            </div>
          </div>
        </div>

        {url ? (
          <Button variant="primary" size="lg" block onClick={handleBuy}>
            쿠팡에서 {ingredient} 보기
          </Button>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-500)', textAlign: 'center', padding: '10px 0' }}>
            지금은 연결된 상품이 없어요.
          </p>
        )}
      </div>
    </Sheet>
  );
};

export default CoupangAdSheet;
