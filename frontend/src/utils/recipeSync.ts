import {
  getRecipesFromLocalStorage,
  normalizeRecipeId,
  sortRecipesByUserSavedAtDesc,
  type StorageType,
} from './recipeStorage';

/**
 * 즐겨찾기·완료·기록을 **기기와 서버 사이에서 맞춘다.**
 *
 * 무엇이 문제였나:
 *   같은 값을 두 군데가 따로 들고 있었는데, 맞춰 주는 사람이 없었다.
 *     - 냉장고 요리(레시피 목록)는 **기기(localStorage)** 를 센다
 *     - 마이페이지·요리 캘린더는 **서버** 를 센다
 *   그래서 이런 일이 생긴다:
 *     1. 로그인 전에 누른 것은 서버로 **영영 안 간다** — `syncToServer` 가
 *        `if (!isLoggedIn) return` 으로 그냥 빠져나간다. 나중에 로그인해도
 *        올려 주는 자리가 없었다.
 *     2. 서버 반영이 실패하면 조용히 삼킨다(`catch` 에 로그만). 그 한 건은
 *        기기에만 남아 영영 어긋난다.
 *     3. 다른 기기에서 누른 것은 이 기기 목록에 안 들어온다.
 *   셋 다 "냉장고 요리에서는 12개인데 마이페이지에서는 9개" 로 나타난다.
 *
 * 무엇을 하나:
 *   양쪽을 **합집합**으로 맞춘다. 기기에만 있는 것은 서버로 올리고, 서버에만
 *   있는 것은 기기로 내린다. 한 번 맞추고 나면 세 화면이 같은 수를 센다.
 *
 * 왜 합집합인가(교집합이나 서버 우선이 아니라):
 *   지운 것을 되살릴 위험보다 **누른 것을 잃을 위험**이 크다. 지우기는
 *   로그인 상태에서 서버에도 같이 나가므로 양쪽에서 사라진다. 로그아웃
 *   상태에서 지운 것만 되살아나는데, 그건 다시 지우면 된다 — 반대로 잃은
 *   기록은 되찾을 방법이 없다.
 */

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

/** 맞출 것은 이 셋뿐이다. 냉장고는 규칙이 달라 여기 없다. */
type SyncType = Extract<StorageType, 'favorite' | 'done' | 'write'>;
const TYPES: SyncType[] = ['favorite', 'done', 'write'];

const ENDPOINT: Record<SyncType, string> = {
  favorite: 'favorite-recipes',
  done: 'completed-recipes',
  write: 'recorded-recipes',
};

const KEY: Record<SyncType, string> = {
  favorite: 'my_favorite_recipes',
  done: 'my_completed_recipes',
  write: 'my_recorded_recipes',
};

/** 이번 세션에서 이미 맞췄나. 화면을 옮길 때마다 다시 돌 이유가 없다. */
let done = false;

export interface SyncReport {
  /** 타입별 `{ 올린 수, 내린 수, 맞춘 뒤 개수 }` */
  [type: string]: { pushed: number; pulled: number; total: number };
}

function token(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

async function syncOne(userId: number | string, type: SyncType, auth: string) {
  const url = `${API_BASE_URL}/api/users/${userId}/${ENDPOINT[type]}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${auth}` } });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const server: any[] = Array.isArray(data.recipes) ? data.recipes : [];

  const local = getRecipesFromLocalStorage(type);
  const serverIds = new Set(server.map(r => normalizeRecipeId(r.id)));
  const localIds = new Set(local.map(r => normalizeRecipeId(r.id)));

  // 기기에만 있는 것 → 서버로. (로그인 전에 눌렀거나, 반영이 실패했던 것)
  const pushIds = [...localIds].filter(id => !Number.isNaN(id) && !serverIds.has(id));
  await Promise.all(pushIds.map(id =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ recipe_id: id }),
    }).catch(() => null),
  ));

  // 서버에만 있는 것 → 기기로. (다른 기기에서 누른 것)
  const pullRows = server.filter(r => !localIds.has(normalizeRecipeId(r.id)));
  if (pullRows.length > 0) {
    const merged = sortRecipesByUserSavedAtDesc([...local, ...pullRows] as any[]);
    localStorage.setItem(KEY[type], JSON.stringify(merged));
    // 화면들이 이 이벤트를 듣고 다시 센다.
    window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key: KEY[type] } }));
  }

  return {
    pushed: pushIds.length,
    pulled: pullRows.length,
    total: serverIds.size + pushIds.length,
  };
}

/**
 * 세 목록을 맞춘다. 로그인한 뒤와 앱을 열 때 한 번씩.
 *
 * `force` 를 주면 이번 세션에 이미 맞췄더라도 다시 맞춘다.
 */
export async function syncRecipeLists(
  userId: number | string | undefined | null,
  force = false,
): Promise<SyncReport | null> {
  if (!userId) return null;
  if (done && !force) return null;
  const auth = token();
  if (!auth) return null;
  done = true;

  const report: SyncReport = {};
  for (const type of TYPES) {
    try {
      report[type] = await syncOne(userId, type, auth);
    } catch (e) {
      // 한 종류가 실패해도 나머지는 맞춘다. 다음에 열 때 다시 시도한다.
      console.warn(`[recipeSync] ${type} 맞추기 실패:`, e);
      done = false;
    }
  }
  return report;
}

/** 로그아웃할 때. 다음 사람이 열면 처음부터 다시 맞춰야 한다. */
export function resetRecipeSync(): void {
  done = false;
}
