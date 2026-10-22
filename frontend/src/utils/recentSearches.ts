/**
 * 냉장고요리 「최근 검색조건」 — 기기에 저장한다(2026-10-22 사용자 요청).
 *
 * 왜 필요한가: 냉장고요리에서 조건을 맞춰 가며 찾다가 내냉장고로 가서 재료를 확인하고 돌아오면 검색창이
 * 비어 있어 방금 찾던 말을 다시 쳐야 했다. 처음엔 검색어만 저장했다가, 같은 날 「정렬·필터·임박 재료·매칭률까지
 * 그 당시 조건 전체를 저장해 달라」는 요청으로 조건 묶음(SearchCondition)을 저장하도록 바꿨다.
 *
 * 왜 기기(localStorage)에 두나: 비회원도 쓰고 서버 작업이 필요 없다. 계정에 묶으면 다른 기기에서도 따라오지만
 * 지금은 그 정도까지는 필요 없다(나중에 필요하면 서버 저장을 덧붙인다).
 * 최대 개수를 넘으면 오래된 것부터 지운다. 저장소를 못 쓰는 환경에서는 조용히 빈 목록으로 동작한다.
 */
const KEY = 'cookmatch_recent_recipe_conditions_v1';
const OLD_KEY = 'cookmatch_recent_recipe_searches_v1'; // 검색어만 저장하던 첫 판(같은 날 교체) — 읽어서 옮긴다
// 10개를 넘으면 가장 오래된 것부터 지운다(2026-10-22 사용자: 5~10개 정도). 한 줄 가로 스크롤이라 10개까지는 충분히 훑어볼 수 있다.
export const RECENT_SEARCH_MAX = 10;

export interface SearchCondition {
  keyword: string;
  sortType: string;
  matchRange: [number, number];
  maxLack: number | 'unlimited';
  selectedChannel: string[];
  includeIngredients: string[];
  excludeIngredients: string[];
  categoryKeywords: Record<string, string[]>;
  expiryIngredients: string[];
}

const SORT_LABEL: Record<string, string> = {
  latest: '최신순',
  popular: '인기순',
  match: '재료매칭순',
  expiry: '임박순',
};

const sorted = (xs: string[] | undefined) => [...(xs || [])].sort();

/** 같은 조건인지 가르는 키(배열 순서·불필요한 빈 값은 무시) */
export function conditionKey(c: SearchCondition): string {
  const cats: Record<string, string[]> = {};
  Object.keys(c.categoryKeywords || {}).sort().forEach((k) => {
    if (c.categoryKeywords[k]?.length) cats[k] = sorted(c.categoryKeywords[k]);
  });
  return JSON.stringify([
    c.keyword.trim(), c.sortType, c.matchRange, c.maxLack, sorted(c.selectedChannel),
    sorted(c.includeIngredients), sorted(c.excludeIngredients), cats, sorted(c.expiryIngredients),
  ]);
}

/** 기본값과 다른 것이 하나라도 있나(전부 기본이면 저장할 「고른 조건」이 없다) */
export function isDefaultCondition(c: SearchCondition, base: SearchCondition): boolean {
  return conditionKey({ ...c, keyword: c.keyword.trim() }) === conditionKey(base);
}

/** 배지에 쓸 한 줄 설명 — 기본값과 다른 것만, 검색어가 앞에 */
export function describeCondition(c: SearchCondition, base: SearchCondition): string {
  const parts: string[] = [];
  if (c.keyword.trim()) parts.push(c.keyword.trim());
  if (c.sortType !== base.sortType) parts.push(SORT_LABEL[c.sortType] || c.sortType);
  if (c.matchRange[0] !== base.matchRange[0] || c.matchRange[1] !== base.matchRange[1]) {
    parts.push(c.matchRange[1] >= 100 ? `매칭 ${c.matchRange[0]}%↑` : `매칭 ${c.matchRange[0]}~${c.matchRange[1]}%`);
  }
  if (c.maxLack !== base.maxLack) parts.push(c.maxLack === 'unlimited' ? '부족 제한없음' : `부족 ${c.maxLack}개↓`);
  if (c.expiryIngredients.length) parts.push(`임박 ${c.expiryIngredients.length}`);
  if (c.includeIngredients.length) parts.push(`포함 ${c.includeIngredients.length}`);
  if (c.excludeIngredients.length) parts.push(`제외 ${c.excludeIngredients.length}`);
  if (c.selectedChannel.length) parts.push(`채널 ${c.selectedChannel.length}`);
  const cats = Object.values(c.categoryKeywords || {}).reduce((n, xs) => n + (xs?.length || 0), 0);
  if (cats) parts.push(`필터 ${cats}`);
  return parts.join(' · ') || '기본 조건';
}

function valid(x: any): x is SearchCondition {
  return !!x && typeof x.keyword === 'string' && typeof x.sortType === 'string' && Array.isArray(x.matchRange)
    && Array.isArray(x.selectedChannel) && Array.isArray(x.includeIngredients) && Array.isArray(x.excludeIngredients)
    && Array.isArray(x.expiryIngredients) && !!x.categoryKeywords && typeof x.categoryKeywords === 'object';
}

export function loadRecentSearches(base: SearchCondition): SearchCondition[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter(valid).slice(0, RECENT_SEARCH_MAX) : [];
    }
    // 첫 판(검색어 문자열만)이 있으면 「그 검색어 + 기본 조건」으로 옮긴다
    const old = localStorage.getItem(OLD_KEY);
    if (!old) return [];
    const terms = JSON.parse(old);
    if (!Array.isArray(terms)) return [];
    const moved = terms.filter((t) => typeof t === 'string' && t.trim()).slice(0, RECENT_SEARCH_MAX)
      .map((t: string): SearchCondition => ({ ...base, keyword: t.trim() }));
    return save(moved);
  } catch {
    return [];
  }
}

function save(list: SearchCondition[]): SearchCondition[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 저장 못 해도 화면은 계속 쓴다 */
  }
  return list;
}

/** 조건을 맨 앞에 넣는다(같은 조건이 있으면 앞으로 끌어올림). 새 목록을 돌려준다. */
export function addRecentSearch(c: SearchCondition, base: SearchCondition): SearchCondition[] {
  const next: SearchCondition = { ...c, keyword: c.keyword.trim().slice(0, 40) };
  const k = conditionKey(next);
  const rest = loadRecentSearches(base).filter((x) => conditionKey(x) !== k);
  return save([next, ...rest].slice(0, RECENT_SEARCH_MAX));
}

export function removeRecentSearch(c: SearchCondition, base: SearchCondition): SearchCondition[] {
  const k = conditionKey(c);
  return save(loadRecentSearches(base).filter((x) => conditionKey(x) !== k));
}

export function clearRecentSearches(): SearchCondition[] {
  return save([]);
}
