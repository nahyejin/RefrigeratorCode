import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import StepLoading from '../components/StepLoading';
import { getMyIngredients } from '../utils/recipeUtils';
import { loadIngredientCategoryMap, type CategoryMap, type StorageKind } from '../utils/shelfLife';
import { findExpiring, daysLabel, type FridgeItem, type ExpiringItem } from '../utils/expiry';
import { openCookMode } from '../utils/cookMode';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { track } from '../utils/track';
import { usageHeaders, applyUsage } from '../utils/usage';
import { useUsage } from '../components/UsageMeter';

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
  const used = new Set<string>();
  for (const r of pool) {
    if (chosen.length >= count) break;
    const ings = ingredientsOf(r);
    const overlap = ings.filter(x => used.has(x)).length;
    if (chosen.length > 0 && ings.length > 0 && overlap >= Math.ceil(ings.length / 2)) continue;
    chosen.push(r);
    ings.forEach(x => used.add(x));
  }
  return chosen;
}

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

  // AI 식단
  const [wish, setWish] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [aiNote, setAiNote] = React.useState<string | null>(null);

  const boxes = React.useMemo(readBoxes, []);
  const myIngredients = React.useMemo(() => getMyIngredients(), []);

  React.useEffect(() => {
    void loadIngredientCategoryMap().then(setCategoryMap).catch(() => {});
  }, []);

  const expiring: ExpiringItem[] = React.useMemo(
    () => findExpiring(boxes, categoryMap, 5),
    [boxes, categoryMap],
  );

  // ── 후보 불러오기 (무료·규칙 기반) ────────────────────────────
  React.useEffect(() => {
    if (myIngredients.length === 0) { setPool([]); return; }
    const params = new URLSearchParams({
      my_ingredients: myIngredients.join(','),
      sort_by: 'match_rate',
      size: '40',
      page: '1',
    });
    const soon = expiring.filter(i => i.days >= 0).map(i => i.name);
    if (soon.length) params.set('applied_expiry_ingredients', soon.join(','));

    fetch(`${API_BASE_URL}/api/recipes/filter?${params}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setPool(d.recipes || []))
      .catch(() => setError('레시피를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
  }, [myIngredients, expiring]);

  // 후보가 도착하면 칸을 채운다 (아직 비어 있을 때만 — 사용자가 고른 걸 안 덮는다)
  React.useEffect(() => {
    if (!pool || pool.length === 0) return;
    setSlots(prev => {
      if (prev.some(s => s.recipe)) return prev;
      const picked = pickDistinct(pool, prev.length);
      return prev.map((s, i) => ({ ...s, recipe: picked[i] || null }));
    });
  }, [pool]);

  const usedIds = new Set(slots.map(s => s.recipe?.id).filter(Boolean) as number[]);

  /** 전체를 다시 짠다 (무료). 매번 같은 조합이 안 나오게 섞는다. */
  const reshuffle = () => {
    if (!pool) return;
    setAiNote(null);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = pickDistinct(shuffled, slots.length);
    setSlots(prev => prev.map((s, i) => ({ ...s, recipe: picked[i] || null })));
  };

  /** 한 칸만 다른 요리로 (무료). 지금 식단에 없는 것 중에서 고른다. */
  const swapOne = (index: number) => {
    if (!pool) return;
    const others = pool.filter(r => !usedIds.has(r.id));
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
          ingredients: myIngredients,
          expiring: expiring.filter(i => i.days >= 0).map(i => i.name),
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
      setAiNote(wish.trim() ? `"${wish.trim()}" 을(를) 반영했어요.` : 'AI 가 새로 짰어요.');
    } catch {
      setError('네트워크 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      setAsking(false);
    }
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
          이번 주 식단
        </div>
      </div>

      {/* ── 왜 이 식단인가 ─────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
        fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.7,
      }}>
        {expiring.length > 0 ? (
          <>
            <b>곧 상하는 재료부터</b> 쓰는 식단이에요.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {expiring.slice(0, 6).map(i => (
                <span key={i.storage + i.name} style={{
                  fontSize: 12, padding: '4px 9px', borderRadius: 9999,
                  background: i.days < 0 ? '#FBE3E0' : '#FFF8CC',
                  color: i.days < 0 ? '#B03A28' : '#7A5C00',
                }}>
                  {i.name} · {daysLabel(i.days, i.estimated)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>냉장고에 있는 재료로 만들 수 있는 것들이에요. 유통기한을 넣어 두면
          <b> 곧 상하는 것부터</b> 골라 드려요.</>
        )}
      </div>

      {/* ── AI 로 짜기 ─────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line-200)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', marginBottom: 4 }}>
          원하는 대로 짜 드려요
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10, lineHeight: 1.6 }}>
          "담백하게", "아이가 먹을 것 위주로", "국물 요리는 빼고" 처럼 적어 보세요.
          비워 두고 눌러도 됩니다.
        </div>
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
          <button
            type="button"
            disabled={asking || !canAi}
            onClick={() => { if (canAi) void askAi(); }}
            style={{
              flexShrink: 0, height: 40, padding: '0 14px', borderRadius: 10, border: 'none',
              background: canAi ? '#FFD600' : 'var(--line-200)',
              color: canAi ? '#1A1A1E' : 'var(--ink-500)',
              fontSize: 13.5, fontWeight: 700,
              cursor: canAi && !asking ? 'pointer' : 'default',
            }}
          >
            {asking ? '짜는 중...' : `AI로 짜기 ${planCost}`}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.6 }}>
          {canAi ? (
            <>AI 로 짜면 크레딧 <b>{planCost}</b>이 줄어요 (남은 {usage?.balance ?? 0}
            {usage?.is_guest ? ' · 체험 중' : ''}).
            아래 <b>다시 짜기</b>와 <b>바꾸기</b>는 크레딧을 쓰지 않아요.</>
          ) : usage?.is_guest ? (
            <>체험을 다 쓰셨어요. <b>가입하면 {usage.signup_credits}개</b>를 바로 드려요.
            아래 기본 식단은 그냥 쓰셔도 됩니다.</>
          ) : (
            <>크레딧을 다 쓰셨어요. 아래 기본 식단은 그냥 쓰셔도 됩니다.</>
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
      {(pool === null || asking) && (
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

      {pool !== null && !asking && slots.every(s => !s.recipe) && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '20px 16px',
                      fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7 }}>
          아직 식단을 짤 만큼 재료가 없어요.
          <br />
          내 냉장고에 재료를 넣으면 그걸로 만들 수 있는 요리를 골라 드려요.
          <button
            type="button"
            onClick={() => navigate('/my-fridge')}
            style={{
              marginTop: 12, height: 40, padding: '0 16px', borderRadius: 10,
              border: 'none', background: '#FFD600', color: '#1A1A1E',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            내 냉장고로 가기
          </button>
        </div>
      )}

      {pool !== null && !asking && slots.some(s => s.recipe) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>
              내일부터 {slots.length}일
            </span>
            <button
              type="button"
              onClick={reshuffle}
              style={{
                height: 32, padding: '0 12px', borderRadius: 8,
                border: '1px solid var(--line-200)', background: 'var(--surface)',
                fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)', cursor: 'pointer',
              }}
            >
              ↻ 다시 짜기
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map((slot, i) => (
              <div
                key={slot.date.toISOString()}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line-200)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  opacity: slot.on ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* 요일을 바꾸는 자리. 고르면 그 날의 요리와 맞바뀐다 —
                      "옮긴다" 는 곧 "자리를 바꾼다" 이므로 빈 칸이 안 생긴다. */}
                  <select
                    value={i}
                    onChange={e => moveTo(i, Number(e.target.value))}
                    aria-label="요일 바꾸기"
                    style={{
                      flexShrink: 0, height: 30, borderRadius: 8,
                      border: '1px solid var(--line-200)', background: 'var(--surface-sub)',
                      fontSize: 12.5, fontWeight: 700, padding: '0 6px', color: '#1A1A1E',
                    }}
                  >
                    {slots.map((s, j) => (
                      <option key={j} value={j}>{dayLabel(s.date)}</option>
                    ))}
                  </select>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {slot.recipe ? (
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
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: '#1A1A1E', lineHeight: 1.4,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>{slot.recipe.title}</div>
                        {slot.recipe.why ? (
                          <div style={{ fontSize: 11.5, color: '#7A5C00', marginTop: 3 }}>
                            {slot.recipe.why}
                          </div>
                        ) : typeof slot.recipe.match_rate === 'number' ? (
                          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3 }}>
                            가진 재료로 {slot.recipe.match_rate}% 만들 수 있어요
                          </div>
                        ) : null}
                      </button>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>비어 있음</span>
                    )}
                  </div>

                  <input
                    type="checkbox"
                    checked={slot.on}
                    onChange={() => setSlots(prev => prev.map((s, j) =>
                      (j === i ? { ...s, on: !s.on } : s)))}
                    aria-label={`${dayLabel(slot.date)} 장보기에 넣기`}
                    style={{ flexShrink: 0, width: 18, height: 18 }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => swapOne(i)}
                  style={{
                    alignSelf: 'flex-start', height: 28, padding: '0 10px', borderRadius: 8,
                    border: '1px solid var(--line-200)', background: 'var(--surface-sub)',
                    fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer',
                  }}
                >
                  다른 요리로 바꾸기
                </button>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.7,
                        padding: '10px 4px 0' }}>
            체크를 풀면 아래 장보기 목록에서도 빠져요. 요리를 누르면 조리 순서가 나옵니다.
            <br />
            {/* "AI 가 짜 주는 것" 으로 오해하면 크레딧이 닳는 줄 알고 아껴 쓰게 된다. */}
            <b>다시 짜기·바꾸기·요일 옮기기는 크레딧을 쓰지 않아요.</b> 미리 뽑아 둔
            재료를 냉장고와 맞춰 보는 것이라 얼마든지 눌러도 됩니다.
          </div>
        </>
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
