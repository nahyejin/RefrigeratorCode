import React from 'react';
import { plannedTitlesOn, shortDate } from '../utils/mealPlan';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 「이미 짜 둔 계획이 있어요」 확인창의 본문 — 레시피 시트와 식단 추천(AI·일반)이 같이 쓴다.
 *
 * 예전 문구는 「1일에 다른 요리가 있어요」처럼 **며칠인지가 아니라 몇 일인지**를 말해서
 * 1일(첫째 날)로 읽혔고, 그 아래 `10/14 · 제목…` 은 그게 요리 이름인지 알기 어려웠다
 * (2026-10-14 사용자 지적). 날짜를 정확히 적고, 날짜마다 「이미 계획한 요리」를 따로 보여 준다.
 */
const PlanConflictSummary: React.FC<{ dates: string[] }> = ({ dates }) => {
  const rows = plannedTitlesOn(dates);
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-900)', lineHeight: 1.6 }}>
        <b>{rows.map(r => shortDate(r.date)).join(', ')}</b>에 이미 계획한 요리가 있어요.
      </div>
      <div style={{
        marginTop: 10, border: '1px solid var(--line-200)', borderRadius: 10,
        background: 'var(--surface-sub)', maxHeight: 180, overflowY: 'auto',
      }}>
        {rows.map((r, i) => (
          <div key={r.date} style={{
            display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'baseline',
            borderTop: i ? '1px solid var(--line-200)' : 'none',
          }}>
            <span style={{
              flexShrink: 0, minWidth: 58, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {shortDate(r.date)} ({DAY_NAMES[new Date(`${r.date}T00:00:00`).getDay()]})
            </span>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.titles.map(t => (
                <span key={t} style={{
                  fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.45,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanConflictSummary;
