import * as React from 'react';
import Sheet from './ui/Sheet';
import { loadIngredientCategoryMap, type CategoryMap } from '../utils/shelfLife';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const STORAGE_KEY = 'myfridge_ingredients';

/**
 * 완료를 누른 직후 **"이거 다 썼어요?"** 를 묻는다.
 *
 * 왜 필요한가:
 *   요리를 만들었으면 그 재료는 거의 다 쓴 것이다. 그런데 냉장고 목록은 그대로
 *   남아 있어서, 사용자가 나중에 손으로 하나씩 지워야 했다. 안 지우면 더
 *   나쁘다 — 없는 재료로 계속 식단을 짜 주고, 유통기한 알림도 계속 울린다.
 *   완료를 누른 그 순간이 **기억이 가장 정확한 때**다.
 *
 * 왜 자동으로 안 지우나:
 *   "감자 한 알을 썼는데 세 알이 남았다" 가 흔하다. 마음대로 지우면 있는 것을
 *   없다고 하게 되고, 그건 남겨 두는 것보다 나쁘다. **묻고 고르게** 한다.
 *
 * 무엇을 기본으로 켜 두나:
 *   식재료만. 간장·소금 같은 양념은 한 번 요리했다고 없어지지 않는다 —
 *   전부 켜 두면 매번 꺼야 해서 이 창이 귀찮은 것이 된다.
 */

interface Props {
  /** 방금 완료한 레시피. null 이면 안 뜬다. */
  recipe: { id: number; title: string } | null;
  onClose: () => void;
}

/** 양념·조미료인가. 이런 건 한 끼로 안 없어진다. */
function isSeasoning(name: string, map: CategoryMap): boolean {
  const mid = map[name]?.mid || '';
  return mid.includes('양념') || mid.includes('조미료') || mid.includes('오일');
}

const UsedUpSheet: React.FC<Props> = ({ recipe, onClose }) => {
  const [names, setNames] = React.useState<string[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [map, setMap] = React.useState<CategoryMap>({});

  React.useEffect(() => {
    let alive = true;
    void loadIngredientCategoryMap().then(m => alive && setMap(m));
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!recipe) { setNames(null); return; }
    let alive = true;
    // 냉장고에 **실제로 있는** 것만 물어야 한다. 안 가진 재료까지 늘어놓으면
    // 무엇을 고르라는 건지 알 수 없다.
    let fridge: any[] = [];
    try {
      fridge = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      fridge = [];
    }
    const have = new Set(
      (Array.isArray(fridge) ? fridge : [])
        .map(x => String(x?.name || '').trim())
        .filter(Boolean),
    );
    if (have.size === 0) { setNames([]); return; }

    fetch(`${API_BASE_URL}/api/recipes/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [recipe.id] }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (!alive) return;
        const used = (d.items?.[0]?.ingredients || [])
          .map((n: string) => String(n).trim())
          .filter((n: string) => n && have.has(n));
        const uniq = [...new Set<string>(used)];
        setNames(uniq);
        setPicked(new Set(uniq.filter(n => !isSeasoning(n, map))));
      })
      .catch(() => alive && setNames([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id, map]);

  const remove = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const kept = (Array.isArray(raw) ? raw : [])
        .filter((x: any) => !picked.has(String(x?.name || '').trim()));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
      window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key: STORAGE_KEY } }));
    } catch {
      /* 저장이 막혀 있으면 그냥 넘어간다 — 완료 자체는 이미 저장됐다 */
    }
    onClose();
  };

  // 물어볼 것이 없으면 창을 띄우지 않는다. 빈 창은 방해일 뿐이다.
  const open = !!recipe && names !== null && names.length > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="쓴 재료를 냉장고에서 뺄까요?"
      maxHeight="70dvh"
      hideFooter
    >
      <div style={{ fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 10 }}>
        남은 게 있으면 체크를 꺼 주세요.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(names || []).map(name => {
          const on = picked.has(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(p => {
                const next = new Set(p);
                if (next.has(name)) next.delete(name); else next.add(name);
                return next;
              })}
              style={{
                height: 34, padding: '0 12px', borderRadius: 9999, cursor: 'pointer',
                border: on ? 'none' : '1px solid var(--line-300)',
                background: on ? '#1A1A1E' : 'var(--surface)',
                color: on ? '#FFFFFF' : 'var(--ink-700)',
                fontSize: 13, fontWeight: on ? 700 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              {on && <span aria-hidden style={{ fontSize: 11 }}>✓</span>}
              {name}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1, height: 46, borderRadius: 12,
            border: '1px solid var(--line-200)', background: 'var(--surface)',
            fontSize: 14, fontWeight: 700, color: 'var(--ink-700)', cursor: 'pointer',
          }}
        >
          그냥 둘게요
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={picked.size === 0}
          style={{
            flex: 1.4, height: 46, borderRadius: 12, border: 'none',
            background: picked.size ? '#FFD600' : 'var(--line-200)',
            color: picked.size ? '#1A1A1E' : 'var(--ink-500)',
            fontSize: 14, fontWeight: 700,
            cursor: picked.size ? 'pointer' : 'default',
          }}
        >
          {picked.size ? `${picked.size}개 빼기` : '뺄 재료를 골라 주세요'}
        </button>
      </div>
    </Sheet>
  );
};

export default UsedUpSheet;
