import { getMyIngredientsAsKeywords, preloadIngredientSynonymDict } from './recipeUtils';

/**
 * 냉장고 요리 **첫 화면을 미리 받아 둔다.**
 *
 * 왜 필요한가 (실측):
 *   `/api/recipes/filter` 한 번이 **2.4~2.7초** 걸린다. 돌려주는 것은 9KB 뿐이라
 *   네트워크가 아니라 **서버에서 세는 시간**이다 — 레시피 44,707행마다
 *   `FIND_IN_SET` 을 재료 수만큼 돌려 매칭률을 만들고, 그 계산된 값으로 정렬한다.
 *   `used_ingredients` 에는 인덱스가 없고(제목·본문 FULLTEXT 뿐), 매칭률은 그
 *   사람의 냉장고에 따라 달라져서 미리 계산해 둘 수도 없다.
 *
 *   그래서 **쿼리를 빠르게 만드는 것으로는 못 없앤다.** 대신 그 2.5초를
 *   사용자가 다른 화면을 보는 동안 미리 치른다. 앱을 열면 냉장고 재료는 이미
 *   기기에 있으므로, 탭을 누르기 전에 요청을 걸어 둘 수 있다.
 *
 * 왜 화면이 아니라 여기(모듈)에 두나:
 *   React Router 는 화면만 갈아 끼우고 앱은 계속 살아 있다. 모듈 수준에 두면
 *   탭을 옮겨 다녀도 받아 둔 것이 그대로 남는다 — "다른 데 갔다 오면 완성해
 *   둘게요" 가 실제로 그렇게 된다.
 */

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

/** 첫 화면에 쓰는 조건. 여기가 바뀌면 미리 받아 둔 것은 못 쓴다. */
export const PREFETCH_SIZE = 20;
const SORT = 'match_rate';

/** 받아 둔 것을 얼마나 믿을까. 냉장고가 그대로여도 레시피는 매일 늘어난다. */
const FRESH_MS = 10 * 60 * 1000;

interface Slot {
  key: string;
  at: number;
  promise: Promise<any[] | null>;
}

let slot: Slot | null = null;

/** 지금 냉장고로 만드는 열쇠. 재료가 바뀌면 달라진다. */
export function prefetchKey(): string | null {
  try {
    const my = getMyIngredientsAsKeywords();
    if (!my || my.length === 0) return null;
    return `${SORT}|${PREFETCH_SIZE}|${[...my].sort().join(',')}`;
  } catch {
    return null;
  }
}

function request(my: string[]): Promise<any[] | null> {
  const params = new URLSearchParams({
    page: '1',
    size: String(PREFETCH_SIZE),
    sort_by: SORT,
    my_ingredients: my.join(','),
  });
  return fetch(`${API_BASE_URL}/api/recipes/filter?${params}`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => (Array.isArray(d) ? d : d?.recipes || null))
    .catch(() => null);
}

/**
 * 미리 받기를 시작한다. 이미 받아 뒀거나 받는 중이면 아무것도 안 한다.
 *
 * 실패해도 조용히 넘어간다 — 이건 **빠르게 하려는 것**이지 없으면 안 되는 길이
 * 아니다. 화면은 못 받았으면 평소대로 자기가 부른다.
 */
export function prefetchFridgeRecipes(): void {
  // **동의어 사전을 먼저 기다린다.**
  //
  // 서버는 사전을 모르고 문자열을 그대로 비교하므로, 냉장고에 적힌 이름을
  // 대표어로 바꿔서 보내야 한다(`계란` → `달걀`). 그런데 그 변환은 사전이
  // 메모리에 올라와 있어야 되고, 앱을 막 열었을 때는 아직 없다.
  // 기다리지 않으면 `getMyIngredientsAsKeywords()` 가 **빈 배열**을 돌려주고,
  // 미리 받기가 조용히 아무 일도 안 한다 — 실제로 그렇게 안 돌고 있었다.
  void preloadIngredientSynonymDict()
    .catch(() => {})
    .then(() => {
      const key = prefetchKey();
      if (!key) return;                   // 냉장고가 비었으면 부를 것이 없다
      if (slot && slot.key === key && Date.now() - slot.at < FRESH_MS) return;

      const my = key.split('|')[2].split(',');
      slot = { key, at: Date.now(), promise: request(my) };
    });
}

/**
 * 미리 받아 둔 결과. 조건이 다르거나 오래됐으면 `null` —
 * 그때는 부르는 쪽이 평소대로 자기가 받는다.
 *
 * **한 번 쓰면 비운다.** 화면이 새로고침을 눌렀는데 아까 것을 또 주면
 * "안 바뀐다" 가 된다.
 */
export function takePrefetched(): Promise<any[] | null> | null {
  const key = prefetchKey();
  if (!key || !slot || slot.key !== key) return null;
  if (Date.now() - slot.at >= FRESH_MS) { slot = null; return null; }
  const p = slot.promise;
  slot = null;
  return p;
}

/** 냉장고를 고쳤을 때. 받아 둔 것이 더는 맞지 않는다. */
export function dropPrefetch(): void {
  slot = null;
}
