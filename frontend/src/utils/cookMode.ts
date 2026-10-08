/**
 * 요리 모드 시트를 **어디서든** 열기 위한 작은 저장소.
 *
 * 레시피 카드는 목록·인기·내냉장고·즐겨찾기 등 여러 화면에 흩어져 있다. 시트를
 * 화면마다 하나씩 두고 props 로 내려보내면 같은 코드를 여섯 군데에 적게 된다.
 * 시트는 앱에 **하나만** 띄워 두고, 카드는 "이걸 열어" 라고 말만 한다.
 */

export interface CookTarget {
  id: number;
  title?: string;
  link?: string;
  /** 내 냉장고 재료(대표어) — 있는 것/없는 것을 나눠 보여 주기 위해 */
  myIngredients?: string[];
}

type Listener = (target: CookTarget | null) => void;

let current: CookTarget | null = null;
const listeners = new Set<Listener>();

export function openCookMode(target: CookTarget) {
  // 레시피 번호가 없으면 **열지 않는다.** 직접 적은 기록(수동 기록)처럼 레시피가 없는 항목이 번호
  // 없이 넘어오면, 시트가 열린 채 **직전에 열었던 레시피 내용을 그대로 보여 줬다** — 사용자에게는
  // "내가 누르지 않은 항목의 드로우 패널이 열린다"(2026-10-09)로 보였다.
  const id = Number(target?.id);
  if (target?.id == null || !Number.isFinite(id)) return;
  current = target;
  listeners.forEach(fn => fn(current));
}

export function closeCookMode() {
  current = null;
  listeners.forEach(fn => fn(current));
}

export function subscribeCookMode(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => { listeners.delete(fn); };
}
