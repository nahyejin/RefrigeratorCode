/**
 * 짜 둔 식단 계획을 **기기에 남긴다.** 로그인 상태면 **서버에도** 남긴다.
 *
 * 왜 기기 저장이 먼저인가:
 *   계획은 아직 일어나지 않은 일이고, 그날이 지나면 값어치가 없다. 그리고
 *   **비회원도 식단을 짤 수 있어야** 하는데 서버만 쓰면 로그인 벽 뒤로 들어간다.
 *   그래서 기기 저장은 그대로 두고, 로그인 상태일 때만 서버에도 조용히 반영한다
 *   (실패해도 화면은 이미 기기 값으로 보여준 뒤라 무시).
 *
 * 왜 서버에도 남기나(2026-09-14):
 *   완료 기록은 서버에 있어 그룹원끼리 서로 볼 수 있는데, 계획만 기기에만
 *   있어서 "그룹 전체 계획 삭제" 같은 게 아예 성립하지 않았다 — 이 기기는
 *   다른 식구 계획을 알 방법이 없었기 때문. 완료 기록과 같은 자리(서버)에
 *   둬야 그룹원끼리 서로 보고, 대신 추가/삭제하고, 알림을 받을 수 있다.
 *
 * 왜 캘린더에 보여야 하나:
 *   짜고 끝나면 아무 데도 안 남는다. 그러면 다음 날 "뭐 해 먹기로 했더라" 를
 *   다시 물어야 하고, 식단을 짠 의미가 없다. 캘린더는 이미 "무엇을 언제
 *   먹었나" 를 보는 자리라, 앞날 계획도 같은 자리에 있는 게 맞다.
 *
 * 완료 기록과 섞지 않는다:
 *   캘린더의 기존 항목은 **실제로 만든 것**이다. 계획은 아직 아니다. 둘을 같은
 *   목록에 넣으면 "만들었다" 는 기록이 오염된다. 따로 두고 화면에서 구분한다.
 */

const KEY = 'cookmatch_meal_plan';

export interface PlannedMeal {
  /** 'YYYY-MM-DD' */
  date: string;
  recipeId: number;
  title: string;
  link?: string;
  thumbnail?: string;
  /** AI 가 이 날 이걸 고른 이유 */
  why?: string;
}

/** 그룹원의 계획까지 함께 보여줄 때 쓰는 모양. `/api/households/me/meal-plans` 응답. */
export interface HouseholdPlannedMeal {
  id: number;
  day: string;
  recipe_id: number;
  title: string;
  link?: string | null;
  thumbnail?: string | null;
  why?: string | null;
  user_id: number;
  nickname: string;
}

export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

function currentUserId(): number | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    const id = Number(u?.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function authToken(): string | null {
  try {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

export function loadPlan(): PlannedMeal[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(x => x && x.date && x.recipeId) : [];
  } catch {
    return [];
  }
}

/**
 * 서버에 있는 **내** 계획을 이 기기 저장소에 채워 넣는다(이 기기에 없는 것만).
 *
 * 왜 필요한가(2026-09-20): 겹침 확인(`conflictingDates`)과 `fill` 모드는 이 기기 저장소만
 * 본다. 그런데 계획을 다른 기기·앱·웹에서 짰거나 기기 저장소를 비웠으면, 캘린더에는
 * 서버 계획이 보이는데 식단을 담을 때는 "겹치는 날 없음"으로 판단돼 **묻지도 않고 덮어썼다**.
 * 담기 직전에 이 함수를 불러 기기 쪽을 서버와 맞춘다. 비로그인이거나 실패하면 아무것도 안 한다.
 */
export async function pullMyPlansIntoLocal(): Promise<void> {
  const me = currentUserId();
  if (!me) return;
  const start = toDateKey(new Date());
  const end = toDateKey(new Date(Date.now() + 120 * 24 * 60 * 60 * 1000));
  const rows = await fetchHouseholdMealPlans(start, end);
  const mine = rows.filter(r => r.user_id === me);
  if (mine.length === 0) return;
  const local = loadPlan();
  const has = new Set(local.map(m => `${m.date}|${m.recipeId}`));
  const add: PlannedMeal[] = mine
    .filter(r => !has.has(`${r.day}|${r.recipe_id}`))
    .map(r => ({
      date: r.day,
      recipeId: r.recipe_id,
      title: r.title,
      link: r.link ?? undefined,
      thumbnail: r.thumbnail ?? undefined,
      why: r.why ?? undefined,
    }));
  if (add.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...local, ...add].sort((a, b) => (a.date < b.date ? -1 : 1))));
  } catch {
    /* 저장이 막혀 있으면 조용히 넘어간다 */
  }
}

/** 새로 담을 계획이 **이미 짜 둔 날과 겹치는** 날짜들. */
export function conflictingDates(meals: PlannedMeal[]): string[] {
  const today = toDateKey(new Date());
  const have = new Set(loadPlan().filter(m => m.date >= today).map(m => m.date));
  return meals.map(m => m.date).filter(d => have.has(d));
}

/**
 * 계획을 저장한다. 지난 날짜는 함께 지운다 — 안 지우면 지난달 계획이 계속
 * 쌓여 캘린더를 어지럽힌다.
 *
 * `mode` 로 겹치는 날을 어떻게 할지 고른다:
 *   - `overwrite` — 그 날의 옛 계획을 새 것으로 바꾼다
 *   - `fill` — **이미 정해 둔 날은 그대로 두고** 비어 있는 날에만 넣는다
 *
 * 전에는 묻지 않고 늘 덮어썼다. 월요일에 정성껏 고쳐 둔 계획이 "다시 짜기" 한
 * 번에 말없이 사라졌다.
 */
export function savePlan(meals: PlannedMeal[], mode: 'overwrite' | 'fill' = 'overwrite'): void {
  const today = toDateKey(new Date());
  const existing = loadPlan().filter(m => m.date >= today);

  let incoming = meals;
  if (mode === 'fill') {
    const taken = new Set(existing.map(m => m.date));
    incoming = meals.filter(m => !taken.has(m.date));
  }

  const replacing = new Set(incoming.map(m => m.date));
  const kept = existing.filter(m => !replacing.has(m.date));
  try {
    localStorage.setItem(KEY, JSON.stringify([...kept, ...incoming].sort((a, b) => (a.date < b.date ? -1 : 1))));
  } catch {
    /* 저장이 막혀 있으면 조용히 넘어간다 — 화면은 이미 보여 줬다 */
  }

  if (incoming.length === 0) return;
  const userId = currentUserId();
  const token = authToken();
  if (!userId || !token) return;
  fetch(`${getApiUrl()}/api/users/${userId}/meal-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      mode,
      meals: incoming.map(m => ({
        date: m.date, recipe_id: m.recipeId, title: m.title, link: m.link, thumbnail: m.thumbnail, why: m.why,
      })),
    }),
  }).catch(e => console.warn('[mealPlan] 서버 저장 실패:', e));
}

/**
 * 날짜별로 찾아 쓰기 좋게. **하루에 여러 끼**가 올 수 있다.
 *
 * 예전엔 `Map<string, PlannedMeal>` 이라 한 날에 하나만 남았다. 그래서 식단
 * 화면도 요일을 옮길 때 두 요리를 **맞바꾸는** 수밖에 없었고, 토요일 것을
 * 일요일로 옮기면 일요일 것이 토요일로 밀려났다. 실제로는 하루에 두세 개를
 * 해 먹을 수 있어야 한다.
 */
export function planByDate(): Map<string, PlannedMeal[]> {
  const map = new Map<string, PlannedMeal[]>();
  loadPlan().forEach(m => {
    const list = map.get(m.date);
    if (list) list.push(m);
    else map.set(m.date, [m]);
  });
  return map;
}

export function clearPlanOn(date: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadPlan().filter(m => m.date !== date)));
  } catch {
    /* 무시 */
  }
}

/** 그 날의 **한 끼만** 지운다. 하루에 여러 개가 있을 수 있으므로 필요하다. */
export function clearPlanMeal(date: string, recipeId: number): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(loadPlan().filter(m => !(m.date === date && m.recipeId === recipeId))),
    );
  } catch {
    /* 무시 */
  }
  const userId = currentUserId();
  const token = authToken();
  if (!userId || !token) return;
  fetch(`${getApiUrl()}/api/users/${userId}/meal-plans?date=${encodeURIComponent(date)}&recipe_id=${recipeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(e => console.warn('[mealPlan] 서버 삭제 실패:', e));
}

/** 짜 둔 계획을 **전부** 지운다. 하나씩 취소하기 번거롭다는 요청(2026-09-14). */
export function clearAllPlans(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
  const userId = currentUserId();
  const token = authToken();
  if (!userId || !token) return;
  fetch(`${getApiUrl()}/api/users/${userId}/meal-plans`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(e => console.warn('[mealPlan] 서버 전체 삭제 실패:', e));
}

// =====================
// 그룹(서버) 계획 — 완료 기록처럼 그룹원끼리 서로 보고 대신 처리하기
// =====================

/** 그룹(또는 혼자면 나 혼자)의 앞으로의 계획을 서버에서 받아온다. 비로그인/실패면 빈 배열. */
export async function fetchHouseholdMealPlans(start: string, end: string): Promise<HouseholdPlannedMeal[]> {
  const token = authToken();
  if (!token) return [];
  try {
    const res = await fetch(
      `${getApiUrl()}/api/households/me/meal-plans?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.plans) ? data.plans : [];
  } catch (e) {
    console.warn('[mealPlan] 그룹 계획 조회 실패:', e);
    return [];
  }
}

/**
 * 특정 사람의 계획 한 끼를 지운다. **내 것이든 식구 것이든** 이 함수 하나로
 * 처리한다 — 서버가 같은 그룹인지 확인하고, 내가 아니면 당사자에게 알림을
 * 남긴다. `targetUserId` 가 나 자신이면 로컬 저장소도 같이 지운다(이 기기가
 * 그 사람 계정으로 로그인돼 있을 때만 로컬에도 있을 수 있으므로).
 */
export async function deleteMealPlanFor(targetUserId: number, date: string, recipeId: number): Promise<void> {
  const token = authToken();
  if (!token) {
    // 게스트(계정 없음)는 서버에 지울 게 없다 — 그렇다고 아무 일도 안
    // 일어나면 "계획 취소"를 눌러도 그대로 남아 있는 것처럼 보인다(실사용
    // 확인, 2026-09-15, 요리 캘린더를 비회원에게 연 뒤 발견). 게스트의
    // 계획은 전부 이 기기 것뿐이라(그룹이 있을 수 없음) targetUserId 와
    // 무관하게 기기 사본만 지우면 된다.
    clearPlanMeal(date, recipeId);
    return;
  }
  if (targetUserId === currentUserId()) {
    clearPlanMeal(date, recipeId);
    return;
  }
  try {
    await fetch(
      `${getApiUrl()}/api/users/${targetUserId}/meal-plans?date=${encodeURIComponent(date)}&recipe_id=${recipeId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (e) {
    console.warn('[mealPlan] 대리 삭제 실패:', e);
  }
}

/** 그룹 전체(나를 포함한 모든 식구)의 앞으로의 계획을 한 번에 지운다. */
export async function clearAllHouseholdMealPlans(): Promise<void> {
  const token = authToken();
  if (!token) return;
  try {
    await fetch(`${getApiUrl()}/api/households/me/meal-plans`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.warn('[mealPlan] 그룹 전체 삭제 실패:', e);
  }
  // 이 기기의 로컬 계획(내 몫)도 함께 지운다 — 서버만 지우면 새로고침 전까지
  // 이 기기에는 내 계획이 그대로 남아 있는 것처럼 보인다.
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
