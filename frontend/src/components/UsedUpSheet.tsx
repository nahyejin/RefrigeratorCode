import * as React from 'react';
import { saveFridgeChange } from '../utils/fridgeServer';
import { createPortal } from 'react-dom';
import Dialog from './ui/Dialog';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const STORAGE_KEY = 'myfridge_ingredients';

/** 레시피를 「완료」로 기록하면 `recipeStorage.addRecipeToLocalStorage('done', …)` 가 이 이벤트를 쏜다. */
export const RECIPE_DONE_EVENT = 'cookmatch:recipe-done';

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
 *   지우기 직전에 한 번 더 확인한다(2026-10-15 사용자 요청) — 지운 재료는 되돌릴 곳이 없다.
 *
 * 아무것도 미리 골라 두지 않는다(2026-10-15 사용자 요청 — 예전엔 양념을 뺀 원물을 켜 뒀다).
 *   알약 대신 체크박스 줄이라 고르는 것임이 보인다.
 *
 * ⚠️ 2026-10-15 고친 것: 냉장고 저장값은 `{frozen, fridge, room}` 묶음인데 이 창은 배열로만
 *   읽어서 늘 「냉장고가 비었다」로 보고 **한 번도 뜨지 않았다.** 또 기기에서만 지워서 로그인한
 *   사람은 다음에 서버 값으로 되살아났다. 묶음을 읽고, 지우면 서버에도 저장한다.
 *   어디서 완료하든 뜨도록 화면마다 두지 않고 `UsedUpHost` 하나가 이벤트를 듣는다.
 */

type Box = 'frozen' | 'fridge' | 'room';
type Boxes = Record<Box, any[]>;

const squash = (s: string) => String(s || '').replace(/\s+/g, '');

/** 기기에 저장된 냉장고. 예전 배열 모양도 받아 준다(그땐 전부 냉장으로 본다). */
function readBoxes(): Boxes {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(raw)) return { frozen: [], fridge: raw, room: [] };
    if (raw && typeof raw === 'object') {
      return {
        frozen: Array.isArray(raw.frozen) ? raw.frozen : [],
        fridge: Array.isArray(raw.fridge) ? raw.fridge : [],
        room: Array.isArray(raw.room) ? raw.room : [],
      };
    }
  } catch { /* 깨진 값이면 빈 냉장고로 */ }
  return { frozen: [], fridge: [], room: [] };
}

function currentUser(): { id: number; token: string } | null {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const id = Number(u?.id);
    return Number.isFinite(id) && token ? { id, token } : null;
  } catch {
    return null;
  }
}

interface Props {
  /** 방금 완료한 레시피. null 이면 안 뜬다. */
  recipe: { id: number; title: string } | null;
  onClose: () => void;
}

const UsedUpSheet: React.FC<Props> = ({ recipe, onClose }) => {
  const [names, setNames] = React.useState<string[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [confirming, setConfirming] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    if (!recipe) { setNames(null); setConfirming(false); return; }
    let alive = true;
    // 냉장고에 **실제로 있는** 것만 물어야 한다. 안 가진 재료까지 늘어놓으면
    // 무엇을 고르라는 건지 알 수 없다. 이름은 띄어쓰기를 무시하고 맞춘다.
    const boxes = readBoxes();
    const have = new Map<string, string>();
    [...boxes.frozen, ...boxes.fridge, ...boxes.room].forEach(x => {
      const n = String(x?.name || '').trim();
      if (n) have.set(squash(n), n);
    });
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
          .map((n: string) => have.get(squash(n)))
          .filter((n: string | undefined): n is string => !!n);
        const uniq = [...new Set<string>(used)];
        setNames(uniq);
        // 미리 골라 두지 않는다(2026-10-15 사용자 요청) — 무엇을 지울지는 사람이 직접 고른다.
        setPicked(new Set());
      })
      .catch(() => alive && setNames([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  const remove = () => {
    const gone = new Set([...picked].map(squash));
    const boxes = readBoxes();
    const next: Boxes = {
      frozen: boxes.frozen.filter(x => !gone.has(squash(x?.name))),
      fridge: boxes.fridge.filter(x => !gone.has(squash(x?.name))),
      room: boxes.room.filter(x => !gone.has(squash(x?.name))),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key: STORAGE_KEY } }));
    } catch {
      /* 저장이 막혀 있으면 그냥 넘어간다 — 완료 자체는 이미 저장됐다 */
    }
    // 로그인했으면 서버도 같은 냉장고로. 안 하면 다음에 서버 값을 받아 올 때 되살아난다.
    const me = currentUser();
    if (me) {
      // 기기 목록을 통째로 올리지 않는다 — 서버 지금 목록에서 고른 것만 뺀다(utils/fridgeServer 설명).
      // source: 재료 기록에 "요리하고 N개 다 씀" 으로 남는다
      void saveFridgeChange(me.id, me.token, cur => ({
        frozen: cur.frozen.filter(x => !gone.has(squash(x?.name))),
        fridge: cur.fridge.filter(x => !gone.has(squash(x?.name))),
        room: cur.room.filter(x => !gone.has(squash(x?.name))),
      }), 'cooked').then(saved => {
        if (!saved) console.warn('[UsedUpSheet] 냉장고 서버 저장 실패 — 기기에는 반영됨');
      });
    }
    setToast(`냉장고에서 ${picked.size}개 뺐어요`);
    setConfirming(false);
    onClose();
  };

  // 물어볼 것이 없으면 창을 띄우지 않는다. 빈 창은 방해일 뿐이다.
  const open = !!recipe && names !== null && names.length > 0;
  const pickedList = (names || []).filter(n => picked.has(n));

  return (
    <>
      {/* 아래에서 올라오는 패널이었는데, 레시피 시트(역시 패널)에서 완료하면 패널이 두 겹이 됐다
          (2026-10-15 사용자 지적). 가운데 팝업으로 — 시트 위에 떠야 하므로 nested. */}
      <Dialog
        open={open && !confirming}
        onClose={onClose}
        title="냉장고에서 다 쓴 재료가 있나요?"
        width={380}
        nested
        actions={[
          { label: '그냥 둘게요', onClick: onClose, variant: 'outline' },
          picked.size
            ? { label: `${picked.size}개 빼기`, onClick: () => setConfirming(true), variant: 'primary' }
            : { label: '재료를 골라 주세요', onClick: () => {}, variant: 'secondary' },
        ]}
      >
        <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 12 }}>
          이 요리에 들어간 재료 중 내냉장고에 있는 것이에요.<br />
          이번 요리에서 다 쓴 재료를 골라 내냉장고에서 빼 주세요.
        </div>
        <div style={{ textAlign: 'left' }}>
        {/* 알약 모양이면 고르는 것인지 몰라서(사용자 지적) 체크박스 줄로. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
          {(names || []).map(name => {
            const on = picked.has(name);
            return (
              <label
                key={name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 12px',
                  borderRadius: 10, cursor: 'pointer', boxSizing: 'border-box',
                  border: on ? '1px solid #1A1A1E' : '1px solid var(--line-200)',
                  background: on ? 'var(--surface-sub)' : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setPicked(p => {
                    const next = new Set(p);
                    if (next.has(name)) next.delete(name); else next.add(name);
                    return next;
                  })}
                  style={{ width: 20, height: 20, margin: 0, flexShrink: 0, accentColor: '#1A1A1E', cursor: 'pointer' }}
                />
                <span style={{
                  minWidth: 0, fontSize: 14, fontWeight: on ? 700 : 500,
                  color: on ? 'var(--ink-900)' : 'var(--ink-700)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {name}
                </span>
              </label>
            );
          })}
        </div>

        </div>
      </Dialog>

      {/* 지우기 직전 확인 — 고르기 팝업 대신 이 자리에 뜬다 */}
      <Dialog
        open={open && confirming}
        onClose={() => setConfirming(false)}
        title="냉장고에서 뺄까요?"
        nested
        actions={[
          { label: '취소', onClick: () => setConfirming(false), variant: 'outline' },
          { label: `${picked.size}개 빼기`, onClick: remove, variant: 'primary' },
        ]}
      >
        <div style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7, textAlign: 'center' }}>
          <b style={{ color: 'var(--ink-900)' }}>{pickedList.join(', ')}</b>
          <br />
          내냉장고 목록에서 사라져요.
        </div>
      </Dialog>

      {toast && createPortal(
        <div className="plan-toast" role="status">
          <span aria-hidden style={{
            width: 18, height: 18, borderRadius: 9999, background: '#FFD600',
            color: '#1A1A1E', fontSize: 11, fontWeight: 800, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>✓</span>
          <span>{toast}</span>
        </div>,
        document.body,
      )}
    </>
  );
};

/**
 * 앱에 하나만 둔다. 어느 화면에서 완료하든(레시피 시트·「완료하셨나요?」 팝업·카드 버튼)
 * `RECIPE_DONE_EVENT` 를 듣고 위 시트를 띄운다.
 */
export const UsedUpHost: React.FC = () => {
  const [recipe, setRecipe] = React.useState<{ id: number; title: string } | null>(null);
  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      const id = Number(d.id);
      if (Number.isFinite(id)) setRecipe({ id, title: String(d.title || '') });
    };
    window.addEventListener(RECIPE_DONE_EVENT, on);
    return () => window.removeEventListener(RECIPE_DONE_EVENT, on);
  }, []);
  return <UsedUpSheet recipe={recipe} onClose={() => setRecipe(null)} />;
};

export default UsedUpSheet;
