import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyIngredients } from '../utils/recipeUtils';
import { loadIngredientCategoryMap, type CategoryMap, type StorageKind } from '../utils/shelfLife';
import { findExpiring, daysLabel, type FridgeItem, type ExpiringItem } from '../utils/expiry';
import { openCookMode } from '../utils/cookMode';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { track } from '../utils/track';
import StepLoading from '../components/StepLoading';

/**
 * 이번 주 식단 + 장보기 목록.
 *
 * 왜 한 화면인가:
 *   장보기 목록은 식단에서 **나온다.** 무엇을 만들지 정해야 무엇이 부족한지
 *   나온다. 두 화면으로 나누면 사용자가 같은 걸 두 번 정하게 된다.
 *
 * 왜 유통기한이 기준인가:
 *   "뭐 해 먹지" 에 답하는 앱은 많다. 쿡매치가 다른 점은 **가진 재료**를 안다는
 *   것이고, 그중에서도 **곧 상하는 재료**를 아는 것이다. 그걸 먼저 쓰는 식단이
 *   이 앱만 만들 수 있는 식단이다.
 */

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface PlanRecipe {
  id: number;
  title: string;
  link: string;
  thumbnail?: string;
  used_ingredients?: string;
  match_rate?: number;
}

/**
 * 내냉장고가 쓰는 그 자리에서 보관함 세 칸을 읽는다.
 *
 * 키 이름을 여기서 새로 정하지 않는다 — 다르게 적으면 재료가 있는데도
 * "재료가 없어요" 가 뜬다.
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

const WeeklyPlan: React.FC = () => {
  const navigate = useNavigate();
  const [categoryMap, setCategoryMap] = React.useState<CategoryMap>({});
  const [recipes, setRecipes] = React.useState<PlanRecipe[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<number>>(new Set());
  const [bought, setBought] = React.useState<Set<string>>(new Set());

  const boxes = React.useMemo(readBoxes, []);
  const myIngredients = React.useMemo(() => getMyIngredients(), []);

  React.useEffect(() => {
    void loadIngredientCategoryMap().then(setCategoryMap).catch(() => {});
  }, []);

  const expiring: ExpiringItem[] = React.useMemo(
    () => findExpiring(boxes, categoryMap, 5),
    [boxes, categoryMap],
  );

  React.useEffect(() => {
    if (myIngredients.length === 0) { setRecipes([]); return; }
    const params = new URLSearchParams({
      my_ingredients: myIngredients.join(','),
      sort_by: 'match_rate',
      size: '30',
      page: '1',
    });
    // 곧 상하는 재료를 쓰는 레시피를 앞으로 올린다 — 이 식단의 핵심이다.
    const soon = expiring.filter(i => i.days >= 0).map(i => i.name);
    if (soon.length) params.set('applied_expiry_ingredients', soon.join(','));

    fetch(`${API_BASE_URL}/api/recipes/filter?${params}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setRecipes(d.recipes || []))
      .catch(() => setError('레시피를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
  }, [myIngredients, expiring]);

  /**
   * 식단 후보를 고른다.
   *
   * 매칭률만 보고 위에서부터 자르면 **비슷한 요리가 줄줄이 나온다**(김치찌개,
   * 김치볶음밥, 김치전…). 한 주 식단으로는 쓸 수 없다. 그래서 이미 뽑은 요리와
   * 재료가 많이 겹치면 건너뛴다.
   */
  const plan = React.useMemo(() => {
    if (!recipes) return [];
    const chosen: PlanRecipe[] = [];
    const usedNames = new Set<string>();

    for (const r of recipes) {
      if (chosen.length >= 5) break;
      const ings = (r.used_ingredients || '').split(',').map(x => x.trim()).filter(Boolean);
      const overlap = ings.filter(x => usedNames.has(x)).length;
      // 절반 넘게 겹치면 사실상 같은 요리다.
      if (chosen.length > 0 && overlap >= Math.ceil(ings.length / 2)) continue;
      chosen.push(r);
      ings.forEach(x => usedNames.add(x));
    }
    return chosen;
  }, [recipes]);

  const active = plan.filter(r => picked.size === 0 || picked.has(r.id));

  /** 고른 식단에 필요한데 냉장고에 **없는** 재료. 이게 장보기 목록이다. */
  const shopping = React.useMemo(() => {
    const have = new Set(myIngredients.map(x => x.trim()));
    const need = new Map<string, number>();   // 이름 -> 몇 개 요리에 쓰이나
    active.forEach(r => {
      (r.used_ingredients || '').split(',').map(x => x.trim()).filter(Boolean)
        .forEach(name => {
          if (have.has(name)) return;
          need.set(name, (need.get(name) || 0) + 1);
        });
    });
    return [...need.entries()].sort((a, b) => b[1] - a[1]);
  }, [active, myIngredients]);

  const toggle = (id: number) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 위쪽 여백 72 는 **고정 헤더 높이**다. 이걸 빼먹어서 뒤로가기 버튼이
  // 헤더 밑에 깔려 안 보였다(다른 화면들도 같은 값을 쓴다).
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-sub)',
                  padding: '72px 14px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          style={{
            // 44px — 손가락이 닿는 최소 크기. 글자만 두면 눌러도 잘 안 먹는다.
            width: 44, height: 44, marginLeft: -10, flexShrink: 0,
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: '#1A1A1E' }}>이번 주 식단</h1>
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

      {/* ── 식단 ───────────────────────────────────────────── */}
      {error && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 16,
                      fontSize: 13, color: '#D14343' }}>{error}</div>
      )}

      {!error && recipes === null && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-200)',
                      borderRadius: 14, padding: '4px 16px 16px' }}>
          <StepLoading
            steps={[
              '냉장고 재료를 살펴보는 중이에요',
              '곧 상하는 재료를 먼저 챙기는 중이에요',
              '만들 수 있는 요리를 고르는 중이에요',
              '비슷한 요리를 걸러내는 중이에요',
            ]}
            timings={[600, 1600, 2800, 4500]}
            note="보통 2~5초쯤 걸려요."
            lastNote="거의 다 됐어요."
            rows={4}
          />
        </div>
      )}

      {!error && recipes !== null && plan.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '20px 16px',
                      fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7 }}>
          아직 식단을 짤 만큼 재료가 없어요.
          <br />
          내 냉장고에 재료를 넣으면 그걸로 만들 수 있는 요리를 골라 드려요.
          <button
            type="button"
            onClick={() => navigate('/myfridge')}
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

      {plan.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plan.map((r, i) => {
            const on = picked.size === 0 || picked.has(r.id);
            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line-200)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', gap: 12, alignItems: 'center',
                  opacity: on ? 1 : 0.45,
                }}
              >
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 9999,
                  background: 'var(--surface-sub)', color: '#1A1A1E',
                  fontSize: 12.5, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{DAYS[i]}</div>

                <button
                  type="button"
                  onClick={() => {
                    track('recipe_open', String(r.id));
                    openCookMode({ id: r.id, title: r.title, link: r.link, myIngredients });
                  }}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left', border: 'none',
                    background: 'transparent', cursor: 'pointer', padding: 0,
                  }}
                >
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: '#1A1A1E', lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{r.title}</div>
                  {typeof r.match_rate === 'number' && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3 }}>
                      가진 재료로 {r.match_rate}% 만들 수 있어요
                    </div>
                  )}
                </button>

                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(r.id)}
                  aria-label={`${r.title} 식단에 넣기`}
                  style={{ flexShrink: 0, width: 18, height: 18 }}
                />
              </div>
            );
          })}
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.7, padding: '0 4px' }}>
            체크를 풀면 아래 장보기 목록에서도 빠져요. 요리를 누르면 조리 순서가 나옵니다.
            <br />
            {/* "AI 가 짜 주는 것" 으로 오해하면 크레딧이 닳는 줄 알고 아껴 쓰게 된다.
                실제로는 미리 뽑아 둔 재료를 맞춰 보는 것뿐이라 얼마든지 눌러도 된다. */}
            <b>이 기능은 AI 크레딧을 쓰지 않아요.</b> 레시피마다 미리 뽑아 둔 재료를
            냉장고와 맞춰 보는 것이라, 몇 번을 다시 짜도 크레딧이 줄지 않습니다.
          </div>
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
