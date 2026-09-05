import { getMyIngredients, getMyIngredientsAsKeywords, preloadIngredientSynonymDict } from './recipeUtils';

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

/**
 * 첫 화면의 매칭률 하한. `RecipeList.tsx` 의 `getInitialSortBarState()` 와
 * **정확히 같은 규칙**이어야 한다 — 거기가 실제로 화면에 뜨는 첫 요청이고,
 * 여기는 그걸 미리 받아 두는 자리다. 냉장고에 재료가 있으면 30% 미만은
 * 원래도 걸러서 보여 준다(재료가 없으면 전부 0% 라 필터를 열어 둔다).
 *
 * 이 값을 안 넣고 미리 받았다가, 실제 화면(30% 필터)과 **다른 걸 준 적이
 * 있다** — 매칭률 낮은 레시피가 섞여 나오거나, 사용자가 매칭률 구간을
 * 바꿔도 반영이 안 되는 것처럼 보였다(바뀐 구간과 무관하게 이 캐시가
 * 조건 검사도 없이 재사용됐기 때문).
 */
export function defaultMatchRateMin(): number {
  try {
    // `getInitialSortBarState()` 와 같은 기준(`getMyIngredients`) 을 써야
    // 한다. 동의어 변환을 거치는 `getMyIngredientsAsKeywords` 로 재면
    // 드물게 다른 값이 나올 수 있다 — 그러면 이 판단 자체가 화면과 어긋난다.
    return getMyIngredients().length > 0 ? 30 : 0;
  } catch {
    return 0;
  }
}

/** 받아 둔 것을 얼마나 믿을까. 냉장고가 그대로여도 레시피는 매일 늘어난다. */
const FRESH_MS = 10 * 60 * 1000;

interface Slot {
  key: string;
  at: number;
  promise: Promise<any[] | null>;
}

let slot: Slot | null = null;

/** 지금 냉장고로 만드는 열쇠. 재료가 바뀌면(또는 매칭률 하한이 바뀌면) 달라진다. */
export function prefetchKey(): string | null {
  try {
    const my = getMyIngredientsAsKeywords();
    if (!my || my.length === 0) return null;
    return `${SORT}|${PREFETCH_SIZE}|${defaultMatchRateMin()}|${[...my].sort().join(',')}`;
  } catch {
    return null;
  }
}

function request(my: string[], matchRateMin: number): Promise<any[] | null> {
  const params = new URLSearchParams({
    page: '1',
    size: String(PREFETCH_SIZE),
    sort_by: SORT,
    my_ingredients: my.join(','),
    match_rate_min: String(matchRateMin),
    match_rate_max: '100',
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

      // 열쇠 모양: `match_rate|20|<매칭률 하한>|<재료들>` — 재료는 마지막 칸.
      const parts = key.split('|');
      const matchRateMin = Number(parts[2]) || 0;
      const my = parts[3].split(',');
      slot = { key, at: Date.now(), promise: request(my, matchRateMin) };
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

/**
 * 요즘인기 첫 화면도 미리 받아 둔다.
 *
 * 이쪽은 **냉장고와 상관없는 목록**이라(인기순) 누구에게나 같은 답이고, 재료가
 * 필요 없어서 앱을 여는 즉시 부를 수 있다. 사전을 기다릴 일도 없다.
 *
 * 냉장고 요리와 따로 두는 이유: 두 요청이 **동시에** 나가면 서로 느려진다.
 * 이건 조건이 없어 빠르므로 먼저 걸고, 무거운 냉장고 쪽은 그대로 둔다.
 */
const POPULAR_SIZE = 100;
let popularSlot: { at: number; period: string; promise: Promise<any | null> } | null = null;

export function prefetchPopular(period: string = 'week'): void {
  if (popularSlot && popularSlot.period === period
      && Date.now() - popularSlot.at < FRESH_MS) return;
  popularSlot = {
    at: Date.now(),
    period,
    promise: fetch(`${API_BASE_URL}/api/recipes/popular?period_type=${period}&size=${POPULAR_SIZE}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null),
  };
}

/** 미리 받아 둔 요즘인기. 한 번 쓰면 비운다(새로고침이 안 먹으면 안 되므로). */
export function takePrefetchedPopular(period: string = 'week'): Promise<any | null> | null {
  if (!popularSlot || popularSlot.period !== period) return null;
  if (Date.now() - popularSlot.at >= FRESH_MS) { popularSlot = null; return null; }
  const p = popularSlot.promise;
  popularSlot = null;
  return p;
}
