import React from 'react';
import { savePlan, planByDate, clearPlanMeal, toDateKey } from '../utils/mealPlan';
import { track } from '../utils/track';

/**
 * "이 요리 언제 해먹지" 를 그 자리에서 정한다.
 *
 * 왜 필요한가:
 *   계획은 `이번 주 식단 추천` 을 거쳐야만 세울 수 있었다. 그런데 사람이 요리를
 *   정하는 순간은 그 화면이 아니라 **레시피를 보고 있을 때**다. 냉장고요리나
 *   요즘인기를 넘기다 "이건 금요일에 해먹자" 가 되는데, 그걸 담아 둘 자리가
 *   없어서 그 생각이 그냥 사라졌다.
 *
 * 왜 즐겨찾기로 안 되나:
 *   즐겨찾기는 **언젠가** 할 것이고 계획은 **언제** 할 것이다. 둘은 다르다.
 *   즐겨찾기만 있으면 목록이 쌓이기만 하고 그 다음이 없다.
 *
 * 왜 카드가 아니라 여기인가:
 *   카드는 그리드에 촘촘히 놓여 훑는 자리다. 날짜 고르개까지 붙으면 무거워지고,
 *   훑는 중에는 아직 정하는 중이 아니다. 시트를 연 순간이 이미 "이거 해먹을까"
 *   를 판단하는 자리다.
 */

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** 오늘부터 14일. 그보다 먼 계획은 세워 봐야 안 지킨다. */
function choices(count = 14): Date[] {
  const base = new Date();
  return Array.from({ length: count }, (_, i) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
}

function label(d: Date, i: number): string {
  if (i === 0) return '오늘';
  if (i === 1) return '내일';
  if (i === 2) return '모레';
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`;
}

interface Props {
  recipeId: number;
  title: string;
  link?: string;
  thumbnail?: string;
}

const PlanThisDay: React.FC<Props> = ({ recipeId, title, link, thumbnail }) => {
  const [open, setOpen] = React.useState(false);
  /** 이 레시피가 이미 잡혀 있는 날들. 다시 열었을 때 보여야 한다. */
  const [booked, setBooked] = React.useState<string[]>([]);

  const refresh = React.useCallback(() => {
    const found: string[] = [];
    planByDate().forEach((meals, date) => {
      if (meals.some(m => m.recipeId === recipeId)) found.push(date);
    });
    setBooked(found.sort());
  }, [recipeId]);

  React.useEffect(refresh, [refresh]);

  const days = React.useMemo(() => choices(), []);
  /** 달력에서 직접 고른 날짜. */
  const [pick, setPick] = React.useState('');

  const toggleKey = (key: string) => {
    if (booked.includes(key)) {
      clearPlanMeal(key, recipeId);
      track('recipe_action', 'plan_remove');
    } else {
      // 그 날 이미 잡아 둔 다른 요리는 **건드리지 않는다.** 하루에 여러 끼를
      // 할 수 있고, 여기서 하나 더하는 것이 남의 계획을 지울 이유는 없다.
      savePlan([{ date: key, recipeId, title, link, thumbnail }], 'fill');
      track('recipe_action', 'plan_add');
    }
    refresh();
  };

  const toggle = (d: Date) => toggleKey(toDateKey(d));

  const short = (key: string) => key.slice(5).replace('-', '/');

  return (
    <section style={{
      border: '1px solid var(--line-200)', borderRadius: 12, padding: '12px 14px',
      background: 'var(--surface-sub)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
            언제 해먹을까요?
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
            {booked.length > 0
              ? `${booked.map(short).join(', ')}에 하기로 했어요`
              : '고른 날짜가 요리 캘린더에 남아요'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          style={{
            // 노랑은 이 앱에서 AI 와 주요 실행을 뜻한다. 날짜를 고르는 건
            // 그만큼 무거운 일이 아니라, 다른 보조 버튼과 같은 옷을 입는다.
            flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 8,
            border: '1px solid var(--line-200)', background: 'var(--surface)',
            fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
          }}
        >
          {open ? '접기' : booked.length > 0 ? '날짜 고치기' : '날짜 고르기'}
        </button>
      </div>

      {open && (
        <>
        {/* 달력에서 직접 고르는 길. 알약 열넷은 **가까운 날**을 빨리 누르라고
            있는 것이고, 그보다 먼 날이나 정확한 날짜는 이쪽이 빠르다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <input
            type="date"
            value={pick}
            min={toDateKey(new Date())}
            onChange={e => setPick(e.target.value)}
            style={{
              flex: 1, minWidth: 0, height: 34, borderRadius: 8,
              border: '1px solid var(--line-200)', padding: '0 10px',
              fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)',
            }}
          />
          <button
            type="button"
            disabled={!pick}
            onClick={() => { if (pick) { toggleKey(pick); setPick(''); } }}
            style={{
              flexShrink: 0, height: 34, padding: '0 12px', borderRadius: 8, border: 'none',
              background: pick ? '#1A1A1E' : 'var(--line-200)',
              color: pick ? '#FFFFFF' : 'var(--ink-500)',
              fontSize: 12.5, fontWeight: 700, cursor: pick ? 'pointer' : 'default',
            }}
          >
            {pick && booked.includes(pick) ? '빼기' : '넣기'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {days.map((d, i) => {
            const key = toDateKey(d);
            const on = booked.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(d)}
                aria-pressed={on}
                style={{
                  height: 32, padding: '0 11px', borderRadius: 9999, cursor: 'pointer',
                  border: on ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
                  background: on ? '#FFD600' : 'var(--surface)',
                  fontSize: 12.5, fontWeight: on ? 700 : 500, color: '#1A1A1E',
                }}
              >
                {label(d, i)}
              </button>
            );
          })}
        </div>
        </>
      )}
    </section>
  );
};

export default PlanThisDay;
