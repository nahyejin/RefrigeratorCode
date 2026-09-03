import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import Dialog from '../components/ui/Dialog';
import StepLoading from '../components/StepLoading';
import { getMyIngredients } from '../utils/recipeUtils';
import { loadIngredientCategoryMap, type CategoryMap, type StorageKind } from '../utils/shelfLife';
import { splitExpiring, daysLabel, SOON_DAYS, STALE_AFTER_DAYS,
         type FridgeItem, type ExpiringItem } from '../utils/expiry';
import { openCookMode } from '../utils/cookMode';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { track } from '../utils/track';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { usageHeaders, applyUsage } from '../utils/usage';
import { UsageLine, useUsage } from '../components/UsageMeter';
import { savePlan, conflictingDates, toDateKey, type PlannedMeal } from '../utils/mealPlan';

/**
 * 이번 주 식단 + 장보기 목록.
 *
 * 왜 한 화면인가:
 *   장보기 목록은 식단에서 **나온다.** 무엇을 만들지 정해야 무엇이 부족한지
 *   나온다. 두 화면으로 나누면 사용자가 같은 걸 두 번 정하게 된다.
 *
 * 두 가지 방식이 있다:
 *   - **기본(무료)** — 매칭률로 줄 세우고 겹치는 요리를 걸러 내는 규칙.
 *     다시 짜기·바꾸기·요일 옮기기 전부 공짜다
 *   - **AI(크레딧)** — "담백하게", "아이 먹을 것 위주로" 같은 **말을 받는다.**
 *     규칙으로는 못 받는 것이고, 그래서 크레딧을 쓴다
 */

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const PLAN_DAYS = 7;

interface PlanRecipe {
  id: number;
  title: string;
  link: string;
  thumbnail?: string;
  used_ingredients?: string;
  ingredients?: string[];
  match_rate?: number;
  /** AI 가 이 날 이걸 고른 이유 */
  why?: string;
}

/**
 * 한 칸 = 하루. **여러 끼가 올 수 있다.**
 *
 * 예전엔 `recipe: PlanRecipe | null` 하나였다. 그래서 요일을 옮기는 일이
 * "두 칸을 맞바꾸기" 밖에 될 수 없었고, 토요일 것을 일요일로 옮기면 일요일
 * 것이 토요일로 밀려났다. 실제로는 하루에 두세 개를 해 먹을 수도, 아무것도
 * 안 할 수도 있어야 한다.
 */
interface Meal {
  recipe: PlanRecipe;
  /** 장보기·반영에 넣을지. 끼니마다 따로 끈다. */
  on: boolean;
}

interface Slot {
  date: Date;
  meals: Meal[];
}

/**
 * 내냉장고가 쓰는 그 자리에서 보관함 세 칸을 읽는다.
 * 키 이름을 새로 정하지 않는다 — 다르게 적으면 재료가 있는데도 안 뜬다.
 */
function readBoxes(): Partial<Record<StorageKind, FridgeItem[]>> {
  const empty = { frozen: [], fridge: [], room: [] };
  try {
    const raw = localStorage.getItem('myfridge_ingredients');
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const pick = (v: unknown) => (Array.isArray(v) ? (v as FridgeItem[]) : []);
    return { frozen: pick(data?.frozen), fridge: pick(data?.fridge), room: pick(data?.room) };
  } catch {
    return empty;
  }
}

/**
 * **내일부터** 7일.
 *
 * 오늘을 넣으면 이미 저녁이 지난 경우가 많아 첫 칸이 버려진다.
 * 수요일에 짜면 목~수가 된다.
 */
function nextDays(count = PLAN_DAYS): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 1; i <= count; i++) {
    out.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }
  return out;
}

const dayLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`;

const ingredientsOf = (r: PlanRecipe): string[] =>
  r.ingredients ?? (r.used_ingredients || '').split(',').map(x => x.trim()).filter(Boolean);

/**
 * 후보에서 서로 안 겹치는 것들을 골라 칸에 채운다.
 *
 * 매칭률만 보고 위에서부터 자르면 **비슷한 요리가 줄줄이 나온다**(김치찌개,
 * 김치볶음밥, 김치전…). 한 주 식단으로는 쓸 수 없다.
 */
function pickDistinct(pool: PlanRecipe[], count: number): PlanRecipe[] {
  const chosen: PlanRecipe[] = [];
  const taken = new Set<number>();
  const used = new Set<string>();

  // 1차 — 재료가 절반 넘게 겹치면 건너뛴다.
  for (const r of pool) {
    if (chosen.length >= count) break;
    const ings = ingredientsOf(r);
    const overlap = ings.filter(x => used.has(x)).length;
    if (chosen.length > 0 && ings.length > 0 && overlap >= Math.ceil(ings.length / 2)) continue;
    chosen.push(r);
    taken.add(r.id);
    ings.forEach(x => used.add(x));
  }

  // 2차 — **빈 칸을 남기지 않는다.**
  //
  // 겹침 규칙만 돌리면 후보가 적을 때 7일 중 3일이 비어 버린다. 비슷한 요리가
  // 하루 더 들어오는 것이, 그 날 칸이 텅 비어 있는 것보다 낫다.
  if (chosen.length < count) {
    for (const r of pool) {
      if (chosen.length >= count) break;
      if (taken.has(r.id)) continue;
      chosen.push(r);
      taken.add(r.id);
    }
  }
  return chosen;
}

/**
 * 날짜 고르개.
 *
 * 원래 `<select>` 였는데, 안드로이드 웹뷰에서 **네이티브 폼 컨트롤이 고정된
 * 하단 탭(GNB) 위로 그려진다.** 페이지를 내리면 날짜 칸이 탭을 덮어 버렸다.
 * z-index 로는 못 이긴다 — 네이티브 위젯이라 우리 쌓임 맥락 밖에 있다.
 * 그래서 평범한 버튼 + 우리가 그리는 목록으로 바꾼다.
 */
const DayPicker: React.FC<{
  value: number;
  days: Date[];
  onPick: (j: number) => void;
}> = ({ value, days, onPick }) => {
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
    };
  }, [open]);

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%', height: 30, borderRadius: 8, cursor: 'pointer',
          border: '1px solid var(--line-200)', background: 'var(--surface-sub)',
          fontSize: 12, fontWeight: 700, color: '#1A1A1E',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          padding: 0,
        }}
      >
        {dayLabel(days[value])}
        <span aria-hidden style={{ fontSize: 9, color: 'var(--ink-500)' }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%',
            zIndex: 'var(--z-dropdown)' as any,
            background: 'var(--surface)', border: '1px solid var(--line-200)',
            borderRadius: 10, padding: 4, boxShadow: '0 8px 20px rgba(0,0,0,.12)',
          }}
        >
          {days.map((d, j) => (
            <button
              key={j}
              type="button"
              role="option"
              aria-selected={j === value}
              onClick={() => { onPick(j); setOpen(false); }}
              style={{
                display: 'block', width: '100%', height: 30, borderRadius: 7,
                border: 'none', background: j === value ? '#FFF8CC' : 'transparent',
                fontSize: 12.5, fontWeight: j === value ? 700 : 500,
                color: '#1A1A1E', cursor: 'pointer', textAlign: 'left', padding: '0 8px',
                whiteSpace: 'nowrap',
              }}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 영역 제목.
 *
 * 앱의 다른 화면(장보기 목록 등)과 **같은 생김새**를 쓴다.
 *
 * 한때 이 자리에 1·2·3 숫자를, 그다음엔 아이콘 배지를 찍었다. 둘 다 이 화면만
 * 다른 화면과 다르게 보이게 만들었고, 배지 자체가 무슨 뜻인지도 알 수 없었다.
 * 영역을 나누는 건 제목과 카드 경계가 이미 하는 일이다.
 */
const SectionHead: React.FC<{
  title: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
}> = ({ title, hint, right }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <h2 style={{
        fontSize: 15, fontWeight: 700, margin: 0, color: '#1A1A1E',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>{title}</h2>
      {hint && (
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
    {right}
  </div>
);

/**
 * 재료 한 개. 누르면 이번 주 식단에서 **뺐다 넣었다** 한다.
 *
 * 뺀 재료를 목록에서 지우지 않고 취소선만 긋는 이유: 지우면 되돌릴 자리가
 * 사라진다. 잘못 눌렀을 때 같은 자리를 다시 누르면 돌아와야 한다.
 *
 * 색은 세 단계 — `priority`(곧 상해서 먼저 써야 함, 진한 amber) >
 * 보통(연한 yellow) > `warn`(너무 지나서 기본 제외, pink). 전엔 priority와
 * 보통이 같은 연한 yellow라 펼쳤을 때 뭐가 급한 건지 색만 보고는 몰랐다.
 */
const IngredientChip: React.FC<{
  label: string; on: boolean; warn?: boolean; priority?: boolean; onToggle: () => void;
}> = ({ label, on, warn, priority, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={on}
    style={{
      fontSize: 12, padding: '5px 10px', borderRadius: 9999, cursor: 'pointer',
      lineHeight: 1.4,
      border: on ? `1px solid ${warn ? '#B03A28' : priority ? '#B8860B' : '#1A1A1E'}` : '1px dashed var(--line-200)',
      background: on ? (warn ? '#FBE3E0' : priority ? '#FFE066' : '#FFF8CC') : 'var(--surface-sub)',
      color: on ? (warn ? '#B03A28' : '#7A5C00') : 'var(--ink-500)',
      textDecoration: on ? 'none' : 'line-through',
      fontWeight: on ? 700 : 500,
    }}
  >
    {label}
  </button>
);

const WeeklyPlan: React.FC = () => {
  const navigate = useNavigate();
  const usage = useUsage();
  const [categoryMap, setCategoryMap] = React.useState<CategoryMap>({});
  const [pool, setPool] = React.useState<PlanRecipe[] | null>(null);
  const [slots, setSlots] = React.useState<Slot[]>(
    () => nextDays().map(date => ({ date, meals: [] })),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [bought, setBought] = React.useState<Set<string>>(new Set());
  const [saved, setSaved] = React.useState(false);
  /** 반영 직후 잠깐 뜨는 알림. 몇 끼를 담았는지까지 말해 준다. */
  const [toast, setToast] = React.useState<number | null>(null);
  /** 이미 계획이 있는 날짜들 — 값이 있으면 어떻게 할지 묻는 창이 뜬다. */
  const [conflict, setConflict] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // AI 식단
  const [wish, setWish] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [aiNote, setAiNote] = React.useState<string | null>(null);

  /**
   * 이번 주 식단에서 **뺀** 재료 이름.
   *
   * 왜 "뺀 것" 을 담는가(쓸 것이 아니라): 기본은 "냉장고에 있는 건 다 쓴다" 이고,
   * 빼는 쪽이 예외다. 예외를 담으면 재료를 새로 넣었을 때 자동으로 포함된다.
   * 반대로 담았다면 새 재료가 매번 빠진 채로 시작한다.
   *
   * null = 아직 기본값을 못 정했다(재료 분류표를 기다리는 중).
   */
  const [off, setOff] = React.useState<Set<string> | null>(null);
  const [pickOpen, setPickOpen] = React.useState(false);

  const boxes = React.useMemo(readBoxes, []);
  const myIngredients = React.useMemo(() => getMyIngredients(), []);

  React.useEffect(() => {
    void loadIngredientCategoryMap().then(setCategoryMap).catch(() => {});
  }, []);

  /**
   * 곧 상하는 것과 너무 오래 지난 것.
   *
   * 오래 지난 것은 **식단 기준에서 뺀다.** 152일 지난 소고기로 한 주 식단을
   * 짜면, 이미 버린 재료를 중심으로 짜인다.
   */
  const { soon: expiring, stale } = React.useMemo(
    () => splitExpiring(boxes, categoryMap, SOON_DAYS),
    [boxes, categoryMap],
  );

  /**
   * 기본값: **오래 지난 것만 빼고 나머지는 다 쓴다.**
   *
   * 분류표가 도착한 뒤 한 번만 정한다. 매번 다시 정하면 사용자가 손으로 켠
   * 재료가 렌더링 한 번에 도로 꺼진다.
   */
  React.useEffect(() => {
    if (off !== null) return;
    if (Object.keys(categoryMap).length === 0) return;
    setOff(new Set(stale.map(i => i.name)));
  }, [categoryMap, stale, off]);

  const toggle = (name: string) => {
    setSaved(false);
    setOff(prev => {
      const next = new Set(prev ?? []);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  /**
   * 실제로 식단에 쓰는 재료.
   *
   * 전에는 매칭에는 **전부** 넣고 우선순위에서만 오래된 걸 뺐다. 그래서
   * "152일 지난 재료는 안 썼어요" 라고 적어 놓고 실제로는 그 재료로 요리를
   * 고르고 있었다. 이제 한 목록으로 둘 다 정한다.
   */
  const planIngredients = React.useMemo(
    () => (off ? myIngredients.filter(n => !off.has(n)) : myIngredients),
    [myIngredients, off],
  );

  /** 우선해서 쓸 것 — 곧 상하는데 빼지 않은 것. */
  const priority = React.useMemo(
    () => expiring.filter(i => i.days >= 0 && !off?.has(i.name)).map(i => i.name),
    [expiring, off],
  );

  /** 곧 상하지도, 오래 지나지도 않은 나머지. 칸을 나눠 보여 주려고 미리 가른다. */
  const restNames = React.useMemo(() => {
    const named = new Set([...expiring.map(i => i.name), ...stale.map(i => i.name)]);
    return myIngredients.filter(n => !named.has(n));
  }, [myIngredients, expiring, stale]);

  // ── 후보 불러오기 (무료·규칙 기반) ────────────────────────────
  React.useEffect(() => {
    if (planIngredients.length === 0) { setPool([]); return; }
    const params = new URLSearchParams({
      my_ingredients: planIngredients.join(','),
      sort_by: 'match_rate',
      size: '60',
      page: '1',
    });
    if (priority.length) params.set('applied_expiry_ingredients', priority.join(','));

    fetch(`${API_BASE_URL}/api/recipes/filter?${params}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setPool(d.recipes || []))
      .catch(() => setError('레시피를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
  }, [planIngredients, priority]);

  /**
   * 뺀 재료가 **들어간 요리는 아예 후보에서 뺀다.**
   *
   * 질의에서 재료 이름만 빼면 매칭률이 낮아질 뿐이라, 그 재료를 쓰는 요리가
   * 그대로 올라온다. 실제로 "감자" 를 뺐는데 감자채전·감자채볶음이 남았다.
   * "이번 주엔 이거 빼 주세요" 는 **그 요리를 빼 달라는 말**이다.
   */
  const usablePool = React.useMemo(() => {
    if (!pool || !off || off.size === 0) return pool;
    return pool.filter(r => !ingredientsOf(r).some(n => off.has(n)));
  }, [pool, off]);

  /**
   * 어떤 조건으로 뽑은 후보인지. **재료가 바뀌었을 때만** 다시 채우려고 쓴다.
   *
   * 전에는 `usablePool` 이 바뀔 때마다 무조건 다시 채웠다. 그런데 같은 조건으로도
   * 요청이 여러 번 나가기 때문에, 늦게 도착한 응답이 **사용자가 방금 옮겨 둔
   * 식단을 말없이 되돌렸다.** 토요일 것을 일요일로 옮겨 놓으면 잠시 뒤 제자리로
   * 돌아갔다.
   */
  const planKey = React.useMemo(
    () => planIngredients.join(',') + '|' + priority.join(','),
    [planIngredients, priority],
  );
  const appliedKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!usablePool || usablePool.length === 0) return;
    const same = appliedKey.current === planKey;
    appliedKey.current = planKey;
    setSlots(prev => {
      // 조건이 그대로인데 이미 짜 둔 게 있으면 손대지 않는다.
      if (same && prev.some(s => s.meals.length > 0)) return prev;
      const picked = pickDistinct(usablePool, prev.length);
      // 처음엔 하루 한 끼로 채운다. 더 넣고 빼는 건 사용자가 한다.
      return prev.map((s, i) => ({
        ...s,
        meals: picked[i] ? [{ recipe: picked[i], on: true }] : [],
      }));
    });
  }, [usablePool, planKey]);

  const allMeals = slots.flatMap(s => s.meals);
  const usedIds = new Set(allMeals.map(m => m.recipe.id));

  /** 전체를 다시 짠다 (무료). 매번 같은 조합이 안 나오게 섞는다. */
  const reshuffle = () => {
    if (!usablePool) return;
    setAiNote(null);
    setSaved(false);
    const shuffled = [...usablePool].sort(() => Math.random() - 0.5);
    const picked = pickDistinct(shuffled, slots.length);
    setSlots(prev => prev.map((s, i) => ({
      ...s,
      meals: picked[i] ? [{ recipe: picked[i], on: true }] : [],
    })));
  };

  /** 지금 식단에 없는 요리 하나. 없으면 null. */
  const pickUnused = (): PlanRecipe | null => {
    if (!usablePool) return null;
    const others = usablePool.filter(r => !usedIds.has(r.id));
    if (others.length === 0) return null;
    return others[Math.floor(Math.random() * others.length)];
  };

  /** 한 끼만 다른 요리로 (무료). */
  const swapOne = (day: number, at: number) => {
    const next = pickUnused();
    if (!next) return;
    setSaved(false);
    setSlots(prev => prev.map((s, i) => (i !== day ? s : {
      ...s,
      meals: s.meals.map((m, j) => (j === at ? { ...m, recipe: next } : m)),
    })));
  };

  /** 그 날에 한 끼 더. */
  const addTo = (day: number) => {
    const next = pickUnused();
    if (!next) return;
    setSaved(false);
    setSlots(prev => prev.map((s, i) => (i !== day ? s : {
      ...s, meals: [...s.meals, { recipe: next, on: true }],
    })));
  };

  /** 그 끼니를 뺀다. 그 날이 비어도 괜찮다. */
  const removeAt = (day: number, at: number) => {
    setSaved(false);
    setSlots(prev => prev.map((s, i) => (i !== day ? s : {
      ...s, meals: s.meals.filter((_, j) => j !== at),
    })));
  };

  const toggleAt = (day: number, at: number) => {
    setSaved(false);
    setSlots(prev => prev.map((s, i) => (i !== day ? s : {
      ...s, meals: s.meals.map((m, j) => (j === at ? { ...m, on: !m.on } : m)),
    })));
  };

  /**
   * 그 끼니를 **다른 날로 옮긴다.**
   *
   * 맞바꾸지 않는다. 예전에는 두 칸의 요리를 통째로 바꿔치기해서, 토요일 것을
   * 일요일로 옮기면 멀쩡하던 일요일 요리가 토요일로 끌려갔다. 옮긴다는 말은
   * 옮긴다는 뜻이지 자리를 바꾼다는 뜻이 아니다.
   */
  const moveTo = (from: number, at: number, to: number) => {
    if (from === to) return;
    setSaved(false);
    setSlots(prev => {
      const meal = prev[from]?.meals[at];
      if (!meal) return prev;
      return prev.map((s, i) => {
        if (i === from) return { ...s, meals: s.meals.filter((_, j) => j !== at) };
        if (i === to) return { ...s, meals: [...s.meals, meal] };
        return s;
      });
    });
  };

  /** AI 에게 짜 달라고 한다 (크레딧을 쓴다). */
  const askAi = async () => {
    setAsking(true);
    setError(null);
    setAiNote(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...usageHeaders() },
        body: JSON.stringify({
          ingredients: planIngredients,
          expiring: priority,
          request: wish.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      applyUsage(data?.usage);
      track('chat_use', 'plan');

      if (!res.ok) {
        setError((data && data.error) || '식단을 짜지 못했어요.');
        return;
      }
      const got: PlanRecipe[] = data.plan || [];
      if (got.length === 0) {
        setError('조건에 맞는 요리를 못 찾았어요. 요청을 조금 느슨하게 해 보세요.');
        return;
      }
      setSlots(prev => prev.map((s, i) => ({ ...s, recipe: got[i] || null })));
      setSaved(false);
      setAiNote(wish.trim() ? `"${wish.trim()}" 을(를) 반영했어요.` : 'AI 가 새로 짰어요.');
    } catch {
      setError('네트워크 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      setAsking(false);
    }
  };

  /**
   * 계획을 캘린더에 반영한다.
   *
   * 짜고 끝나면 아무 데도 안 남는다. 그러면 다음 날 "뭐 해 먹기로 했더라" 를
   * 다시 물어야 하고, 식단을 짠 의미가 없다.
   */
  const buildMeals = (): PlannedMeal[] =>
    slots.flatMap(s =>
      s.meals.filter(m => m.on).map(m => ({
        date: toDateKey(s.date),
        recipeId: m.recipe.id,
        title: m.recipe.title,
        link: m.recipe.link,
        thumbnail: m.recipe.thumbnail,
        why: m.recipe.why,
      })),
    );

  const commit = (mode: 'overwrite' | 'fill') => {
    const meals = buildMeals();
    const before = conflictingDates(meals).length;
    savePlan(meals, mode);
    setConflict(null);
    setSaved(true);
    setToast(mode === 'fill' ? meals.length - before : meals.length);
    track('recipe_action', 'plan_apply');
  };

  /**
   * 담기 전에 **겹치는 날이 있으면 묻는다.**
   *
   * 전에는 말없이 덮어썼다. 며칠에 걸쳐 고쳐 둔 계획이 버튼 한 번에 사라지는데,
   * 사라졌다는 사실조차 화면에 안 나왔다.
   */
  const applyPlan = () => {
    const days = conflictingDates(buildMeals());
    if (days.length === 0) { commit('overwrite'); return; }
    setConflict(days);
  };

  const active = allMeals.filter(m => m.on).map(m => m.recipe);

  /** 고른 식단에 필요한데 냉장고에 **없는** 재료. 이게 장보기 목록이다. */
  const shopping = React.useMemo(() => {
    const have = new Set(myIngredients.map(x => x.trim()));
    const need = new Map<string, number>();
    active.forEach(r => {
      ingredientsOf(r).forEach(name => {
        if (have.has(name)) return;
        need.set(name, (need.get(name) || 0) + 1);
      });
    });
    return [...need.entries()].sort((a, b) => b[1] - a[1]);
  }, [active, myIngredients]);

  const planCost = (usage?.credits as Record<string, number> | undefined)?.plan ?? 2;
  // 비회원도 체험분이 남아 있으면 AI 식단을 써 볼 수 있다.
  const canAi = !!usage && usage.can_use_ai;

  // 위쪽 여백 72 는 고정 헤더(56) + 여백(16). 다른 화면들과 같은 값이다.
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-sub)', padding: '72px 14px 90px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', marginBottom: 16, minHeight: 40 }}>
        <BackButton onClick={() => navigate(-1)} style={{ left: 0, top: 2 }} />
        <div style={{ fontWeight: 700, fontSize: 18, textAlign: 'center', padding: '0 56px' }}>
          이번 주 식단 추천
        </div>
      </div>

      {/* ── ① 무엇으로 짜나 ───────────────────────────────── */}
      {/* 접었을 때 짧아야 한다. 이 영역이 길면 정작 결과인 식단이 화면 밖으로
          밀려나서, 사용자가 이 화면을 "재료 화면" 으로 읽는다. */}
      <section style={{
        background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      }}>
        <SectionHead
          title="쓸 재료"
          hint={
            <>
              냉장고 {myIngredients.length}개 중 <b style={{ color: 'var(--ink-700)' }}>{planIngredients.length}개</b>
              {stale.length > 0 && <> · 오래된 {stale.length}개는 뺐어요</>}
            </>
          }
          right={
            <button
              type="button"
              onClick={() => setPickOpen(v => !v)}
              style={{
                flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 8,
                border: '1px solid var(--line-200)', background: 'var(--surface)',
                fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
              }}
            >
              {pickOpen ? '접기 ▴' : '고르기 ▾'}
            </button>
          }
        />

        {expiring.length > 0 ? (
          <>
            <div style={{ fontSize: 12, color: '#B03A28', fontWeight: 700, marginBottom: 6 }}>
              곧 상해요 · 먼저 씁니다
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {expiring.map(i => (
                <IngredientChip
                  key={'s' + i.storage + i.name}
                  label={i.name + ' · ' + daysLabel(i.days, i.estimated)}
                  on={!off?.has(i.name)}
                  warn={i.days < 0}
                  priority={i.days >= 0}
                  onToggle={() => toggle(i.name)}
                />
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.7 }}>
            유통기한을 넣어 두면 <b>곧 상하는 것부터</b> 골라 드려요.
          </div>
        )}

        {/* 펼쳤을 때만 — 나머지 재료와, 오래돼서 빼 둔 재료.
            오래된 재료를 목록에서 아예 지우지 않는 이유: "지났지만 오늘 쓸 건데"
            라는 경우가 실제로 있다. 그때 도로 넣을 자리가 있어야 한다. */}
        {pickOpen && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line-200)' }}>
            {restNames.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 700, marginBottom: 6 }}>
                  아직 괜찮아요
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {restNames.map(n => (
                    <IngredientChip key={'r' + n} label={n}
                                    on={!off?.has(n)} onToggle={() => toggle(n)} />
                  ))}
                </div>
              </>
            )}

            {stale.length > 0 && (
              <div style={{ marginTop: restNames.length > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', fontWeight: 700, marginBottom: 6 }}>
                  오래됐어요 · 빼 뒀어요
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {stale.map(i => (
                    <IngredientChip
                      key={'t' + i.storage + i.name}
                      label={i.name + ' · ' + daysLabel(i.days, i.estimated)}
                      on={!off?.has(i.name)}
                      warn
                      onToggle={() => toggle(i.name)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/my-fridge')}
                  style={{
                    marginTop: 8, height: 30, padding: '0 10px', borderRadius: 8,
                    border: '1px solid var(--line-200)', background: 'var(--surface)',
                    fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
                  }}
                >
                  이미 버렸다면 냉장고에서 정리하기 ›
                </button>
              </div>
            )}

            <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 12, lineHeight: 1.6 }}>
              눌러서 빼거나 다시 넣으세요.
            </div>
          </div>
        )}
      </section>

      {/* ── ② 원하는 대로 바꾸기 ───────────────────────────── */}
      {/* AI 가 관여하는 자리는 앱 어디서나 **같은 시각 언어**를 쓴다 —
          노란 반짝임 + "AI" 배지. 챗봇 FAB·카메라 버튼과 같은 규칙이다. */}
      <div className="ai-surface" style={{ borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
        <SectionHead
          title={
            <>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '.04em',
                padding: '2px 6px', borderRadius: 6,
                background: '#1A1A1E', color: '#FFD600',
              }}>AI</span>
              조건을 넣어 짜기
            </>
          }
          hint={'"담백하게", "아이 먹을 것 위주로"'}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={wish}
            onChange={e => setWish(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canAi && !asking) void askAi(); }}
            placeholder="어떻게 짜 드릴까요?"
            style={{
              flex: 1, minWidth: 0, height: 40, borderRadius: 10,
              border: '1px solid var(--line-200)', padding: '0 12px', fontSize: 13.5,
              boxSizing: 'border-box',
            }}
          />
          {/* 배지를 버튼 밖에 두려면 감싸는 자리가 필요하다.
              버튼 안에 넣으면 `overflow: hidden` 에 잘린다.

              반짝임은 `asking`(요청 중) 일 때만 멈춘다 — `canAi`(크레딧 있음)
              에 걸면 안 된다. `.ai-action:disabled`가 애니메이션을 꺼버리는데
              disabled는 `!canAi`일 때도 걸리므로, 크레딧이 없거나 사용량
              정보가 아직 안 불러와진 순간(canAi가 잠깐 false)엔 챗봇
              FAB·카메라 버튼과 달리 이 버튼만 안 반짝이는 문제가 있었다.
              클릭 자체는 onClick 안에서 canAi로 막으므로 disabled를 asking
              에만 걸어도 크레딧 없을 때 실행되는 일은 없다. */}
          {/* 후광(`ai-glow`)은 뺐다 — 버튼 둘레가 번져서 정작 표면을
              스치는 빛줄기가 묻혔다. */}
          <span style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              className="ai-action"
              disabled={asking}
              onClick={() => { if (canAi) void askAi(); }}
              style={{
                height: 40, padding: '0 14px', borderRadius: 10,
                fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
                cursor: canAi && !asking ? 'pointer' : 'default',
              }}
            >
              <span>{asking ? '짜는 중...' : 'AI로 짜기'}</span>
            </button>
            {!asking && <span className="ai-fab-badge">AI</span>}
          </span>
        </div>
        {/* 남은 양은 앱 어디서나 **같은 부품**으로 보여 준다. 화면마다 다르게
            적으면 사용자가 매번 다시 읽어야 한다. */}
        <UsageLine style={{ marginTop: 8 }} />
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 4, lineHeight: 1.6 }}>
          {canAi ? (
            <>이 버튼만 <b>{planCost} 크레딧</b>을 써요. 아래 식단은 공짜예요.</>
          ) : usage?.is_guest ? (
            <><b>가입하면 {usage.signup_credits}개</b>를 바로 드려요. 아래 식단은 그냥 쓰셔도 됩니다.</>
          ) : (
            <>아래 식단은 그냥 쓰셔도 됩니다.</>
          )}
        </div>
        {aiNote && (
          <div style={{ fontSize: 12.5, color: '#3A6B2E', marginTop: 8, fontWeight: 600 }}>
            {aiNote}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 16,
                      marginBottom: 12, fontSize: 13, color: '#D14343', lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {/* ── 식단 ───────────────────────────────────────────── */}
      {(usablePool === null || asking) && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-200)',
                      borderRadius: 14, padding: '4px 16px 16px' }}>
          <StepLoading
            steps={[
              '냉장고 재료를 살펴보는 중이에요',
              '곧 상하는 재료를 먼저 챙기는 중이에요',
              '만들 수 있는 요리를 고르는 중이에요',
              '요일에 나눠 담는 중이에요',
            ]}
            timings={[600, 1800, 3200, 5200]}
            note={asking ? 'AI 가 요청을 반영하는 중이에요. 보통 5~10초.' : '보통 2~5초쯤 걸려요.'}
            rows={4}
          />
        </div>
      )}

      {usablePool !== null && !asking && slots.every(s => s.meals.length === 0) && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '20px 16px',
                      fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7 }}>
          {off && off.size > 0 && pool && pool.length > 0 ? (
            <>뺀 재료가 많아서 만들 수 있는 요리가 없어요.
            <br />
            위 <b>①</b> 에서 재료를 몇 개 도로 넣어 주세요.</>
          ) : (
            <>아직 식단을 짤 만큼 재료가 없어요.
            <br />
            내 냉장고에 재료를 넣으면 그걸로 만들 수 있는 요리를 골라 드려요.</>
          )}
          <button
            type="button"
            onClick={() => {
              if (off && off.size > 0 && pool && pool.length > 0) { setPickOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              else navigate('/my-fridge');
            }}
            style={{
              marginTop: 12, height: 40, padding: '0 16px', borderRadius: 10,
              border: 'none', background: '#FFD600', color: '#1A1A1E',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {off && off.size > 0 && pool && pool.length > 0 ? '재료 다시 고르기' : '내 냉장고로 가기'}
          </button>
        </div>
      )}

      {usablePool !== null && !asking && slots.some(s => s.meals.length > 0) && (
        <>
          {/* 이 화면의 **결과**. 앞 두 영역은 여기로 오기 위한 자리다.
              크레딧 안내를 따로 상자에 담았더니 카드가 한 칸 더 밀려 내려갔다 —
              제목 밑줄로 붙인다. */}
          <SectionHead
            title="이번 주 식단"
            hint={<>내일부터 {slots.length}일 · 바꾸기는 크레딧을 안 써요</>}
            right={
              <button
                type="button"
                onClick={reshuffle}
                style={{
                  flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 8,
                  border: '1px solid var(--line-200)', background: 'var(--surface)',
                  fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
                }}
              >
                ↻ 다시 짜기
              </button>
            }
          />

          {/* 하루가 한 묶음. 그 안에 끼니가 0개일 수도, 셋일 수도 있다. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {slots.map((slot, i) => (
              <div key={slot.date.toISOString()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              gap: 8, marginBottom: 6, padding: '0 2px' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
                    {dayLabel(slot.date)}
                    {slot.meals.length > 1 && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#7A5C00', marginLeft: 6 }}>
                        {slot.meals.length}끼
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => addTo(i)}
                    style={{
                      height: 26, padding: '0 9px', borderRadius: 8, flexShrink: 0,
                      border: '1px solid var(--line-200)', background: 'var(--surface)',
                      fontSize: 11.5, fontWeight: 700, color: 'var(--ink-700)', cursor: 'pointer',
                    }}
                  >
                    + 요리 추가
                  </button>
                </div>

                {slot.meals.length === 0 ? (
                  /* 옮기고 나면 빈 날이 생긴다. 그것도 정상이라고 말해 준다 —
                     예전엔 빈 칸이 생기지 않도록 억지로 맞바꿨다. */
                  <div style={{
                    border: '1px dashed var(--line-200)', borderRadius: 12, padding: '14px 12px',
                    fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center',
                  }}>
                    이 날은 비워 뒀어요
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {slot.meals.map((meal, k) => (
                      <div
                        key={meal.recipe.id + '-' + k}
                        style={{
                          background: 'var(--surface)', border: '1px solid var(--line-200)',
                          borderRadius: 14, padding: 12,
                          opacity: meal.on ? 1 : 0.5,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ width: 84, flexShrink: 0 }}>
                            <DayPicker
                              value={i}
                              days={slots.map(x => x.date)}
                              onPick={j => moveTo(i, k, j)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                track('recipe_open', String(meal.recipe.id));
                                openCookMode({
                                  id: meal.recipe.id, title: meal.recipe.title,
                                  link: meal.recipe.link, myIngredients,
                                });
                              }}
                              style={{
                                display: 'block', width: '100%', marginTop: 6, padding: 0,
                                border: 'none', background: 'transparent', cursor: 'pointer',
                              }}
                            >
                              {meal.recipe.thumbnail ? (
                                <img
                                  src={getProxiedImageUrl(meal.recipe.thumbnail)}
                                  alt=""
                                  loading="lazy"
                                  onError={e => {
                                    // 자리는 남긴다 — 지우면 줄 높이가 튀어 목록이 들썩인다.
                                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                                  }}
                                  style={{
                                    width: '100%', height: 64, borderRadius: 10,
                                    objectFit: 'cover', background: 'var(--surface-sub)', display: 'block',
                                  }}
                                />
                              ) : (
                                <span
                                  aria-hidden
                                  style={{
                                    width: '100%', height: 64, borderRadius: 10,
                                    background: 'var(--surface-sub)',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: 'var(--ink-500)', fontSize: 18,
                                  }}
                                >&#127869;</span>
                              )}
                            </button>
                          </div>

                          <div style={{ flex: 1, minWidth: 0, display: 'flex',
                                        flexDirection: 'column', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                track('recipe_open', String(meal.recipe.id));
                                openCookMode({
                                  id: meal.recipe.id, title: meal.recipe.title,
                                  link: meal.recipe.link, myIngredients,
                                });
                              }}
                              style={{
                                width: '100%', textAlign: 'left', border: 'none',
                                background: 'transparent', cursor: 'pointer', padding: 0,
                              }}
                            >
                              <span style={{
                                display: '-webkit-box', fontSize: 14, fontWeight: 600,
                                color: '#1A1A1E', lineHeight: 1.4, overflow: 'hidden',
                                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              }}>{meal.recipe.title}</span>
                              {meal.recipe.why ? (
                                <span style={{ display: 'block', fontSize: 11.5, color: '#7A5C00', marginTop: 3 }}>
                                  {meal.recipe.why}
                                </span>
                              ) : typeof meal.recipe.match_rate === 'number' ? (
                                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3 }}>
                                  가진 재료로 {meal.recipe.match_rate}% 만들 수 있어요
                                </span>
                              ) : null}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                                          flexWrap: 'wrap', marginTop: 'auto' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  track('recipe_open', String(meal.recipe.id));
                                  openCookMode({
                                    id: meal.recipe.id, title: meal.recipe.title,
                                    link: meal.recipe.link, myIngredients,
                                  });
                                }}
                                style={{
                                  border: 'none', background: 'transparent', padding: 0,
                                  fontSize: 12, fontWeight: 700, color: '#7A5C00', cursor: 'pointer',
                                }}
                              >
                                조리 순서 보기 &rsaquo;
                              </button>
                              <span aria-hidden style={{ color: 'var(--line-300)' }}>|</span>
                              <button
                                type="button"
                                onClick={() => swapOne(i, k)}
                                style={{
                                  border: 'none', background: 'transparent', padding: 0,
                                  fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer',
                                }}
                              >
                                다른 요리로
                              </button>
                              <span aria-hidden style={{ color: 'var(--line-300)' }}>|</span>
                              <button
                                type="button"
                                onClick={() => removeAt(i, k)}
                                style={{
                                  border: 'none', background: 'transparent', padding: 0,
                                  fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer',
                                }}
                              >
                                빼기
                              </button>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={meal.on}
                            onChange={() => toggleAt(i, k)}
                            aria-label={dayLabel(slot.date) + ' ' + meal.recipe.title + ' 담기'}
                            style={{ flexShrink: 0, width: 18, height: 18, marginTop: 6 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 반영하기 — 이게 없으면 "짜고 끝" 이다. */}
          <button
            type="button"
            onClick={applyPlan}
            style={{
              width: '100%', height: 48, marginTop: 12, borderRadius: 12, border: 'none',
              background: saved ? '#1A1A1E' : '#FFD600',
              color: saved ? '#FFD600' : '#1A1A1E',
              fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
              transition: 'background .18s ease, color .18s ease',
            }}
          >
            {saved ? '캘린더에 담았어요 · 다시 담기' : '이번 주 식단 계획 반영하기'}
          </button>
          {saved && (
            <button
              type="button"
              onClick={() => navigate('/cooking-calendar')}
              style={{
                width: '100%', height: 40, marginTop: 6, borderRadius: 10,
                border: '1px solid var(--line-200)', background: 'var(--surface)',
                fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
              }}
            >
              요리 캘린더에서 보기 ›
            </button>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.7,
                        padding: '10px 4px 0' }}>
            체크를 끄면 그 날은 빼고 담아요.
          </div>
        </>
      )}

      {conflict && (
        <Dialog
          open
          onClose={() => setConflict(null)}
          title="이미 짜 둔 계획이 있어요"
          width={340}
          dismissLabel="그만두기"
        >
          <div style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7, textAlign: 'left' }}>
            <b>{conflict.length}일</b>이 겹쳐요 —{' '}
            {conflict.slice(0, 3).map(d => d.slice(5).replace('-', '/')).join(', ')}
            {conflict.length > 3 && ` 외 ${conflict.length - 3}일`}.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => commit('overwrite')}
                style={{
                  height: 44, borderRadius: 10, border: 'none', background: '#FFD600',
                  color: '#1A1A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                새로 짠 것으로 바꾸기
                <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(26,26,30,.65)' }}>
                  겹치는 {conflict.length}일이 새 요리로 바뀌어요
                </div>
              </button>
              <button
                type="button"
                onClick={() => commit('fill')}
                style={{
                  height: 44, borderRadius: 10, background: 'var(--surface)',
                  border: '1px solid var(--line-200)',
                  color: '#1A1A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                비어 있는 날에만 넣기
                <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-500)' }}>
                  이미 정해 둔 날은 그대로 둬요
                </div>
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 반영했다는 걸 **화면 아래에서 잠깐** 말한다. 버튼을 초록으로 바꿔
          두면 그 색이 계속 남아 "지금 뭔가 켜져 있다" 처럼 읽혔다. */}
      {toast !== null && (
        <div className="plan-toast" role="status">
          <span aria-hidden style={{
            width: 18, height: 18, borderRadius: 9999, background: '#FFD600',
            color: '#1A1A1E', fontSize: 11, fontWeight: 800, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>✓</span>
          <span>요리 캘린더에 {toast}끼를 담았어요</span>
          <button type="button" onClick={() => navigate('/cooking-calendar')}>
            보기
          </button>
        </div>
      )}

      {/* ── 장보기 목록 ────────────────────────────────────── */}
      {shopping.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line-200)',
          borderRadius: 14, padding: '14px 16px', marginTop: 16,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: '#1A1A1E' }}>
            장보기 목록 {shopping.length}개
          </h2>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10, lineHeight: 1.6 }}>
            위 식단에 필요한데 냉장고에 없는 재료예요.
            <b> 여러 요리에 쓰이는 것부터</b> 놓았습니다.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shopping.map(([name, count]) => {
              const done = bought.has(name);
              const url = resolveCoupangUrl(name);
              return (
                <div key={name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 4px', borderBottom: '1px solid var(--line-200)',
                }}>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => setBought(prev => {
                      const next = new Set(prev);
                      if (next.has(name)) next.delete(name); else next.add(name);
                      return next;
                    })}
                    aria-label={`${name} 샀어요`}
                    style={{ width: 18, height: 18, flexShrink: 0 }}
                  />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 14,
                    color: done ? 'var(--ink-500)' : 'var(--ink-900)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {name}
                    {count > 1 && (
                      <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}> · {count}개 요리</span>
                    )}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('coupang_click', name)}
                      style={{
                        flexShrink: 0, fontSize: 12, fontWeight: 700,
                        color: '#1A1A1E', textDecoration: 'none',
                        padding: '5px 10px', borderRadius: 8, background: '#FFD600',
                      }}
                    >
                      사러 가기
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 10, lineHeight: 1.6 }}>
            쿠팡 파트너스 활동으로 일정 수수료를 받을 수 있어요.
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlan;
