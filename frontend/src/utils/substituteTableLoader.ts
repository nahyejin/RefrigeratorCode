/**
 * 대체 재료 표를 **작은 파일**로 받는 곳(2026-11-07) — 화면 네 곳(요즘인기·냉장고요리·재료 상세·마이페이지)이 각자 29MB CSV 를 받아 파싱하던 것을 한 곳으로 모았다.
 *
 * 왜 바꿨나 — 예전 표(`ingredient_substitute_table.csv`)는 29MB·12만 쌍이었다. 휴대폰은 저장소(localStorage)가 5MB 안팎이라 저장이 **조용히 실패**했고,
 * 그래서 화면에 들어갈 때마다 29MB 를 다시 받아 파싱했다. 그런데 화면이 실제로 쓰는 쌍은 유사도 0.60 초과·브랜드 제외(utils/substituteRules.ts)뿐이라 4만 쌍(약 0.85MB)이다.
 * 매일 배치(ingredient_management/generate_substitutes.py)가 그 쌍만 추려 `ingredient_substitute_table_lite.json` 으로 같이 만든다 — 모양: {"v":1,"t":{"재료":[["대체",0.72],…]}}.
 *
 * 받는 순서: 이미 메모리에 있음 → 하루 안에 저장해 둔 것(localStorage `substitute_table_cache`) → 파일 받기(저장도 시도, 실패해도 조용히 넘어감).
 * 저장분의 모양은 {version, savedAt, data} 로 예전과 같고 data 는 파일의 `t` 그대로다(작아서 5MB 한도에 들어간다). 예전 버전(29MB 시절) 저장분은 버전이 달라 버려진다.
 */
import { shareSubstituteTable, getSharedSubstituteTable, type SharedSubstituteTable } from './substituteStore';

export const SUBSTITUTE_LITE_URL = '/ingredient_substitute_table_lite.json';
const CACHE_KEY = 'substitute_table_cache';
const CACHE_VERSION = '3.0';
// 표는 사전이 바뀌든 말든 매일 재생성되므로(06:30 배치) 하루 지나면 다시 받는다.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CompactTable = { [ingredientA: string]: [string, number][] };

/** 파일/저장분의 `t` → 화면이 쓰는 모양({ 재료: [{ingredient_b, similarity_score}] }). 점수 높은 순은 배치가 이미 맞춰 둔다. */
function expand(compact: CompactTable): SharedSubstituteTable {
  const table: SharedSubstituteTable = {};
  for (const a of Object.keys(compact)) {
    const list = compact[a];
    if (!Array.isArray(list)) continue;
    table[a] = list.map(([b, s]) => ({ ingredient_b: b, similarity_score: typeof s === 'number' ? s : undefined }));
  }
  return table;
}

type CacheEntry = { version?: string; savedAt?: number; data?: CompactTable };

function readCacheEntry(): CacheEntry | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.version === CACHE_VERSION && c.data && typeof c.data === 'object') return c as CacheEntry;
  } catch { /* 저장분이 깨졌거나 저장소가 막혀 있으면 없는 것으로 */ }
  return null;
}

let cachedMemo: SharedSubstituteTable | null = null;
/** 동기로 읽는 저장분 — 레시피 창이 목록을 거치지 않고 열렸을 때만 쓴다. 하루가 지났어도 칩은 보여 주는 게 낫다. */
export function readCachedSubstituteTable(): SharedSubstituteTable | null {
  if (cachedMemo) return cachedMemo;
  const entry = readCacheEntry();
  if (!entry || !entry.data) return null;
  cachedMemo = expand(entry.data);
  return cachedMemo;
}

function saveCache(compact: CompactTable): void {
  try {
    localStorage.removeItem(CACHE_KEY);   // 예전(29MB 시절) 저장분이 남아 자리를 차지하고 있을 수 있다
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), data: compact }));
  } catch { /* 한도 초과·비공개 창 — 저장만 못 할 뿐 화면은 정상 */ }
}

let inflight: Promise<SharedSubstituteTable> | null = null;

/** 대체 재료 표. 여러 화면이 동시에 불러도 한 번만 받는다. 실패하면 저장분(없으면 빈 표). */
export function loadSubstituteTable(): Promise<SharedSubstituteTable> {
  const sharedNow = getSharedSubstituteTable();
  if (sharedNow) return Promise.resolve(sharedNow);
  if (inflight) return inflight;

  inflight = (async () => {
    const entry = readCacheEntry();
    if (entry && entry.data && typeof entry.savedAt === 'number' && Date.now() - entry.savedAt < CACHE_TTL_MS) {
      cachedMemo = expand(entry.data);
      shareSubstituteTable(cachedMemo);
      return cachedMemo;
    }
    try {
      const res = await fetch(SUBSTITUTE_LITE_URL);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const compact: CompactTable = (json && json.t) || {};
      const table = expand(compact);
      if (Object.keys(table).length === 0) throw new Error('empty');
      saveCache(compact);
      cachedMemo = table;
      shareSubstituteTable(table);
      return table;
    } catch (e) {
      console.warn('[substituteTableLoader] 대체 재료 표 로드 실패:', e);
      if (entry && entry.data) {          // 하루 지난 저장분이라도 없는 것보다 낫다
        cachedMemo = expand(entry.data);
        shareSubstituteTable(cachedMemo);
        return cachedMemo;
      }
      return {};
    }
  })().finally(() => { inflight = null; });
  return inflight;
}
