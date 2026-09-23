import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * 홈 화면 **달력 위젯**이 읽어 갈 요약본을 기기에 저장한다.
 *
 * 왜 서버를 안 부르고 이렇게 하나:
 *   위젯은 앱과 **다른 프로세스**라 로그인 토큰(웹뷰 localStorage)에 손댈 수 없다. 위젯이 직접
 *   서버를 부르려면 토큰을 따로 공유하고 위젯용 API 도 만들어야 하는데, 달력은 "지금 이 달에 며칠
 *   요리했나"만 보여 주면 되므로 **앱이 볼 때마다 요약본을 남겨 두고 위젯은 그것만 읽는** 쪽이 간단하다.
 *   (Capacitor Preferences 는 안드로이드에서 SharedPreferences `CapacitorStorage` 에 그대로 쓴다 —
 *   위젯이 같은 이름으로 열어 읽는다.)
 *
 * 한계: 앱을 한 번도 안 열면 위젯은 빈 달력을 보여 준다. 그래서 위젯에도 "앱에서 보기"로 들어가는
 * 길을 둔다(위젯 전체를 누르면 요리 캘린더로 이동).
 */
export const CALENDAR_WIDGET_KEY = 'cookmatch_calendar';

export interface CalendarWidgetSnapshot {
  /** 'YYYY-MM' — 이 요약본이 어느 달인지 */
  month: string;
  /** 'YYYY-MM-DD' → 그 날 완료한 요리 수 */
  days: Record<string, number>;
  /** 이번 달 목표 횟수(없으면 null) */
  goal: number | null;
  /** 이번 달 완료 합계 */
  done: number;
  /** 저장 시각(ISO) — 위젯이 "몇 시 기준"인지 보여 줄 때 쓴다 */
  updatedAt: string;
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
