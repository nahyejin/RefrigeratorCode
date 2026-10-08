import * as React from 'react';
import Sheet from './ui/Sheet';
import ExpiryAlert from './ExpiryAlert';
import PlanButtons from './PlanButtons';
import { splitExpiring, daysLabel, type FridgeItem } from '../utils/expiry';
import type { CategoryMap, StorageKind } from '../utils/shelfLife';

/**
 * 내냉장고 「내 냉장고 재고 관리」 머리줄 바로 아래의 **한 줄 띠** —
 * "곧 상해요 N개 ›". 누르면 시트가 열려 어떤 재료가 며칠 남았는지 보이고,
 * 그 재료로 식단을 짜는 버튼이 같이 있다.
 *
 * 왜 화면 맨 위가 아닌가(2026-10-08):
 *   맨 위(재료 추가 입력창보다도 위)에 뒀더니 화면에 들어서자마자 경고가 먼저
 *   맞이해서 어색했다. 이 띠는 **재고에 대한 말**이라, 재고를 말하기 시작하는
 *   자리(`내 냉장고 재고 관리`) 바로 아래에 있어야 앞뒤가 맞는다.
 *
 * 왜 카드가 아니라 띠인가(2026-10-08):
 *   임박 재료 카드를 마이캘린더에서 내냉장고로 옮기되, 내냉장고는 재료를
 *   관리하는 화면이라 긴 카드를 얹으면 재료 목록이 아래로 밀린다. 그래서 눈에
 *   띄는 한 줄만 두고 이름 목록은 눌러서 본다. 어느 칸에 있는지는 각 보관함
 *   머리줄의 `임박 N` 표시가 말한다.
 * 임박한 게 없으면 아무것도 그리지 않는다 — 늘 뭔가 있으면 그게 배경이 된다.
 */
const ExpiryBand: React.FC<{
  boxes: Partial<Record<StorageKind, FridgeItem[]>>;
  categoryMap: CategoryMap;
  /** 이미 폭과 여백이 잡힌 자리에 넣을 때. 바깥 래퍼(maxWidth·좌우 여백)를 뺀다. */
  bare?: boolean;
  /**
   * `chip` — 보관함 상자 제목 줄 오른쪽에 놓는 **작은 알림**(`! 곧 상해요 3개`).
   * 띠(44px)는 화면을 더 먹는다는 지적(2026-10-09)으로, 제목 줄 한쪽에 얹을 수
   * 있게 한 모양을 더했다. 누르면 같은 시트가 열린다.
   */
  variant?: 'band' | 'chip';
}> = ({ boxes, categoryMap, bare, variant = 'band' }) => {
  const [open, setOpen] = React.useState(false);
  const { soon } = React.useMemo(() => splitExpiring(boxes, categoryMap), [boxes, categoryMap]);
  if (soon.length === 0) return null;

  const past = soon.filter(i => i.days < 0);
  const worst = soon[0];
  const title = past.length > 0
    ? `유통기한이 지난 재료 ${past.length}개`
    : `곧 상해요 ${soon.length}개`;

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} title="곧 상해요" maxHeight="80dvh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ExpiryAlert bare boxes={boxes} categoryMap={categoryMap} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', marginBottom: 8 }}>
            이 재료로 이번 주 식단 짜기
          </div>
          <PlanButtons onBeforeGo={() => setOpen(false)} />
        </div>
      </div>
    </Sheet>
  );

  if (variant === 'chip') {
    // 색은 띠와 같은 값(#FFF1EF 면 · #C4342B 글자) — 같은 이야기면 같은 색.
    const chipText = past.length > 0 ? `기한 지남 ${past.length}개` : `곧 상해요 ${soon.length}개`;
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={title}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
            padding: '3px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#FFF1EF', color: '#C4342B', fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14, height: 14, borderRadius: 9999, background: '#C4342B', color: '#FFFFFF',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, lineHeight: 1,
            }}
          >
            !
          </span>
          {chipText}
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1, marginLeft: -1 }}>›</span>
        </button>
        {sheet}
      </>
    );
  }

  return (
    <>
      {/* 띠가 없을 땐 이 여백도 없어야 한다 — 그래서 여백을 바깥 화면이 아니라 여기서 둔다. */}
      <div style={bare
        ? { marginBottom: 12 }
        : { maxWidth: 400, margin: '0 auto 20px', padding: '0 20px', boxSizing: 'border-box' }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%', minHeight: 44, boxSizing: 'border-box', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
          // 바로 아래 보관함 머리줄(냉동·냉장·실온)과 **다른 종류의 것**으로 보여야
          // 한다. 흰 면에 검은 글씨로 뒀더니 보관함 하나가 더 있는 것처럼 읽혔다
          // (2026-10-08). 그래서 면·글자·글자색을 모두 달리 가져간다:
          //   보관함 머리줄 = 흰 배경 + 16px 검정 굵은 글씨(화면의 구조)
          //   이 띠        = 옅은 빨강 면 + 13.5px 빨간 글씨(지금 급한 소식)
          // 색값은 새로 만들지 않고 재료 알약의 `임박` 배지와 같은 것을 쓴다
          // (배경 #FFE7E4 · 글자 #C4342B) — 같은 이야기면 같은 색이어야 한다.
          padding: '8px 14px', background: '#FFF1EF',
          border: '1px solid #F6D5D1',
          // 왼쪽 표시는 **언제나 빨강**이다. 노랑은 이 앱에서 브랜드색(AI·강조)이라
          // "여기를 눌러 보라" 로 읽히고, 상하기 직전이라는 경고로는 안 읽힌다.
          // 지난 것과 임박한 것의 구분은 색이 아니라 문구(`유통기한이 지난 재료`)가 한다.
          borderLeft: '4px solid #C4342B',
          borderRadius: 12,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#C4342B', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 12, color: '#9B6B66',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {worst.name} {daysLabel(worst.days, worst.estimated)}
        </span>
        <span aria-hidden style={{ color: '#C4342B', fontSize: 18, lineHeight: 1 }}>›</span>
      </button>
      </div>

      {sheet}
    </>
  );
};

export default ExpiryBand;
