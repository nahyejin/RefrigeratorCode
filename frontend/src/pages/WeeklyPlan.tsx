import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
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
import { savePlan, toDateKey, type PlannedMeal } from '../utils/mealPlan';

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

/** 한 칸 = 하루. 무엇을 만들지와, 장보기에 넣을지. */
interface Slot {
  date: Date;
  recipe: PlanRecipe | null;
  on: boolean;
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
 * 이 화면에는 성격이 다른 세 영역이 있다 — **무엇으로**(재료), **어떻게**(요청),
 * **무엇을**(식단). 제목이 없으면 스크롤하는 사람에게는 그냥 카드 세 장이라,
 * 어디까지가 입력이고 어디부터가 결과인지 알 수가 없다.
 */
const SectionHead: React.FC<{
  n: number;
  title: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
}> = ({ n, title, hint, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    <span style={{
      flexShrink: 0, width: 20, height: 20, borderRadius: 6,
      background: '#1A1A1E', color: '#FFD600', fontSize: 11.5, fontWeight: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{n}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)',
                    display: 'flex', alignItems: 'center', gap: 6 }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2, lineHeight: 1.5 }}>
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
 */
const IngredientChip: React.FC<{
  label: string; on: boolean; warn?: boolean; onToggle: () => void;
}> = ({ label, on, warn, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={on}
    style={{
      fontSize: 12, padding: '5px 10px', borderRadius: 9999, cursor: 'pointer',
      lineHeight: 1.4,
      border: on ? '1px solid #1A1A1E' : '1px dashed var(--line-200)',
      background: on ? (warn ? '#FBE3E0' : '#FFF8CC') : 'var(--surface-sub)',
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
    () => nextDays().map(date => ({ date, recipe: null, on: true })),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [bought, setBought] = React.useState<Set<string>>(new Set());
  const [saved, setSaved] = React.useState(false);
  /** 반영 직후 잠깐 뜨는 알림. 몇 끼를 담았는지까지 말해 준다. */
  const [toast, setToast] = React.useState<number | null>(null);
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

  // 후보가 바뀌면 칸을 다시 채운다. 재료를 뺐는데 그 재료로 만든 요리가 그대로
  // 남아 있으면, 사용자 눈에는 버튼이 안 먹은 것으로 보인다.
  React.useEffect(() => {
    if (!usablePool || usablePool.length === 0) return;
    setSlots(prev => {
      const picked = pickDistinct(usablePool, prev.length);
      return prev.map((s, i) => ({ ...s, recipe: picked[i] || null }));
    });
  }, [usablePool]);

  const usedIds = new Set(slots.map(s => s.recipe?.id).filter(Boolean) as number[]);

  /** 전체를 다시 짠다 (무료). 매번 같은 조합이 안 나오게 섞는다. */
  const reshuffle = () => {
    if (!usablePool) return;
    setAiNote(null);
    setSaved(false);
    const shuffled = [...usablePool].sort(() => Math.random() - 0.5);
    const picked = pickDistinct(shuffled, slots.length);
    setSlots(prev => prev.map((s, i) => ({ ...s, recipe: picked[i] || null })));
  };

  /** 한 칸만 다른 요리로 (무료). 지금 식단에 없는 것 중에서 고른다. */
  const swapOne = (index: number) => {
    if (!usablePool) return;
    setSaved(false);
    const others = usablePool.filter(r => !usedIds.has(r.id));
    if (others.length === 0) return;
    const next = others[Math.floor(Math.random() * others.length)];
    setSlots(prev => prev.map((s, i) => (i === index ? { ...s, recipe: next } : s)));
  };

  /**
   * 요일을 바꾼다 — 두 칸의 요리를 **맞바꾼다.**
   * 밀어내지 않고 자리를 바꾸므로 빈 칸이 생기지 않는다.
   */
  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    setSaved(false);
    setSlots(prev => {
      const next = [...prev];
      const a = next[from].recipe;
      next[from] = { ...next[from], recipe: next[to].recipe };
      next[to] = { ...next[to], recipe: a };
      return next;
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
  const applyPlan = () => {
    const meals: PlannedMeal[] = slots
      .filter(s => s.on && s.recipe)
      .map(s => ({
        date: toDateKey(s.date),
        recipeId: s.recipe!.id,
        title: s.recipe!.title,
        link: s.recipe!.link,
        thumbnail: s.recipe!.thumbnail,
        why: s.recipe!.why,
      }));
    savePlan(meals);
    setSaved(true);
    setToast(meals.length);
    track('recipe_action', 'plan_apply');
  };

  const active = slots.filter(s => s.on && s.recipe).map(s => s.recipe!);

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
          n={1}
          title="이 재료로 짰어요"
          hint={
            <>
              냉장고 재료 {myIngredients.length}개 중 <b style={{ color: 'var(--ink-700)' }}>
              {planIngredients.length}개</b>를 써요
              {stale.length > 0 && <> · {STALE_AFTER_DAYS}일 넘게 지난 {stale.length}개는 빼 뒀어요</>}
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
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
              <b style={{ color: 'var(--ink-700)' }}>먼저 쓸 재료</b> · {SOON_DAYS}일 이내
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {expiring.map(i => (
                <IngredientChip
                  key={'s' + i.storage + i.name}
                  label={i.name + ' · ' + daysLabel(i.days, i.estimated)}
                  on={!off?.has(i.name)}
                  warn={i.days < 0}
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
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
                  <b style={{ color: 'var(--ink-700)' }}>그 밖의 재료</b> ·
                  {' '}기한이 남았거나 안 적은 것 — 모두 식단에 써요
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
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
                  <b style={{ color: 'var(--ink-700)' }}>{STALE_AFTER_DAYS}일 넘게 지났어요</b> ·
                  {' '}기본으로 뺐어요 — 쓰실 거면 누르세요
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
              누르면 이번 주 식단에서 빠져요. 냉장고에서 지워지는 건 아니에요.
            </div>
          </div>
        )}
      </section>

      {/* ── ② 원하는 대로 바꾸기 ───────────────────────────── */}
      {/* AI 가 관여하는 자리는 앱 어디서나 **같은 시각 언어**를 쓴다 —
          노란 반짝임 + "AI" 배지. 챗봇 FAB·카메라 버튼과 같은 규칙이다. */}
      <div className="ai-surface" style={{ borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
        <SectionHead
          n={2}
          title={
            <>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '.04em',
                padding: '2px 6px', borderRadius: 6,
                background: '#1A1A1E', color: '#FFD600',
              }}>AI</span>
              원하는 대로 짜 드려요
            </>
          }
          hint={'"담백하게", "아이가 먹을 것 위주로" 처럼 적어 보세요 (비워 둬도 됩니다)'}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={wish}
            onChange={e => setWish(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canAi && !asking) void askAi(); }}
            placeholder="어떻게 짜 드릴까요? (선택)"
            style={{
              flex: 1, minWidth: 0, height: 40, borderRadius: 10,
              border: '1px solid var(--line-200)', padding: '0 12px', fontSize: 13.5,
              boxSizing: 'border-box',
            }}
          />
          {/* 배지를 버튼 밖에 두려면 감싸는 자리가 필요하다.
              버튼 안에 넣으면 `overflow: hidden` 에 잘린다. */}
          <span className={canAi && !asking ? 'ai-glow' : undefined}
                style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              className="ai-action"
              disabled={asking || !canAi}
              onClick={() => { if (canAi) void askAi(); }}
              style={{
                height: 40, padding: '0 14px', borderRadius: 10,
                fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
                cursor: canAi && !asking ? 'pointer' : 'default',
              }}
            >
              <span>{asking ? '짜는 중...' : 'AI 식단 짜기'}</span>
            </button>
            {!asking && canAi && <span className="ai-fab-badge">AI</span>}
          </span>
        </div>
        {/* 남은 양은 앱 어디서나 **같은 부품**으로 보여 준다. 화면마다 다르게
            적으면 사용자가 매번 다시 읽어야 한다. */}
        <UsageLine style={{ marginTop: 8 }} />
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 4, lineHeight: 1.6 }}>
          {canAi ? (
            <>이 버튼만 크레딧 <b>{planCost}</b>을 써요. 아래 식단은 공짜예요.</>
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

      {usablePool !== null && !asking && slots.every(s => !s.recipe) && (
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

      {usablePool !== null && !asking && slots.some(s => s.recipe) && (
        <>
          {/* 이 화면의 **결과**. 앞 두 영역은 여기로 오기 위한 자리다.
              크레딧 안내를 따로 상자에 담았더니 카드가 한 칸 더 밀려 내려갔다 —
              제목 밑줄로 붙인다. */}
          <SectionHead
            n={3}
            title={'이번 주 식단 · 내일부터 ' + slots.length + '일'}
            hint={<>바꾸기·다시 짜기는 <b style={{ color: 'var(--ink-700)' }}>크레딧을 쓰지 않아요</b> — 마음에 들 때까지 누르세요</>}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map((slot, i) => (
              <div
                key={slot.date.toISOString()}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line-200)',
                  borderRadius: 14, padding: 12,
                  opacity: slot.on ? 1 : 0.5,
                }}
              >
                {/* 왼쪽 한 기둥에 **날짜와 썸네일**, 오른쪽에 제목과 행동.
                    전에는 버튼 줄에만 `paddingLeft: 70` 을 줘서 왼쪽에 큰 빈
                    자리가 생겼고, 카드 안이 헐거워 보였다. 두 기둥으로 나누면
                    왼쪽 폭이 썸네일 하나로 정해져 빈 자리가 안 생긴다. */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 84, flexShrink: 0 }}>
                    <DayPicker
                      value={i}
                      days={slots.map(x => x.date)}
                      onPick={j => moveTo(i, j)}
                    />
                    {slot.recipe && (
                      <button
                        type="button"
                        onClick={() => {
                          track('recipe_open', String(slot.recipe!.id));
                          openCookMode({
                            id: slot.recipe!.id, title: slot.recipe!.title,
                            link: slot.recipe!.link, myIngredients,
                          });
                        }}
                        style={{
                          display: 'block', width: '100%', marginTop: 6, padding: 0,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                        }}
                      >
                        {slot.recipe.thumbnail ? (
                          <img
                            src={getProxiedImageUrl(slot.recipe.thumbnail)}
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
                          /* 썸네일이 없는 레시피도 있다. `src=""` 로 두면 브라우저가
                             페이지 자체를 다시 요청하므로 빈 자리를 그린다. */
                          <span
                            aria-hidden
                            style={{
                              width: '100%', height: 64, borderRadius: 10,
                              background: 'var(--surface-sub)',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: 'var(--ink-500)', fontSize: 18,
                            }}
                          >🍽</span>
                        )}
                      </button>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex',
                                flexDirection: 'column', gap: 6 }}>
                    {slot.recipe ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            track('recipe_open', String(slot.recipe!.id));
                            openCookMode({
                              id: slot.recipe!.id, title: slot.recipe!.title,
                              link: slot.recipe!.link, myIngredients,
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
                          }}>{slot.recipe.title}</span>
                          {slot.recipe.why ? (
                            <span style={{ display: 'block', fontSize: 11.5, color: '#7A5C00', marginTop: 3 }}>
                              {slot.recipe.why}
                            </span>
                          ) : typeof slot.recipe.match_rate === 'number' ? (
                            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3 }}>
                              가진 재료로 {slot.recipe.match_rate}% 만들 수 있어요
                            </span>
                          ) : null}
                        </button>

                        {/* 오른쪽 기둥 안에 두 행동을 나란히. 왼쪽 끝이 제목과
                            맞으므로 따로 여백을 줄 필요가 없다. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                                      flexWrap: 'wrap', marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => {
                              track('recipe_open', String(slot.recipe!.id));
                              openCookMode({
                                id: slot.recipe!.id, title: slot.recipe!.title,
                                link: slot.recipe!.link, myIngredients,
                              });
                            }}
                            style={{
                              border: 'none', background: 'transparent', padding: 0,
                              fontSize: 12, fontWeight: 700, color: '#7A5C00', cursor: 'pointer',
                            }}
                          >
                            조리 순서 보기 ›
                          </button>
                          <span aria-hidden style={{ color: 'var(--line-300)' }}>|</span>
                          <button
                            type="button"
                            onClick={() => swapOne(i)}
                            style={{
                              border: 'none', background: 'transparent', padding: 0,
                              fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer',
                            }}
                          >
                            다른 요리로 바꾸기
                          </button>
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>비어 있음</span>
                    )}
                  </div>

                  <input
                    type="checkbox"
                    checked={slot.on}
                    onChange={() => setSlots(prev => prev.map((s, j) =>
                      (j === i ? { ...s, on: !s.on } : s)))}
                    aria-label={`${dayLabel(slot.date)} 이 날 빼기`}
                    style={{ flexShrink: 0, width: 18, height: 18, marginTop: 6 }}
                  />
                </div>
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
