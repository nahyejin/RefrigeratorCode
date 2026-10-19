/**
 * 내냉장고 **밖**의 화면(장보기 「샀어요」·요리 끝내고 다 쓴 재료 빼기)이 냉장고를 바꿀 때 쓴다 (2026-10-19).
 *
 * 왜 따로 두나:
 *   서버 저장은 "목록 통째로 바꾸기" 다. 이 화면들은 예전에 **기기에 남은 목록(localStorage)** 에
 *   한 개를 더하거나 빼서 통째로 올렸다. 기기 목록이 옛것이면(다른 기기·식구가 그새 바꿨거나,
 *   한동안 내냉장고를 안 열었으면) 그 사이 바뀐 재료가 전부 옛 목록으로 돌아갔다 — 하지도 않은
 *   「N개 뺌」 이 기록된 사고와 같은 구조.
 *
 * 어떻게:
 *   1) 서버에서 지금 목록을 받아 와서 2) 거기에 바꿀 것을 적용하고 3) base(받아 온 목록)와 함께 저장한다.
 *   그 사이 또 바뀌었으면 서버가 409 와 최신 목록을 주므로 그 위에 한 번 더 적용한다.
 *   서버 목록을 못 받으면 **서버는 건드리지 않는다**(기기에만 남고, 내냉장고를 열면 서버 기준으로 맞춰진다).
 */

export type FridgeBox = 'frozen' | 'fridge' | 'room';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FridgeBoxes = Record<FridgeBox, any[]>;

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';
const STORAGE_KEY = 'myfridge_ingredients';

const names = (b: FridgeBoxes) => [...b.frozen, ...b.fridge, ...b.room].map(it => it.name);
const pick = (raw: any): FridgeBoxes => ({
  frozen: Array.isArray(raw?.frozen) ? raw.frozen : [],
  fridge: Array.isArray(raw?.fridge) ? raw.fridge : [],
  room: Array.isArray(raw?.room) ? raw.room : [],
});

/**
 * 서버 냉장고에 `mutate` 를 적용해 저장한다. 성공하면 기기 저장도 그 목록으로 맞추고 돌려준다.
 * `mutate` 가 null 을 돌려주면(바꿀 것 없음) 저장하지 않는다. 실패하면 null.
 */
export async function saveFridgeChange(
  userId: number | string,
  token: string | null,
  mutate: (current: FridgeBoxes) => FridgeBoxes | null,
  source: string,
): Promise<FridgeBoxes | null> {
  if (!token) return null;
  const url = `${API_BASE_URL}/api/users/${userId}/ingredients`;
  let current: FridgeBoxes;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    current = pick(await r.json());
  } catch {
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const next = mutate(current);
    if (!next) return current;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ingredients: next, source, base: names(current) }),
      });
      if (r.status === 409) {
        current = pick((await r.json().catch(() => null))?.current);
        continue;
      }
      if (!r.ok) return null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { key: STORAGE_KEY } }));
      } catch { /* 기기 저장이 막혀도 서버는 맞다 */ }
      return next;
    } catch {
      return null;
    }
  }
  return null;
}
