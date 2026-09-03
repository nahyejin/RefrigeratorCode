/**
 * 짜 둔 식단 계획을 **기기에 남긴다.**
 *
 * 왜 서버가 아닌가:
 *   계획은 아직 일어나지 않은 일이고, 그날이 지나면 값어치가 없다. 서버에 표를
 *   하나 더 만들 만한 무게가 아니다. 그리고 **비회원도 식단을 짤 수 있어야**
 *   하는데 서버에 두면 로그인 벽 뒤로 들어간다.
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

export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
}

/** 날짜별로 찾아 쓰기 좋게. */
export function planByDate(): Map<string, PlannedMeal> {
  const map = new Map<string, PlannedMeal>();
  loadPlan().forEach(m => map.set(m.date, m));
  return map;
}

export function clearPlanOn(date: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadPlan().filter(m => m.date !== date)));
  } catch {
    /* 무시 */
  }
}
