/**
 * 냉장고요리 「최근 검색어」 — 기기에 저장한다(2026-10-22 사용자 요청).
 *
 * 왜 필요한가: 냉장고요리에서 조건을 맞춰 가며 찾다가 내냉장고로 가서 재료를 확인하고 돌아오면 검색창이
 * 비어 있어 방금 찾던 말을 다시 쳐야 했다.
 *
 * 왜 기기(localStorage)에 두나: 비회원도 쓰고 서버 작업이 필요 없다. 계정에 묶으면 다른 기기에서도 따라오지만
 * 지금은 그 정도까지는 필요 없다(나중에 필요하면 서버 저장을 덧붙인다).
 * 최대 개수를 넘으면 오래된 것부터 지운다. 저장소를 못 쓰는 환경에서는 조용히 빈 목록으로 동작한다.
 */
const KEY = 'cookmatch_recent_recipe_searches_v1';
export const RECENT_SEARCH_MAX = 6;

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((x) => typeof x === 'string' && x.trim()).slice(0, RECENT_SEARCH_MAX);
  } catch {
    return [];
  }
}

function save(list: string[]): string[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 저장 못 해도 화면은 계속 쓴다 */
  }
  return list;
}

/** 검색어를 맨 앞에 넣는다(같은 말이 있으면 앞으로 끌어올림). 새 목록을 돌려준다. */
export function addRecentSearch(term: string): string[] {
  const t = term.trim().slice(0, 40);
  if (!t) return loadRecentSearches();
  const rest = loadRecentSearches().filter((x) => x !== t);
  return save([t, ...rest].slice(0, RECENT_SEARCH_MAX));
}

export function removeRecentSearch(term: string): string[] {
  return save(loadRecentSearches().filter((x) => x !== term));
}

export function clearRecentSearches(): string[] {
  return save([]);
}
