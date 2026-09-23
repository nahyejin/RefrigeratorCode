import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * 홈 화면 **달력 위젯**이 읽어 갈 요약본을 기기에 저장한다.
 *
 * 왜 서버를 안 부르고 이렇게 하나:
 *   위젯은 앱과 **다른 프로세스**라 로그인 토큰(웹뷰 localStorage)에 손댈 수 없다. 위젯이 직접
 *   서버를 부르려면 토큰을 따로 공유하고 위젯용 API 도 만들어야 하는데, 달력은 "이 달에 누가 며칠
 *   요리했나"만 보여 주면 되므로 **앱이 볼 때마다 요약본을 남겨 두고 위젯은 그것만 읽는** 쪽이 간단하다.
 *   (Capacitor Preferences 는 안드로이드에서 SharedPreferences `CapacitorStorage` 에 그대로 쓴다 —
 *   위젯이 같은 이름으로 열어 읽는다.)
 *
 * 무엇을 담나(2026-09-23 확장): 위젯이 **마이캘린더 화면과 같은 그림**을 그릴 수 있도록,
 *   날짜별 완료 점(사람 색)·계획 표식·이번 달 목표/달성/절약액·식구 목록·오늘내일 목록까지 넣는다.
 *   위젯은 읽기 전용이라 여기 없는 것은 그리지 않는다.
 *
 * 한계: 앱을 한 번도 안 열면 위젯은 빈 달력을 보여 준다. 그래서 위젯을 누르면 요리 캘린더로 가게 해 둔다.
 */
export const CALENDAR_WIDGET_KEY = 'cookmatch_calendar';

/** 날짜 한 칸 */
export interface CalendarWidgetDay {
  /** 그 날 완료한 사람들의 색(중복 = 여러 번). 많으면 위젯이 알아서 줄여 그린다 */
  dots: string[];
  /** 요리 계획이 있는 날인가 — 위젯은 빨간 손글씨 동그라미로 그린다(앱과 같은 표식) */
  planned?: boolean;
}

/** 오늘·내일 목록 한 줄 */
export interface CalendarWidgetItem {
  /** 'today' | 'tomorrow' */
  when: 'today' | 'tomorrow';
  title: string;
  /** 'plan'(계획) | 'done'(완료) */
  kind: 'plan' | 'done';
  /** 완료면 그 사람 색, 계획이면 빨강 */
  color: string;
}

export interface CalendarWidgetSnapshot {
  /** 'YYYY-MM' — 이 요약본이 어느 달인지 */
  month: string;
  /** 'YYYY-MM-DD' → 그 날 표시 */
  days: Record<string, CalendarWidgetDay>;
  /** 이번 달 목표 횟수(없으면 null) */
  goal: number | null;
  /** 이번 달 완료 합계 */
  done: number;
  /** 목표를 다 채웠을 때의 절약 추정액(원). 화면과 같은 계산값을 그대로 넘긴다 */
  goalSavings: number | null;
  /** 식구별 이번 달 완료 횟수 — 위젯의 범례·게이지에 쓴다 */
  members: { name: string; color: string; count: number }[];
  /** 오늘·내일 계획/완료 목록(4×2 위젯용). 너무 길면 앱이 잘라서 넘긴다 */
  upcoming: CalendarWidgetItem[];
  /** 저장 시각(ISO) */
  updatedAt: string;
}

/**
 * 요약본을 지운다 — 로그아웃·계정 전환 때.
 *
 * 안 지우면 로그아웃한 뒤에도 홈 화면 위젯에 앞 계정 식구들의 기록·레시피 제목이 그대로 남는다
 * (2026-09-23 지적). 위젯은 앱이 화면에서 빠질 때(MainActivity.onPause) 다시 그려지므로 홈으로
 * 나가는 순간 빈 달력이 된다.
 */
export async function clearCalendarWidgetSnapshot(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key: CALENDAR_WIDGET_KEY });
  } catch (e) {
    console.warn('[widget] 달력 요약본 삭제 실패:', e);
  }
}

/**
 * 범례에 늘어놓는 순서 — 앱 마이캘린더(목표 카드·달력 요약)와 위젯이 **같은 규칙**을 쓴다(2026-09-23).
 *   · 이번 달(또는 보고 있는 기간) 완료가 많은 사람부터
 *   · 같으면 나 먼저, 그다음은 그룹 식구 순서(= 색을 정하는 순서)
 *   · 0회인 사람은 애초에 map 에 없으니 범례에도 없다(설명할 점·게이지 색이 없다)
 * 색은 순위가 아니라 사람마다 고정이다 — 순위로 색을 매기면 달마다 같은 사람 색이 바뀐다.
 */
export function orderForLegend(
  counts: Map<number, number>, meId: number | null, memberIds: number[],
): [number, number][] {
  const rank = (uid: number) => {
    const i = memberIds.indexOf(uid);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return Array.from(counts.entries()).sort((a, b) =>
    b[1] - a[1]
    || (a[0] === meId ? -1 : b[0] === meId ? 1 : 0)
    || rank(a[0]) - rank(b[0]));
}

/** 네이티브 앱에서만 저장한다(웹에서는 읽을 위젯이 없다). */
export async function saveCalendarWidgetSnapshot(snapshot: CalendarWidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: CALENDAR_WIDGET_KEY, value: JSON.stringify(snapshot) });
  } catch (e) {
    // 위젯 요약본을 못 남겨도 앱 동작에는 지장이 없다 — 조용히 넘어간다.
    console.warn('[widget] 달력 요약본 저장 실패:', e);
  }
}
