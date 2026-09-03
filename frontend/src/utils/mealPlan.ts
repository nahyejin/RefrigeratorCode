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

/**
 * 계획을 저장한다. **같은 날짜의 옛 계획은 덮어쓴다.**
 *
 * 지난 날짜는 함께 지운다 — 안 지우면 지난달 계획이 계속 쌓여 캘린더를 어지럽힌다.
 */
export function savePlan(meals: PlannedMeal[]): void {
  const today = toDateKey(new Date());
  const replacing = new Set(meals.map(m => m.date));
  const kept = loadPlan().filter(m => m.date >= today && !replacing.has(m.date));
  try {
    localStorage.setItem(KEY, JSON.stringify([...kept, ...meals].sort((a, b) => (a.date < b.date ? -1 : 1))));
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
