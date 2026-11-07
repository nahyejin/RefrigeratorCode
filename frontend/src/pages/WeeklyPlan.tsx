import React from 'react';
import { saveFridgeChange } from '../utils/fridgeServer';
import { useNavigate, useLocation } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import Dialog from '../components/ui/Dialog';
import Sheet from '../components/ui/Sheet';
import KebabMenu from '../components/ui/KebabMenu';
import VoiceInputButton from '../components/ui/VoiceInputButton';
import StepLoading from '../components/StepLoading';
import { getMyIngredients } from '../utils/recipeUtils';
import { loadIngredientCategoryMap, lookupShelfLifeDays, estimateExpiry, type CategoryMap, type StorageKind } from '../utils/shelfLife';
import { useAuth } from '../context/AuthContext';
import { splitExpiring, daysLabel, expiryTone, SOON_DAYS, STALE_AFTER_DAYS,
         type FridgeItem, type ExpiringItem } from '../utils/expiry';
import { openCookMode } from '../utils/cookMode';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { track } from '../utils/track';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { openLoginGate } from '../utils/loginGate';
import { usageHeaders, applyUsage, spendOptimistically } from '../utils/usage';
import { UsageLine, useUsage } from '../components/UsageMeter';
import {
  savePlan, conflictingDates, pullMyPlansIntoLocal, toDateKey,
  type PlannedMeal, type PlanMode,
} from '../utils/mealPlan';
import PlanConflictSummary from '../components/PlanConflictSummary';
import { SparklesIcon } from '../components/ui/Icons';

/**
 * 이번 주 식단 + 장보기 목록.
 *
 * 왜 한 화면인가:
 *   장보기 목록은 식단에서 **나온다.** 무엇을 만들지 정해야 무엇이 부족한지
 *   나온다. 두 화면으로 나누면 사용자가 같은 걸 두 번 정하게 된다.
 *
 * 한 화면, 한 이름 「식단 짜기」(2026-11-06). 두 가지 방식이 한 버튼으로 갈린다:
 *   - **조건을 안 적으면(무료)** — 매칭률로 줄 세우고 겹치는 요리를 걸러 내는 규칙.
 *     다시 짜기·바꾸기·요일 옮기기 전부 공짜다
 *   - **조건을 적으면(AI, 크레딧)** — "담백하게", "아이 먹을 것 위주로" 같은 **말을 받는다.**
 *     규칙으로는 못 받는 것이고, 그래서 크레딧을 쓴다
 * 예전엔 AI 쪽이 따로 대화 화면(`/plan?ai=1`)이었다. 한 번만 묻는 구조라 대화가 아니었고, 두 버튼이 나란히 있어
 * 「뭘 눌러야 하지」가 됐다. 옛 주소로 들어와도 같은 화면이 열린다.
 */

/** 마지막으로 AI 가 짠 식단. 크레딧을 쓴 결과라 화면을 나갔다 와도 남긴다(대화 화면을 없애면서 옮겨 온 것). */
const LAST_AI_PLAN_KEY = 'cookmatch_last_ai_plan';
const LAST_AI_PLAN_DAYS = 7;
interface LastAiPlan {
  at: number;
  note: string;
  basket: { basket: string[]; buy_count: number; days: number; no_buy_days: number } | null;
  meals: Meal[][];
}
function loadLastAiPlan(): LastAiPlan | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_AI_PLAN_KEY) || 'null');
    if (!v || !Array.isArray(v.meals) || typeof v.at !== 'number') return null;
    if (Date.now() - v.at > LAST_AI_PLAN_DAYS * 24 * 60 * 60 * 1000) return null;
    return v as LastAiPlan;
  } catch { return null; }
}
function saveLastAiPlan(p: LastAiPlan) {
  try { localStorage.setItem(LAST_AI_PLAN_KEY, JSON.stringify(p)); } catch { /* 용량 초과 등 — 무시 */ }
}
function clearLastAiPlan() {
  try { localStorage.removeItem(LAST_AI_PLAN_KEY); } catch { /* 무시 */ }
}

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const PLAN_DAYS = 7;
/** 이보다 재료가 적으면 7일치를 다 채우기 빠듯하다 — 미리 알려 준다. */
const LOW_INGREDIENT_WARN = 5;
/** 이 매칭률(가진 재료 비율, %) 아래인 요리는 "그걸로 만든다" 고 보기 어렵다 —
 * 무료 식단이 빈 날을 채우겠다고 억지로 끌어오지 않는다. */
const MIN_PLAN_MATCH_RATE = 20;

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
 * 색: 유통기한이 붙은 재료는 내냉장고 D-day 뱃지와 같은 색(`expiryTone`)을 쓴다.
 * 예전엔 이 화면만 진한 노랑(곧 상함)·연노랑(보통)이라 다른 화면과 달랐고
 * 「누리끼리하다」는 지적을 받았다(2026-10-15). 기한 없는 재료는 흰 바탕.
 */
const IngredientChip: React.FC<{
  label: string; on: boolean; tone?: { bg: string; fg: string }; onToggle: () => void;
}> = ({ label, on, tone, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={on}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, padding: '5px 10px', borderRadius: 9999, cursor: 'pointer',
      lineHeight: 1.4,
      border: on ? `1px solid ${tone ? tone.bg : 'var(--line-200)'}` : '1px dashed var(--line-200)',
      background: on ? (tone ? tone.bg : 'var(--surface)') : 'var(--surface-sub)',
      color: on ? (tone ? tone.fg : 'var(--ink-900)') : 'var(--ink-500)',
      textDecoration: on ? 'none' : 'line-through',
      fontWeight: on ? 700 : 500,
    }}
  >
    {/* 앞의 동그라미가 **쓰는지 뺐는지**를 말한다(2026-11-06 「취소선으로 빼는 걸 알아보기 어렵다」): 쓰는 재료는 ✓ 가 찬 동그라미,
        뺀 재료는 빈 동그라미 + 취소선. 취소선만으로는 눌러서 뺄 수 있다는 것도, 빠진 상태라는 것도 안 읽혔다. */}
    <span
      aria-hidden
      style={{
        width: 14, height: 14, borderRadius: 9999, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800, lineHeight: 1,
        background: on ? (tone ? tone.fg : 'var(--ink-900)') : 'transparent',
        color: on ? (tone && tone.bg.startsWith('#') ? tone.bg : '#FFFFFF') : 'transparent',
        border: on ? 'none' : '1.5px solid var(--ink-400)',
      }}
    >
      ✓
    </span>
    {label}
  </button>
);

/**
 * 자주 적는 조건.
 *
 * 빈 칸을 주고 "적어 보세요" 하면 대부분 그냥 넘긴다. 눌러서 고를 수 있으면
 * **무엇을 말할 수 있는 자리인지**가 그 자리에서 보인다.
 */
const WISH_PRESETS = [
  '아이 먹을 것 위주로',
  '다이어트 · 담백하게',
  '간단한 걸로',
  '국물 요리는 빼고',
  '손님상에 올릴 것',
  '고기 없이',
];

const WeeklyPlan: React.FC = () => {
  const navigate = useNavigate();
  const usage = useUsage();
  const { user: authUser } = useAuth();
  const [categoryMap, setCategoryMap] = React.useState<CategoryMap>({});
  const [pool, setPool] = React.useState<PlanRecipe[] | null>(null);
  const [slots, setSlots] = React.useState<Slot[]>(
    () => nextDays().map(date => ({ date, meals: [] })),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [bought, setBought] = React.useState<Set<string>>(new Set());
  /** 장보기 링크를 타고 나갔다 돌아오면 "사셨나요" 를 묻고, 그렇다고 하면
   * 바로 내 냉장고에 담는다(2026-09-16, 실사용 요청 — 요리 캘린더의 장보기
   * 목록과 같은 동작). */
  const pendingPurchaseRef = React.useRef<string | null>(null);
  const [confirmingPurchase, setConfirmingPurchase] = React.useState<string | null>(null);
  const [addingPurchase, setAddingPurchase] = React.useState(false);
  const [addedToastName, setAddedToastName] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  /** 반영 직후 잠깐 뜨는 알림. 몇 끼를 담았는지까지 말해 준다. */
  const [toast, setToast] = React.useState<number | null>(null);
  /** 이미 계획이 있는 날짜들 — 값이 있으면 어떻게 할지 묻는 창이 뜬다. */
  const [conflict, setConflict] = React.useState<string[] | null>(null);
  /** 겹침 확인창을 띄운 **지난 대화의 식단**. 지금 화면의 식단이면 null(→ `buildMeals()`). */
  const [pendingMeals, setPendingMeals] = React.useState<PlannedMeal[] | null>(null);
  React.useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // 조건(선택). 적으면 AI, 안 적으면 무료.
  const [wish, setWish] = React.useState('');
  const aiBox = React.useRef<HTMLElement | null>(null);
  const wishInput = React.useRef<HTMLInputElement | null>(null);
  /** AI 가 말한 **조건을 어떻게 읽었는지** 한 문장. 결과 위에 그대로 쓴다. */
  const aiReason = React.useRef<string>('');
  /** 실패했을 때 **왜 실패했는지**(크레딧이 없어서인지 네트워크 때문인지)를 그대로 보여 주려고 담아 둔다. */
  const aiFailReason = React.useRef<string>('');
  const location = useLocation();
  /** 예전 주소(`/plan?ai=1` — 위젯·사용 가이드·옛 링크)로 왔나. 같은 화면이고, 조건 칸으로 데려간다. */
  const fromAi = React.useMemo(
    () => new URLSearchParams(location.search).get('ai') === '1',
    [location.search],
  );
  React.useEffect(() => {
    if (!fromAi) return;
    const t = window.setTimeout(() => aiBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    return () => window.clearTimeout(t);
  }, [fromAi]);

  const [asking, setAsking] = React.useState(false);
  const [aiNote, setAiNote] = React.useState<string | null>(null);
  /**
   * AI 가 짠 식단의 **장바구니**.
   *
   * 이게 이 기능의 요점이다 — 매칭률 순으로 자르면 일곱 요리가 저마다 다른
   * 재료를 요구해 장이 열다섯 개가 된다. 사야 할 재료의 합집합이 작아지도록
   * 고르면 "두세 개만 사면 일주일" 이 된다.
   */
  const [basket, setBasket] = React.useState<
    { basket: string[]; buy_count: number; days: number; no_buy_days: number } | null
  >(null);

  // 마지막으로 AI 가 짠 식단을 돌려놓고, 바뀔 때마다 저장한다. 날짜는 매일 밀리니 날짜가 아니라 **몇 번째 날**로 맞춘다.
  const [planReady, setPlanReady] = React.useState(false);
  /** AI 가 조건을 읽은 설명을 펼쳤나. */
  const [noteOpen, setNoteOpen] = React.useState(false);
  /**
   * 지난번에 AI 가 짠 식단(7일 안). **들어오자마자 펼치지 않는다** — 예전엔 여기서 바로 결과 화면을 띄워서, 들어올 때마다 「묻지도 않고
   * 식단이 짜여 있다」(2026-11-07 「이 화면이 기본 화면이 되게」). 크레딧을 쓴 결과라 지우지는 않고, 첫 화면의 「지난번 식단 다시 보기」를
   * 눌렀을 때만 불러온다.
   */
  const [lastPlan, setLastPlan] = React.useState<LastAiPlan | null>(null);
  React.useEffect(() => {
    setLastPlan(loadLastAiPlan());
    setPlanReady(true);
  }, []);
  const restoreLastPlan = () => {
    if (!lastPlan) return;
    setSlots(prev => prev.map((s, i) => ({ ...s, meals: lastPlan.meals[i] ?? [] })));
    setBasket(lastPlan.basket);
    setAiNote(lastPlan.note);
    setLastPlan(null);
  };

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
  /** 결과가 나온 뒤 접어 둔 「재료·조건」 영역을 다시 펼쳤는지(2026-11-07 화면 단순화). */
  const [editOpen, setEditOpen] = React.useState(false);
  React.useEffect(() => { if (asking) { setEditOpen(false); setLastPlan(null); } }, [asking]);
  React.useEffect(() => {
    if (lastPlan && slots.some(s => s.meals.length > 0)) setLastPlan(null);   // 무료로 새로 짜졌으면 지난번 줄은 접는다
  }, [lastPlan, slots]);
  /** 「날짜 바꾸기」 시트가 어느 끼니를 옮기는 중인지 */
  const [moving, setMoving] = React.useState<{ day: number; at: number } | null>(null);
  /** 무료 식단은 예전엔 재료만 있으면 **묻지도 않고** 바로 7일치를 짜서
   * 보여줬다. "누르지도 않았는데 왜 장보기 목록부터 나오냐" 는 지적
   * (2026-09-16)으로, 이 버튼을 눌러야 비로소 짜기 시작하게 바꾼다. */
  const [hasRequestedPlan, setHasRequestedPlan] = React.useState(false);

  const boxes = React.useMemo(readBoxes, []);
  const myIngredients = React.useMemo(() => getMyIngredients(), []);
  React.useEffect(() => {
    if (!planReady || asking) return;
    // 지난번 식단이 아직 불려 오지 않은 첫 화면에서는 저장분을 건드리지 않는다(빈 화면이라고 지우면 크레딧 쓴 결과가 사라진다)
    if (lastPlan) return;
    if (!aiNote || !slots.some(s => s.meals.length > 0)) { clearLastAiPlan(); return; }
    saveLastAiPlan({ at: Date.now(), note: aiNote, basket, meals: slots.map(s => s.meals) });
  }, [planReady, asking, aiNote, basket, slots, lastPlan]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !pendingPurchaseRef.current) return;
      setConfirmingPurchase(pendingPurchaseRef.current);
      pendingPurchaseRef.current = null;
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  React.useEffect(() => {
    if (!addedToastName) return;
    const t = setTimeout(() => setAddedToastName(null), 2600);
    return () => clearTimeout(t);
  }, [addedToastName]);

  /** 사전 분류로 보관 방법을 짐작한다 — 냉장 → 실온 → 냉동 순으로, 그 방법
   * 자체가 정의돼 있는 첫 번째 것. */
  const guessStorageKind = (name: string): StorageKind => {
    const cat = categoryMap[name];
    if (lookupShelfLifeDays(cat, 'fridge', name) != null) return 'fridge';
    if (lookupShelfLifeDays(cat, 'room', name) != null) return 'room';
    if (lookupShelfLifeDays(cat, 'frozen', name) != null) return 'frozen';
    return 'fridge';
  };

  const handleConfirmPurchase = async (didBuy: boolean) => {
    const name = confirmingPurchase;
    if (!name) return;
    setConfirmingPurchase(null);
    if (!didBuy) return;
    setAddingPurchase(true);
    try {
      const kind = guessStorageKind(name);
      const today = new Date();
      const purchase = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
      const estimated = estimateExpiry(name, kind, purchase, categoryMap);
      const current = readBoxes();
      const next: Record<StorageKind, FridgeItem[]> = {
        frozen: current.frozen || [], fridge: current.fridge || [], room: current.room || [],
      };
      const already = [...next.frozen, ...next.fridge, ...next.room].some(it => it.name === name);
      if (!already) {
        const newItem: FridgeItem = { id: `${name}-${Date.now()}`, name, purchase };
        if (estimated) newItem.estimatedExpiry = estimated;
        next[kind] = [...next[kind], newItem];
        try { localStorage.setItem('myfridge_ingredients', JSON.stringify(next)); } catch { /* 용량 초과 등 — 무시 */ }
        if (authUser?.id) {
          // 기기 목록을 통째로 올리지 않는다 — 서버 지금 목록에 이 재료만 더한다(utils/fridgeServer 설명).
          // source: 재료 기록에 "장보기에서 담음" 으로 남는다
          const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          const saved = await saveFridgeChange(authUser.id, token, cur => {
            if ([...cur.frozen, ...cur.fridge, ...cur.room].some(it => it.name === name)) return null;
            return { ...cur, [kind]: [...cur[kind], newItem] };
          }, 'shopping');
          if (!saved) console.warn('[WeeklyPlan] 구매 반영(서버) 실패 — 기기에는 남음');
        }
      }
      setBought(prev => new Set(prev).add(name));
      setAddedToastName(name);
    } finally {
      setAddingPurchase(false);
    }
  };

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

  const usablePool = React.useMemo(() => {
    if (!pool || !off || off.size === 0) return pool;
    return pool.filter(r => !ingredientsOf(r).some(n => off.has(n)));
  }, [pool, off]);

  /**
   * 진짜로 "그걸로 만든다" 할 만한 후보만.
   *
   * `pickDistinct` 의 2차 단계는 **빈 칸을 남기지 않으려고** 매칭률과 무관하게
   * 아무 후보나 끌어와 채운다. 냉장고에 한두 개만 있을 때 이 규칙이 그대로
   * 작동하면, 7일 전부가 남남인 요리로 채워져 장보기 목록이 30개를 넘어간다
   * (실사용 지적, 2026-09-15). 매칭률이 너무 낮은 후보는 애초에 이 풀에서
   * 뺀다 — 그러면 `pickDistinct` 도 채울 수 있는 날만큼만 채우고 나머지는
   * 빈 채로 남긴다(그 날엔 "재료가 적어서 못 채웠다" 는 안내가 대신 뜬다).
   *
   * 풀에 `match_rate` 자체가 없으면(옛 데이터) 이 기준을 적용할 수 없으니
   * 원래 풀을 그대로 쓴다. 반대로 `match_rate` 는 있는데 전부 기준 미달이면
   * — 그건 "가진 재료로 만들 수 있는 게 정말 없다" 는 뜻이므로 그대로
   * 빈 풀을 돌려준다. 억지로 채우지 않고, 화면은 기존 "재료가 없어요"
   * 안내로 정직하게 넘어간다.
   */
  const qualifiedPool = React.useMemo(() => {
    if (!usablePool) return usablePool;
    const hasMatchRate = usablePool.some(r => typeof r.match_rate === 'number');
    if (!hasMatchRate) return usablePool;
    return usablePool.filter(r => (r.match_rate as number) >= MIN_PLAN_MATCH_RATE);
  }, [usablePool]);

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
    // 무료 식단은 **누른 다음에만** 짠다 — 묻지 않았는데 결과부터 나오는
    // 게 낯설다는 지적(2026-09-16). AI 는 조건을 적고 누르는 것 자체가 요청이라
    // 이 게이트(`hasRequestedPlan`)를 거치지 않고 `askAi` 가 `slots` 를 직접 채운다.
    if (!hasRequestedPlan) return;
    if (!qualifiedPool || qualifiedPool.length === 0) return;
    const same = appliedKey.current === planKey;
    appliedKey.current = planKey;
    setSlots(prev => {
      // 조건이 그대로인데 이미 짜 둔 게 있으면 손대지 않는다.
      if (same && prev.some(s => s.meals.length > 0)) return prev;
      const picked = pickDistinct(qualifiedPool, prev.length);
      // 처음엔 하루 한 끼로 채운다. 더 넣고 빼는 건 사용자가 한다.
      return prev.map((s, i) => ({
        ...s,
        meals: picked[i] ? [{ recipe: picked[i], on: true }] : [],
      }));
    });
  }, [qualifiedPool, planKey, hasRequestedPlan]);

  const allMeals = slots.flatMap(s => s.meals);
  const usedIds = new Set(allMeals.map(m => m.recipe.id));

  /** 전체를 다시 짠다 (무료). 매번 같은 조합이 안 나오게 섞는다. */
  const reshuffle = () => {
    if (!qualifiedPool) return;
    setAiNote(null);
    setSaved(false);
    const shuffled = [...qualifiedPool].sort(() => Math.random() - 0.5);
    const picked = pickDistinct(shuffled, slots.length);
    setSlots(prev => prev.map((s, i) => ({
      ...s,
      meals: picked[i] ? [{ recipe: picked[i], on: true }] : [],
    })));
  };

  /** 지금 식단에 없는 요리 하나. 없으면 null. */
  const pickUnused = (): PlanRecipe | null => {
    if (!qualifiedPool) return null;
    const others = qualifiedPool.filter(r => !usedIds.has(r.id));
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

  /** AI 에게 짜 달라고 한다 (크레딧을 쓴다). 조건은 `wish`. */
  const askAi = async () => {
    const request = wish.trim();
    setAsking(true);
    setError(null);
    setAiNote(null);
    aiFailReason.current = '';
    // 서버는 부르기 전에 이미 깎는다. 식단은 답이 오래 걸려서, 그때까지
    // 숫자가 그대로면 "안 나갔나" 싶다 — 먼저 깎아 보이고 응답이 오면
    // 아래 `applyUsage` 가 서버 값으로 덮는다.
    spendOptimistically(planCost);
    try {
      const res = await fetch(`${API_BASE_URL}/api/plan/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...usageHeaders() },
        body: JSON.stringify({
          ingredients: planIngredients,
          expiring: priority,
          request,
        }),
      });
      const data = await res.json().catch(() => null);
      applyUsage(data?.usage);
      if (data?.basket) setBasket(data.basket);
      aiReason.current = String(data?.summary || '').trim();
      track('chat_use', 'plan');

      if (!res.ok) {
        // 비회원 체험을 다 썼으면 같은 로그인 확인창을 띄운다.
        if (data?.usage?.is_guest && data.usage.can_use_ai === false) {
          openLoginGate('ai', { credits: data.usage.signup_credits });
        }
        aiFailReason.current = (data && data.error) || '식단을 짜지 못했어요.';
        setError(aiFailReason.current);
        return;
      }
      const got: PlanRecipe[] = data.plan || [];
      if (got.length === 0) {
        aiFailReason.current = '조건에 맞는 요리를 못 찾았어요. 요청을 조금 느슨하게 해 보세요.';
        setError(aiFailReason.current);
        return;
      }
      setSlots(prev => prev.map((s, i) => ({
        ...s,
        meals: got[i] ? [{ recipe: got[i], on: true }] : [],
      })));
      setSaved(false);
      setAiNote(aiReason.current || (request ? `"${request}" 을(를) 반영했어요.` : 'AI 가 새로 골랐어요.'));
    } catch {
      aiFailReason.current = '네트워크 상태를 확인하고 다시 시도해 주세요.';
      setError(aiFailReason.current);
    } finally {
      setAsking(false);
    }
  };

  /** 재료가 하나도 없으면 부를 이유가 없다. 크레딧만 나간다. */
  const noStock = planIngredients.length === 0;

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

  const commit = (mode: PlanMode) => {
    const fromPast = pendingMeals !== null;
    const meals = pendingMeals ?? buildMeals();
    // `fill` 은 이미 정해 둔 날은 건드리지 않아서 실제로 담긴 것은 겹치지 않은 날뿐이다.
    const clashSet = new Set(conflict ?? []);
    savePlan(meals, mode);
    setConflict(null);
    setPendingMeals(null);
    if (!fromPast) setSaved(true);
    setToast(mode === 'fill' ? meals.filter(m => !clashSet.has(m.date)).length : meals.length);
    track('recipe_action', 'plan_apply');
  };

  /**
   * 담기 전에 **겹치는 날이 있으면 묻는다.**
   *
   * 전에는 말없이 덮어썼다. 며칠에 걸쳐 고쳐 둔 계획이 버튼 한 번에 사라지는데,
   * 사라졌다는 사실조차 화면에 안 나왔다.
   */
  const applyPlan = async () => {
    // 다른 기기·앱에서 짠 내 계획(서버에만 있는 것)도 겹침으로 세도록 먼저 기기 쪽을 서버와 맞춘다.
    await pullMyPlansIntoLocal();
    const days = conflictingDates(buildMeals());
    if (days.length === 0) { commit('overwrite'); return; }
    setPendingMeals(null);
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

  const planCost = (usage?.credits as Record<string, number> | undefined)?.plan ?? 3;
  // 비회원도 체험분이 남아 있으면 AI 식단을 써 볼 수 있다.
  const canAi = !!usage && usage.can_use_ai;
  // 비회원이 체험 크레딧을 다 쓴 상태. 입력칸·보내기가 잠겨 있으면 안내가 뜰 구멍조차 없었다(2026-10-22 사용자 지적) —
  // AI 화면에 **들어오는 순간** 확인창을 띄우고, 잠그는 대신 눌렀을 때도 같은 확인창을 띄운다.
  const guestOut = !!usage && usage.is_guest && !usage.can_use_ai;
  const aiTappable = canAi || guestOut;
  const guestCreditsNow = usage?.signup_credits;

  /** 조건을 한 글자라도 적었나. 적었으면 AI(크레딧), 아니면 무료. */
  const hasWish = wish.trim().length > 0;
  const hasResult = slots.some(s => s.meals.length > 0);

  /** 예시 조건 칩 — 누르면 입력칸에 더하고, 다시 누르면 뺀다. */
  const togglePreset = (preset: string) => {
    setWish(w => {
      const parts = w.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
      return (parts.includes(preset) ? parts.filter(x => x !== preset) : [...parts, preset]).join(', ');
    });
  };

  /** 버튼 하나가 두 가지를 한다: 조건이 있으면 AI 로, 없으면 무료 규칙으로. */
  const runPlan = () => {
    if (asking) return;
    if (hasWish && !noStock) {
      if (guestOut) { openLoginGate('ai', { credits: guestCreditsNow }); return; }
      void askAi();
      return;
    }
    setSaved(false);
    setAiNote(null);
    setHasRequestedPlan(true);
  };

  const Spark: React.FC<{ size?: number }> = ({ size = 14 }) => <SparklesIcon size={size} strokeWidth={2} />;

  /** 조건 칸. **반짝임(✦)은 AI 가 하는 곳에만** 붙는다 — 크레딧이 나가는 자리를 한눈에 가르려고. */
  const conditionSection = (
    <section
      ref={aiBox}
      className="ai-card"
      style={{
        background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 10,
        // 옛 주소(`?ai=1`)로 데려온 자리라는 걸 잠깐 알려 준다.
        outline: fromAi ? '2px solid #FFD600' : 'none', outlineOffset: 2,
      }}
    >
      <SectionHead
        title={
          <>
            <span className="ai-tag" style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.04em', padding: '2px 6px', borderRadius: 6,
              background: '#1A1A1E', color: '#FFD600',
            }}>AI</span>
            조건이 있나요?
            <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--ink-500)' }}>(선택)</span>
          </>
        }
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* 입력창 안 왼쪽의 ✦ — 번쩍이는 효과 대신 **조용한 표시**로 「AI 가 읽는 칸」임을 알린다(2026-11-07 「연한 빛 애니메이션은 촌스럽다」). */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span aria-hidden style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#C99700', display: 'inline-flex', pointerEvents: 'none',
          }}>
            <Spark size={16} />
          </span>
          <input
            ref={wishInput}
            value={wish}
            onChange={e => setWish(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runPlan(); }}
            placeholder="예: 아이 먹을 것 위주로"
            disabled={asking}
            style={{
              width: '100%', minHeight: 44, borderRadius: 12,
              border: '1px solid var(--line-200)', padding: '0 12px 0 36px', fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>
        {/* 말로 입력. 입력칸에 채우기만 하고 짜기는 아래 버튼으로 직접 한다. */}
        <VoiceInputButton value={wish} onText={setWish} onError={setError} disabled={asking} size={44} />
      </div>
      {/* 칩은 **한 줄로 옆으로 민다** — 여러 줄로 펼치면 화면이 칩으로 가득 찬다(2026-11-07 「너무 복잡하다」). */}
      <div style={{
        display: 'flex', flexWrap: 'nowrap', gap: 6, overflowX: 'auto',
        margin: '10px -16px 0', padding: '0 16px', scrollbarWidth: 'none',
      }}>
        {WISH_PRESETS.map(x => {
          const on = wish.split(/\s*,\s*/).map(s => s.trim()).includes(x);
          return (
            <button
              key={x}
              type="button"
              aria-pressed={on}
              onClick={() => togglePreset(x)}
              disabled={asking}
              style={{
                flex: 'none', whiteSpace: 'nowrap',
                minHeight: 30, padding: '6px 11px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                background: on ? '#FFF3B0' : 'var(--surface-sub)',
                color: on ? '#7A5C00' : 'var(--ink-700)', fontSize: 12.5, fontWeight: on ? 700 : 500,
              }}
            >
              {x}
            </button>
          );
        })}
      </div>
      {/* 결과가 이미 있을 때 조건을 바꿔 다시 짜는 길. 처음(결과 없음)에는 맨 아래 큰 버튼이 이 일을 한다. */}
      {hasResult && hasWish && !asking && (
        <span style={{ position: 'relative', display: 'block', marginTop: 12 }}>
          <button
            type="button"
            className="ai-action"
            onClick={runPlan}
            style={{
              width: '100%', minHeight: 44, borderRadius: 22, cursor: 'pointer',
              fontSize: 13.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Spark size={14} />
            이 조건으로 다시 짜기 · {planCost} 크레딧
          </button>
          <span className="ai-fab-badge">AI</span>
        </span>
      )}
    </section>
  );

  /** 아래에 붙는 큰 버튼 — 결과가 없을 때만. 결과가 나오면 「마이캘린더에 담기」가 그 자리를 이어받는다. */
  const requestBar = !hasResult && !asking && (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 'var(--z-sticky)' as any, marginTop: 12,
      padding: '10px 0 calc(10px + env(safe-area-inset-bottom, 0px))', background: 'var(--surface-sub)',
    }}>
      {/* 무료(조건 없음)는 평평한 노랑, **AI(조건 있음)는 빛줄기 애니메이션 + 「AI」 배지**(2026-11-06) — 크레딧이 나가는 순간을
          움직임과 배지로 알린다. 배지는 버튼(`overflow: hidden`) 밖 형제로 둔다. */}
      <span style={{ position: 'relative', display: 'block' }}>
        <button
          type="button"
          className={hasWish && !noStock ? 'ai-action' : undefined}
          onClick={runPlan}
          style={{
            width: '100%', minHeight: 48, borderRadius: 24, border: 'none', cursor: 'pointer',
            background: '#FFD600', color: '#1A1A1E',
            fontSize: 14.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {hasWish && !noStock ? (<><Spark size={15} />조건에 맞춰 짜기 · {planCost} 크레딧</>) : '식단 짜기'}
        </button>
        {hasWish && !noStock && <span className="ai-fab-badge">AI</span>}
      </span>
      {hasWish && !noStock ? (
        <UsageLine style={{ justifyContent: 'center', marginTop: 6 }} cost={planCost} />
      ) : (
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-500)', marginTop: 6 }}>
          무료예요 · 마음에 들 때까지 다시 짜도 돼요
        </div>
      )}
    </div>
  );

  /** 「날짜 바꾸기」 시트 — 무료 화면과 AI 화면이 같이 쓴다. 고르면 바로 옮기는 자리라 목록 줄로 둔다(확인 단계 없음). */
  const moveSheet = (
    <Sheet
      open={moving !== null}
      onClose={() => setMoving(null)}
      title="어느 날로 옮길까요?"
      maxHeight="70dvh"
      dismissLabel="닫기"
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {slots.map((s, j) => {
          const here = moving !== null && moving.day === j;
          return (
            <button
              key={j}
              type="button"
              disabled={here}
              onClick={() => { if (moving) moveTo(moving.day, moving.at, j); setMoving(null); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                minHeight: 48, padding: '0 4px', border: 'none', background: 'transparent',
                borderTop: j === 0 ? 'none' : '1px solid var(--line-200)', textAlign: 'left',
                fontSize: 15, fontWeight: 600, color: here ? 'var(--ink-400)' : 'var(--ink-900)',
                cursor: here ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {dayLabel(s.date)}
              {here && <span style={{ fontSize: 12, fontWeight: 500 }}>지금 이 날</span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );

  /**
   * 하루 한 줄 목록(2026-11-06) — 왼쪽 날짜, 가운데 사진·제목, 오른쪽 `⋯`. 빈 날 줄과 「다른 요리로」「이 날 요리 추가」가
   * 있고, 흰 상자 하나에 담는다.
   */
  const planRows = () => {
    let n = 0;
    const openMeal = (r: PlanRecipe) => {
      track('recipe_open', String(r.id));
      openCookMode({ id: r.id, title: r.title, link: r.link, myIngredients });
    };
    const rows = slots.flatMap((slot, i) => {
      const showMonth = n === 0 || slot.date.getDate() === 1;
      const dateCol = (
        <span style={{ flex: 'none', width: 34, textAlign: 'center', lineHeight: 1.25 }}>
          <span style={{ display: 'block', minHeight: 13, fontSize: 10.5, color: 'var(--ink-500)' }}>
            {showMonth ? `${slot.date.getMonth() + 1}월` : ''}
          </span>
          <b style={{ display: 'block', fontSize: 17, fontWeight: 800, color: 'var(--ink-900)' }}>
            {slot.date.getDate()}
          </b>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-500)' }}>
            {DAY_NAMES[slot.date.getDay()]}
          </span>
        </span>
      );
      const rowStyle = (): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
        borderTop: n++ === 0 ? 'none' : '1px solid var(--line-200)',
      });

      if (slot.meals.length === 0) {
        /* 옮기고 나면 빈 날이 생긴다. 그것도 정상이라고 말해 준다. */
        return [(
          <div key={slot.date.toISOString()} style={rowStyle()}>
            {dateCol}
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-500)' }}>이 날은 비워 뒀어요</span>
            <button
              type="button"
              onClick={() => addTo(i)}
              style={{
                flex: 'none', height: 30, padding: '0 10px', borderRadius: 8,
                border: '1px solid var(--line-200)', background: 'var(--surface)',
                fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', cursor: 'pointer',
              }}
            >
              + 요리 추가
            </button>
          </div>
        )];
      }

      return slot.meals.map((meal, k) => (
        <div key={slot.date.toISOString() + '-' + meal.recipe.id + '-' + k} style={rowStyle()}>
          {k === 0 ? dateCol : <span style={{ flex: 'none', width: 34 }} />}
          <button
            type="button"
            onClick={() => openMeal(meal.recipe)}
            aria-label={`${meal.recipe.title} 조리 순서 보기`}
            style={{ flex: 'none', width: 64, height: 64, padding: 0, border: 'none',
                     borderRadius: 10, overflow: 'hidden', background: 'var(--surface-sub)', cursor: 'pointer' }}
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
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <span aria-hidden style={{ fontSize: 18 }}>&#127869;</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openMeal(meal.recipe)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent',
                     padding: 0, cursor: 'pointer' }}
          >
            <span style={{
              display: '-webkit-box', fontSize: 14, fontWeight: 700, color: 'var(--ink-900)',
              lineHeight: 1.4, overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{meal.recipe.title}</span>
            {meal.recipe.why ? (
              <span style={{ display: 'block', fontSize: 12, color: '#7A5C00', marginTop: 3 }}>{meal.recipe.why}</span>
            ) : typeof meal.recipe.match_rate === 'number' ? (
              <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
                가진 재료로 {meal.recipe.match_rate}% 만들 수 있어요
              </span>
            ) : null}
          </button>
          <span style={{ flex: 'none', margin: '0 -8px 0 -4px' }}>
            <KebabMenu
              ariaLabel={`${meal.recipe.title} 더보기`}
              items={[
                { label: '다른 요리로', onClick: () => swapOne(i, k) },
                { label: '날짜 바꾸기', onClick: () => setMoving({ day: i, at: k }) },
                { label: '이 날 요리 추가', onClick: () => addTo(i) },
                { label: '빼기', onClick: () => removeAt(i, k), danger: true },
              ]}
            />
          </span>
        </div>
      ));
    });
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, padding: '0 12px',
      }}>
        {rows}
      </div>
    );
  };

  /** 짜인 식단(카드 목록 + 반영 버튼). */
  const planSection = (
    <>
        {usablePool !== null && !asking && slots.some(s => s.meals.length > 0) && (
          <>
            {/* 이 화면의 **결과**. 앞 두 영역은 여기로 오기 위한 자리다.
                크레딧 안내를 따로 상자에 담았더니 카드가 한 칸 더 밀려 내려갔다 —
                제목 밑줄로 붙인다. */}
            <SectionHead
              title="이번 주 식단"
              hint={<>냉장고 재료로 · 곧 상하는 것부터 · 바꾸기는 공짜</>}
              right={
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {/* 무료 — 마음에 들 때까지 눌러도 된다. 여기에 크레딧을 물리면
                      사용자가 누르기를 주저하고, 그러면 식단을 완성하지 못한 채
                      나간다. 이 버튼의 값어치가 바로 "공짜" 다. */}
                  <button
                    type="button"
                    onClick={reshuffle}
                    style={{
                      minHeight: 30, padding: '7px 10px', borderRadius: 8,
                      border: '1px solid var(--line-200)', background: 'var(--surface)',
                      fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
                    }}
                  >
                    ↻ 다시 추천
                  </button>

                </span>
              }
            />

            {/* AI 로 짠 식단이면 **조건을 어떻게 읽었는지** 한 줄. 무료 식단에는 없다. */}
            {/* 서버 요약은 네 문장쯤이라 길다 — 두 줄로 접어 두고 누르면 펼친다. */}
            {aiNote && (
              <button
                type="button"
                onClick={() => setNoteOpen(v => !v)}
                aria-expanded={noteOpen}
                style={{
                  display: 'flex', gap: 6, alignItems: 'flex-start', width: '100%', marginBottom: 10,
                  padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer',
                  fontSize: 12.5, color: '#3A6B2E', fontWeight: 600, lineHeight: 1.6, fontFamily: 'inherit',
                }}
              >
                <span style={{ marginTop: 3, color: '#1A1A1E' }}><Spark size={12} /></span>
                <span style={noteOpen ? { flex: 1 } : {
                  flex: 1, display: '-webkit-box', overflow: 'hidden',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{aiNote}</span>
                <span aria-hidden style={{ flex: 'none', color: 'var(--ink-500)', fontWeight: 400 }}>{noteOpen ? '접기 ▴' : '더보기 ▾'}</span>
              </button>
            )}

            {/* 무료로 짠 결과를 본 **직후**가 AI 를 권하기 가장 좋은 순간이다 — 조건을 추가하면 AI 가 다시 짠다는 걸 여기서 알린다.
                예전엔 긴 목록 **맨 아래** 흰 바탕·얇은 테두리 한 줄이라 아무도 못 봤다(2026-11-07 「너무 안 보인다」). 다른 AI 입구(쿡 코치·식단 짜기)와
                같은 검정 알약(`ai-fab-pill k`)으로 만들고 **목록 바로 위**로 올렸다. 누르면 접어 둔 조건 칸을 펼치고 입력창으로 데려간다
                (크레딧은 거기서 짜기를 누를 때 나간다). */}
            {!aiNote && !editOpen && (
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className="ai-fab-pill k"
                  onClick={() => {
                    setEditOpen(true);
                    window.setTimeout(() => {
                      aiBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      window.setTimeout(() => wishInput.current?.focus(), 350);
                    }, 80);
                  }}
                  style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}
                >
                  <Spark size={16} />
                  <span>조건을 추가해 AI로 다시 짜기</span>
                  <span className="ai-tag" style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '.04em', padding: '1.5px 6px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', flexShrink: 0,
                  }}>AI</span>
                </button>
                <div style={{ marginTop: 6, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-500)', wordBreak: 'keep-all' }}>
                  아이·다이어트처럼 말하면 맞춰 짜 드려요 · {planCost}크레딧
                </div>
              </div>
            )}

            {/* 하루 **한 줄**(2026-11-06). */}
            {planRows()}

            {/* 「이걸 하려면 장보기 N개 · 장보기 목록으로 보기」 박스는 뺐다(2026-10-10 요청 — AI 식단 화면에서 이미 뺀 것과
                맞춤). 장보기 목록은 아래 한 곳에만 있다. */}

            {/* 반영하기 — 이게 없으면 "짜고 끝" 이다. 긴 목록 맨 끝에 있으면 한참 내려가야 보여서 **아래에 붙여 둔다**(2026-11-06).
                몇 일치를 담는지 버튼에 적는다. */}
            <div style={{
              position: 'sticky', bottom: 0, zIndex: 'var(--z-sticky)' as any, marginTop: 12,
              padding: '10px 0 calc(10px + env(safe-area-inset-bottom, 0px))', background: 'var(--surface-sub)',
            }}>
              <button
                type="button"
                onClick={applyPlan}
                style={{
                  width: '100%', minHeight: 48, borderRadius: 12, border: 'none',
                  background: saved ? '#1A1A1E' : '#FFD600',
                  color: saved ? '#FFD600' : '#1A1A1E',
                  fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
                  transition: 'background .18s ease, color .18s ease',
                }}
              >
                {saved
                  ? '캘린더에 담았어요 · 다시 담기'
                  : `마이캘린더에 담기 · ${slots.filter(s => s.meals.some(m => m.on)).length}일`}
              </button>
              {saved && (
                <button
                  type="button"
                  onClick={() => navigate('/cooking-calendar')}
                  style={{
                    width: '100%', minHeight: 40, marginTop: 6, borderRadius: 10,
                    border: '1px solid var(--line-200)', background: 'var(--surface)',
                    fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
                  }}
                >
                  마이캘린더에서 보기 ›
                </button>
              )}
            </div>

            {moveSheet}
          </>
        )}
    </>
  );

  // 위쪽 여백 72 는 고정 헤더(56) + 여백(16). 다른 화면들과 같은 값이다.
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-sub)',
                  padding: '72px 14px 90px' }}>
      {/* 제목 줄과 버튼 줄을 **나눈다.**
          두 버튼을 제목과 같은 줄 오른쪽 끝에 절대배치했더니, `지난 대화 3` 과
          `새 대화` 가 함께 나올 때 가운데 제목(`AI 식단 추천`)에 맞닿아 한
          덩어리로 읽혔다 — 좁은 화면일수록 심하다. 줄을 바꾸면 제목은 제목대로
          가운데에 남고, 두 버튼은 한 짝으로 보인다. */}
      {/* 대화가 길어지면 "지난 대화"·"새 대화"가 스크롤을 따라 위로 밀려
          올라가 버려서, 다시 물으려면 맨 위로 올라가야 했다(실사용 지적,
          2026-09-16). 고정 전역 헤더(56px) 바로 아래에 붙는 두 번째 층으로
          만든다 — 채팅이 아무리 길어져도 이 줄은 항상 그 자리에 있다. */}
      {/* 아래쪽에 **스티키 여백(paddingBottom 14)과 페이드**를 둔다(2026-09-20, "버튼 아래 스티키 영역이
          너무 없다"). 전에는 여백이 없어서 스크롤하면 말풍선·카드가 버튼 바로 아래 가장자리에
          딱 붙어 지나갔다. 위쪽 margin 이 아니라 **배경이 있는 padding** 이어야 그 자리를 덮는다. */}
      <div style={{
        marginBottom: 6, position: 'sticky', top: 56, zIndex: 'var(--z-sticky)' as any,
        background: 'var(--surface-sub)', paddingTop: 4, paddingBottom: 14, marginTop: -4,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', minHeight: 40 }}>
          <BackButton onClick={() => navigate(-1)} style={{ left: 0, top: 2 }} />
          <div style={{ fontWeight: 700, fontSize: 18, textAlign: 'center', padding: '0 56px' }}>
            식단 짜기
          </div>
        </div>
        {/* 스티키 영역 아래 가장자리를 부드럽게 — 내용이 딱 잘린 것처럼 보이지 않게 한다 */}
        <div aria-hidden style={{
          position: 'absolute', left: 0, right: 0, bottom: -12, height: 12, pointerEvents: 'none',
          // 끝색을 검정 투명(rgba(0,0,0,0))이 아니라 같은 배경색의 투명으로 — 사파리에서 회색 띠가 끼는 것을 피한다
          background: 'linear-gradient(to bottom, #F5F5F7, rgba(245,245,247,0))',
        }} />
      </div>

      {/* 만들어 보기 전에 미리 말한다 — 다 짜 놓고 "왜 이렇게 부실하지"
          보다야, 누르기 전에 "재료가 적다" 를 아는 편이 낫다. AI·무료
          둘 다 같은 `myIngredients` 를 쓰므로 한 자리에만 둔다. 이미 결과가
          나와 있으면(뭔가 채워진 날이 있으면) 아래 결과 쪽 안내와 겹치니 뺀다. */}
      {planIngredients.length > 0 && planIngredients.length < LOW_INGREDIENT_WARN
        && !slots.some(s => s.meals.length > 0) && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid #E0B400', background: '#FFFDF2',
          fontSize: 12.5, color: '#7A5C00', lineHeight: 1.6, wordBreak: 'keep-all',
        }}>
          재료가 {planIngredients.length}개뿐이라 이번 주 7일을 다 못 채울 수도 있어요.
          재료를 몇 개 더 넣으면 더 다양하게 추천해 드려요.
        </div>
      )}

      {/* ── ① 무엇으로 짜나 ─────────────────────────────────
          채팅 화면에는 위에 접힌 `쓸 재료` 가 이미 있다. 둘을 다 두면 같은
          것이 두 번 나온다. */}
      {/* 접었을 때 짧아야 한다. 이 영역이 길면 정작 결과인 식단이 화면 밖으로
          밀려나서, 사용자가 이 화면을 "재료 화면" 으로 읽는다. */}
      {/* 첫 화면의 질문 한 줄(당근식: 한 화면에 한 가지 질문). 결과가 나온 뒤에는 필요 없다. */}
      {!hasResult && (
        <div style={{ padding: '4px 4px 16px' }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.35, wordBreak: 'keep-all' }}>
            이번 주, 뭐 해 먹을까요?
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 6, lineHeight: 1.6, wordBreak: 'keep-all' }}>
            일반은 무료이고, 조건을 추가하면 AI가 식단을 짜요
          </div>
        </div>
      )}

      {/* 결과가 나온 뒤에는 「재료·조건」 카드 두 장을 **한 줄로 접는다** — 식단이 바로 보이게. 눌러서 바꾼다. */}
      {hasResult && !editOpen && (
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10,
            background: 'var(--surface)', border: '1px solid var(--line-200)', borderRadius: 14,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink-700)',
                         whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <b style={{ color: 'var(--ink-900)' }}>재료 {planIngredients.length}개</b>
            {hasWish ? <> · {wish.trim()}</> : <> · 일반 식단</>}
          </span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--ink-900)' }}>바꾸기 ›</span>
        </button>
      )}

      {(!hasResult || editOpen) && (
      <section style={{
        background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      }}>
        <SectionHead
          title="쓸 재료"
          hint={
            pickOpen ? (
              <>
                냉장고 {myIngredients.length}개 중 <b style={{ color: 'var(--ink-700)' }}>{planIngredients.length}개</b> 쓰는 중
                {stale.length > 0 && <> · 오래된 {stale.length}개는 뺐어요</>}
                <br />
                <span style={{ color: 'var(--ink-700)', fontWeight: 600 }}>재료를 누르면 빼고, 다시 누르면 넣어요</span>
              </>
            ) : (
              // 접힌 모습은 **한 줄 요약**만 — 칩을 늘어놓으면 이 화면이 「재료 화면」으로 읽힌다.
              <span style={{ wordBreak: 'keep-all' }}>
                <b style={{ color: 'var(--ink-700)' }}>{planIngredients.length}개</b>로 짜요
                <br />
                {expiring.length > 0
                  ? <>곧 상하는 {expiring.slice(0, 2).map(i => i.name).join('·')}{expiring.length > 2 ? ` 외 ${expiring.length - 2}개` : ''}부터</>
                  : <>유통기한을 넣으면 곧 상하는 것부터 골라요</>}
              </span>
            )
          }
          right={
            <button
              type="button"
              onClick={() => setPickOpen(v => !v)}
              style={{
                flexShrink: 0, minHeight: 30, padding: '7px 10px', borderRadius: 8,
                border: '1px solid var(--line-200)', background: 'var(--surface)',
                fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
              }}
            >
              {pickOpen ? '접기 ▴' : '바꾸기 ▾'}
            </button>
          }
        />

        {/* 펼쳤을 때만 칩이 보인다 */}
        {pickOpen && (expiring.length > 0 ? (
          <>
            <div style={{ fontSize: 12, color: '#C4342B', fontWeight: 700, marginBottom: 6 }}>
              곧 상해요
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {expiring.map(i => (
                <IngredientChip
                  key={'s' + i.storage + i.name}
                  label={i.name + ' · ' + daysLabel(i.days, i.estimated)}
                  on={!off?.has(i.name)}
                  tone={expiryTone(i.days, i.estimated)}
                  onToggle={() => toggle(i.name)}
                />
              ))}
            </div>
          </>
        ) : null)}

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
                  오래됐어요
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {stale.map(i => (
                    <IngredientChip
                      key={'t' + i.storage + i.name}
                      label={i.name + ' · ' + daysLabel(i.days, i.estimated)}
                      on={!off?.has(i.name)}
                      tone={expiryTone(i.days, i.estimated)}
                      onToggle={() => toggle(i.name)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/my-fridge')}
                  style={{
                    marginTop: 8, minHeight: 30, padding: '7px 10px', borderRadius: 8,
                    border: '1px solid var(--line-200)', background: 'var(--surface)',
                    fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
                  }}
                >
                  이미 버렸다면 냉장고에서 정리하기 ›
                </button>
              </div>
            )}

            <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 12, lineHeight: 1.6 }}>
              눌러서 빼고 넣어요.
            </div>
          </div>
        )}
      </section>
      )}

      {(!hasResult || editOpen) && conditionSection}
      {!hasResult && lastPlan && !asking && (
        <button
          type="button"
          onClick={restoreLastPlan}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10,
            background: 'transparent', border: '1px dashed var(--line-200)', borderRadius: 14,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink-700)' }}>
            지난번에 AI가 짠 식단이 있어요
            <span style={{ color: 'var(--ink-500)' }}>
              {' · '}{new Date(lastPlan.at).getMonth() + 1}월 {new Date(lastPlan.at).getDate()}일
            </span>
          </span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--ink-900)' }}>다시 보기 ›</span>
        </button>
      )}
      {hasResult && editOpen && (
        <button
          type="button"
          onClick={() => setEditOpen(false)}
          style={{
            display: 'block', margin: '0 auto 10px', minHeight: 32, padding: '6px 14px', borderRadius: 9999,
            border: 'none', background: 'transparent', color: 'var(--ink-500)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          접기 ▴
        </button>
      )}

      {error && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 16,
                      marginBottom: 12, fontSize: 13, color: '#D14343', lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {requestBar}

      {/* 무료는 후보를 불러오는 동안, AI 는 응답이 오는 동안 보여 준다. */}
      {((hasRequestedPlan && usablePool === null) || asking) && (
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
            note={asking ? 'AI가 요청을 반영하는 중이에요. 보통 5~10초.' : '보통 2~5초쯤 걸려요'}
            rows={4}
          />
        </div>
      )}

      {hasRequestedPlan && usablePool !== null && !asking && slots.every(s => s.meals.length === 0) && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '20px 16px',
                      fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
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
              marginTop: 12, minHeight: 40, padding: '12px 16px', borderRadius: 10,
              border: 'none', background: '#FFD600', color: '#1A1A1E',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {off && off.size > 0 && pool && pool.length > 0 ? '재료 다시 고르기' : '내 냉장고로 가기'}
          </button>
        </div>
      )}

      {/* 재료가 적어서 7일을 다 못 채웠을 때 — 그냥 며칠이 빈 채로 있으면
          "왜 며칠은 비었지"가 된다. 왜 그런지, 어떻게 하면 더 채워지는지를
          바로 말해 준다(실사용 지적: 재료 하나로 7일을 채우려니 장보기가
          30개를 넘었던 문제, 2026-09-15 — 그 대신 채울 수 있는 날만 채우고
          나머지는 이렇게 설명한다). */}
      {usablePool !== null && !asking
        && slots.some(s => s.meals.length > 0) && slots.some(s => s.meals.length === 0) && (
        <div style={{
          marginBottom: 10, padding: '10px 12px', borderRadius: 10,
          border: '1px solid #E0B400', background: '#FFFDF2',
          fontSize: 12.5, color: '#7A5C00', lineHeight: 1.6, wordBreak: 'keep-all',
        }}>
          냉장고 재료가 적어서 {slots.filter(s => s.meals.length > 0).length}일치만 추천했어요.
          재료를 더 넣으면 나머지 날도 채울 수 있어요.
        </div>
      )}

      {planSection}

      {conflict && (
        <Dialog
          open
          onClose={() => { setConflict(null); setPendingMeals(null); }}
          title="이미 짜 둔 계획이 있어요"
          width={340}
          dismissLabel="그만두기"
        >
          {/* 버튼 안에 설명을 두 줄로 넣었더니 44px 밖으로 튀어나갔다.
              **버튼 이름만으로 뜻이 통하게** 짓고 설명은 걷어낸다. */}
          {/* AI 식단·일반 식단 모두 이 창 하나를 쓴다. 선택지(2026-10-14 사용자 요청):
              이걸로 바꾸기 / 하나 더 넣기(그 날 계획 옆에) / 그만두기.
              「계획 없는 날에 넣기(빈 날에만)」는 헷갈린다는 지적으로 뺐다. */}
          <div>
            <PlanConflictSummary dates={conflict} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {([
                ['overwrite', '이걸로 바꾸기'],
                ['add', '하나 더 넣기'],
              ] as [PlanMode, string][]).map(([mode, text], i) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => commit(mode)}
                  style={{
                    minHeight: 46, borderRadius: 10,
                    border: i === 0 ? 'none' : '1px solid var(--line-200)',
                    background: i === 0 ? '#FFD600' : 'var(--surface)',
                    color: '#1A1A1E', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {text}
                </button>
              ))}
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
          <span>마이캘린더에 {toast}끼를 담았어요</span>
          <button type="button" onClick={() => navigate('/cooking-calendar')}>
            보기
          </button>
        </div>
      )}

      {/* ── 장보기 목록 ────────────────────────────────────── */}
      {/* 종이 다이어리 느낌(크림색·구멍·손글씨체) → "너무 옛날식 UI" 지적으로
          한 번 걷어냈다가, "종이 질감 자체는 괜찮은데 색이 탁했다, 종이
          클립을 꽂은 느낌을 내고, 진짜 괜찮은 손글씨체면 써 달라"는 후속
          요청(2026-09-17)으로 마이캘린더의 장보기 메모와 같은 모양으로
          다시 다듬었다 — 바깥은 앱 공용 흰 박스(제목만), 안쪽 목록만 채도
          낮은 종이색 + 클립 아이콘 + Gamja Flower 손글씨(재료 이름에만 —
          Nanum Pen Script는 가독성이 떨어진다는 지적으로 교체). */}
      {shopping.length > 0 && (
        <div id="shopping-list" style={{
          background: '#FFFFFF', border: '1px solid var(--line-200)',
          borderRadius: 14, marginTop: 16, padding: '14px 16px 16px',
          scrollMarginTop: 80,
        }}>
          {/* "장보기 목록" 만 있으면 뭘 위한 목록인지 헷갈린다는 지적
              (2026-09-16) — 이 식단에서 나온 목록임을 제목에 바로 적는다. */}
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#1A1A1E' }}>
            이 식단 장보기 {shopping.length}개
          </h2>

          <div style={{
            position: 'relative', borderRadius: 12,
            background: '#FFFCF2', border: '1px solid rgba(0,0,0,.06)',
            boxShadow: '0 3px 10px rgba(0,0,0,.05)',
            padding: '20px 14px 12px',
          }}>
            <svg
              aria-hidden width="26" height="34" viewBox="0 0 24 24" fill="none"
              stroke="#9098A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', top: -12, left: 16, transform: 'rotate(-8deg)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.12))' }}
            >
              <path d="M18.36 11.05l-8.19 8.19a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.13 8.13a2 2 0 0 1-2.83-2.83l7.42-7.42" />
            </svg>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 8, lineHeight: 1.6 }}>
              냉장고에 없는 것. <b>많이 쓰이는 순서</b>.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {shopping.map(([name, count]) => {
                const done = bought.has(name);
                const url = resolveCoupangUrl(name);
                return (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 2px', borderBottom: '1px solid rgba(0,0,0,.06)',
                  }}>
                    {/* 체크박스를 직접 눌러도(링크를 안 타고도) 같은 "사셨나요"
                        확인 → 냉장고 반영이 되어야 한다는 지적(2026-09-16) —
                        체크만 누르고 끝내는 사람도 있으니 조용히 넘어가면 안 됨.
                        해제는 확인 없이 바로(되돌리는 동작이라 다시 안 물음). */}
                    <button
                      type="button"
                      onClick={() => {
                        if (done) setBought(prev => { const next = new Set(prev); next.delete(name); return next; });
                        else setConfirmingPurchase(name);
                      }}
                      aria-label={`${name} ${done ? '샀음 표시 취소' : '샀어요로 표시'}`}
                      style={{
                        width: 19, height: 19, borderRadius: 5, flexShrink: 0, padding: 0,
                        border: done ? 'none' : '1.5px solid var(--line-300)',
                        background: done ? '#1A1A1E' : '#FFFFFF', color: '#FFD600',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M4.4 12.6l5.2 5.2 10-11.6" />
                        </svg>
                      )}
                    </button>
                    <span className="memo-handwrite" style={{
                      flex: 1, minWidth: 0, fontSize: 19, lineHeight: 1,
                      color: done ? 'var(--ink-500)' : 'var(--ink-900)',
                      textDecoration: done ? 'line-through' : 'none',
                    }}>
                      {name}
                      {count > 1 && (
                        <span style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 11.5, fontWeight: 400, color: 'var(--ink-500)' }}> · {count}개 요리</span>
                      )}
                    </span>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { track('coupang_click', name); pendingPurchaseRef.current = name; }}
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
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 10, lineHeight: 1.6 }}>
            쿠팡 파트너스 활동으로 일정 수수료를 받을 수 있어요. 체크하거나
            사고 돌아오면 냉장고에 바로 담아 드려요.
          </div>
        </div>
      )}

      {/* 장보기 링크 타고 나갔다 돌아왔을 때 뜨는 확인창 — 마이캘린더의
          장보기 목록과 같은 동작(2026-09-16). */}
      {confirmingPurchase && (
        <Dialog
          open
          onClose={() => handleConfirmPurchase(false)}
          title={`${confirmingPurchase} 사셨나요?`}
          width={300}
          dismissLabel="아니요"
          actions={[{
            label: addingPurchase ? '담는 중' : '네, 샀어요',
            onClick: () => handleConfirmPurchase(true),
          }]}
        >
          <span style={{ wordBreak: 'keep-all' }}>
            오늘 날짜로 내 냉장고에 바로 담아요.
            <br />
            보관 방법은 재료에 맞춰 정할게요.
          </span>
        </Dialog>
      )}
      {addedToastName && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)',
          zIndex: 'var(--z-toast)' as any, background: '#1A1A1E', color: '#FFD600',
          padding: '10px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 700,
          whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,.25)',
        }}>
          {addedToastName}이(가) 내 냉장고에 추가되었어요
        </div>
      )}
    </div>
  );
};

export default WeeklyPlan;
