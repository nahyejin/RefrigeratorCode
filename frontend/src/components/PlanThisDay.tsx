import React from 'react';
import { savePlan, planByDate, clearPlanMeal, conflictingDates, toDateKey } from '../utils/mealPlan';
import { track } from '../utils/track';
import DatePickerField from './DatePickerField';
import Dialog from './ui/Dialog';

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
  /** 이 레시피가 이미 잡혀 있는 날들(저장된 상태). 다시 열었을 때 보여야 한다. */
  const [booked, setBooked] = React.useState<string[]>([]);
  /**
   * 지금 화면에서 고르고 있는 날들 — **아직 저장되지 않는다.**
   *
   * 예전엔 알약을 누르는 즉시 저장했다. 그런데 그 날 다른 요리가 이미
   * 잡혀 있으면 `savePlan(..., 'fill')` 이 조용히 아무것도 안 해서, 눌러도
   * 반응이 없는 것처럼 보였다("선택이 안 되는 퀵버튼이 있다" — 실사용 보고).
   * 겹치는지는 **여러 날을 한꺼번에 고른 뒤에** 물어야 하므로(AI 식단 추천과
   * 같은 방식), 고르는 동안은 로컬 상태에만 담아 두고 「적용하기」를 눌러야
   * 실제로 저장한다.
   */
  const [selected, setSelected] = React.useState<string[]>([]);
  /** 「적용하기」를 눌렀는데 다른 요리와 겹치는 날이 있을 때만 채워진다. */
  const [conflict, setConflict] = React.useState<string[] | null>(null);

  const refresh = React.useCallback(() => {
    const found: string[] = [];
    planByDate().forEach((meals, date) => {
      if (meals.some(m => m.recipeId === recipeId)) found.push(date);
    });
    const sorted = found.sort();
    setBooked(sorted);
    setSelected(sorted);
  }, [recipeId]);

  React.useEffect(refresh, [refresh]);

  const days = React.useMemo(() => choices(), []);

  const toggleKey = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const toggle = (d: Date) => toggleKey(toDateKey(d));

  const short = (key: string) => key.slice(5).replace('-', '/');

  /** 실제로 저장한다. 겹치는 날을 어떻게 할지(`mode`)는 다이얼로그에서 고른다. */
  const commit = (mode: 'overwrite' | 'fill') => {
    const removed = booked.filter(k => !selected.includes(k));
    removed.forEach(k => clearPlanMeal(k, recipeId));
    if (removed.length) track('recipe_action', 'plan_remove');

    const added = selected.filter(k => !booked.includes(k));
    if (added.length) {
      savePlan(added.map(date => ({ date, recipeId, title, link, thumbnail })), mode);
      track('recipe_action', 'plan_add');
    }
    setConflict(null);
    refresh();
  };

  /** 「적용하기」 — 새로 고른 날 중 다른 요리와 겹치는 게 있으면 먼저 물어본다. */
  const apply = () => {
    const added = selected.filter(k => !booked.includes(k));
    const clashDates = conflictingDates(added.map(date => ({ date, recipeId, title, link, thumbnail })));
    if (clashDates.length === 0) { commit('overwrite'); return; }
    setConflict(clashDates);
  };

  const dirty = selected.length !== booked.length || selected.some(k => !booked.includes(k));

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
          onClick={() => {
            // 닫을 때 확정 안 한 선택은 버린다 — 저장은 「적용하기」만 한다.
            if (open) setSelected(booked);
            setOpen(v => !v);
          }}
          style={{
            // 노랑은 이 앱에서 AI 와 주요 실행을 뜻한다. 날짜를 고르는 건
            // 그만큼 무거운 일이 아니라, 다른 보조 버튼과 같은 옷을 입는다.
            flexShrink: 0, minHeight: 32, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--line-200)', background: 'var(--surface)',
            fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
          }}
        >
          {open ? '접기' : booked.length > 0 ? '날짜 고치기' : '날짜 고르기'}
        </button>
      </div>

      {open && (
        <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {days.map((d, i) => {
            const key = toDateKey(d);
            const on = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(d)}
                aria-pressed={on}
                style={{
                  minHeight: 32, padding: '8px 11px', borderRadius: 9999, cursor: 'pointer',
                  border: on ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
                  background: on ? '#FFD600' : 'var(--surface)',
                  fontSize: 12.5, fontWeight: on ? 700 : 500, color: '#1A1A1E',
                }}
              >
                {label(d, i)}
              </button>
            );
          })}

          {/* 알약 열넷은 **가까운 날**을 빨리 누르라고 있다. 그보다 먼 날은
              달력으로 고른다 — 다만 가로로 긴 입력창을 따로 두니 검색창처럼
              보였다. 같은 줄에, 같은 알약 크기로 둔다. */}
          {/* 시스템 달력 대신 우리 달력. 기기마다 다른 달력이 뜨면
              같은 앱에서 날짜를 고르는 방법이 두 가지가 된다. */}
          <DatePickerField
            value=""
            onChange={v => { if (v) toggleKey(v); }}
            placeholder="다른 날짜"
            minDate={new Date()}
            style={{ minHeight: 32, borderRadius: 9999, borderStyle: 'dashed' }}
          />
        </div>

        {/* 예전엔 알약을 누르는 즉시 저장했다. 여러 날을 한꺼번에 고르고
            나서 겹치는 날이 있는지 한 번에 물어보려면(바로 아래 다이얼로그)
            "다 고른 다음 확정" 하는 순간이 따로 있어야 한다. */}
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          style={{
            width: '100%', minHeight: 40, marginTop: 10, borderRadius: 10, border: 'none',
            background: dirty ? '#FFD600' : 'var(--line-200)',
            color: dirty ? '#1A1A1E' : 'var(--ink-500)',
            fontSize: 13.5, fontWeight: 700, cursor: dirty ? 'pointer' : 'default',
          }}
        >
          적용하기
        </button>
        </>
      )}

      {/* 겹치는 날이 있을 때만 뜬다 — AI 식단 추천(WeeklyPlan)과 같은 문구·구조.
          이 컴포넌트는 레시피 상세를 여는 시트(CookModeSheet) 안에 있어서,
          그 시트보다 한 층 위(`nested`)에 올려야 뒤에 숨지 않는다. */}
      {conflict && (
        <Dialog
          open
          onClose={() => setConflict(null)}
          title="이미 짜 둔 계획이 있어요"
          width={340}
          dismissLabel="그만두기"
          nested
        >
          <div style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7, textAlign: 'left' }}>
            <b>{conflict.length}일</b>에 다른 요리가 있어요 ·{' '}
            {conflict.slice(0, 3).map(d => d.slice(5).replace('-', '/')).join(', ')}
            {conflict.length > 3 && ` 외 ${conflict.length - 3}일`}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => commit('overwrite')}
                style={{
                  minHeight: 46, borderRadius: 10, border: 'none', background: '#FFD600',
                  color: '#1A1A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                겹치는 날도 이걸로 바꾸기
              </button>
              <button
                type="button"
                onClick={() => commit('fill')}
                style={{
                  minHeight: 46, borderRadius: 10, background: 'var(--surface)',
                  border: '1px solid var(--line-200)',
                  color: '#1A1A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                겹치는 날은 빼고 나머지만
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
};

export default PlanThisDay;
