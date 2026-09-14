const DAY_MS = 24 * 60 * 60 * 1000;

export const ONBOARDING_KEYS = {
  lastVisitAt: 'last_visit_at',
  visitEvaluatedThisSession: 'onboarding_visit_evaluated_this_session',
  usageGuideDueThisVisit: 'usage_guide_due_this_visit',
  usageGuideStartedThisVisit: 'usage_guide_started_this_visit',
  usageGuideFinishedThisVisit: 'usage_guide_finished_this_visit',
  usageGuideNeverShow: 'usage_guide_never_show',
  homeInstallDismissedThisSession: 'home_install_prompt_dismissed_this_session',
  homeInstallSnoozedUntil: 'home_install_prompt_snoozed_until',
  homeInstallNeverShow: 'home_install_prompt_never_show',
  expiryPushPromptSeen: 'expiry_push_prompt_seen',
} as const;

export const USAGE_GUIDE_INACTIVE_DAYS = 30;
export const HOME_INSTALL_SNOOZE_DAYS = 7;
export const USAGE_GUIDE_FINISHED_EVENT = 'usageGuideFinished';
export const USAGE_GUIDE_OPENED_EVENT = 'usageGuideOpened';

function parseTime(value: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function evaluateVisitForUsageGuide(now = Date.now()): boolean {
  if (sessionStorage.getItem(ONBOARDING_KEYS.visitEvaluatedThisSession) === 'true') {
    return sessionStorage.getItem(ONBOARDING_KEYS.usageGuideDueThisVisit) === 'true';
  }

  const previousVisitTime = parseTime(localStorage.getItem(ONBOARDING_KEYS.lastVisitAt));
  const isFirstVisit = previousVisitTime === 0;
  const isLongReturn = !isFirstVisit && now - previousVisitTime >= USAGE_GUIDE_INACTIVE_DAYS * DAY_MS;
  const neverShow = localStorage.getItem(ONBOARDING_KEYS.usageGuideNeverShow) === 'true';
  const shouldShowGuide = !neverShow && (isFirstVisit || isLongReturn);

  sessionStorage.setItem(ONBOARDING_KEYS.visitEvaluatedThisSession, 'true');
  sessionStorage.setItem(ONBOARDING_KEYS.usageGuideDueThisVisit, String(shouldShowGuide));
  sessionStorage.removeItem(ONBOARDING_KEYS.usageGuideStartedThisVisit);
  sessionStorage.removeItem(ONBOARDING_KEYS.usageGuideFinishedThisVisit);
  localStorage.setItem(ONBOARDING_KEYS.lastVisitAt, new Date(now).toISOString());

  return shouldShowGuide;
}

/**
 * 사용 가이드는 화면 네 곳을 이어서 돈다 — 내냉장고 → 냉장고요리 → 요리 캘린더
 * → 마이페이지. 화면마다 "(5/18)" 같은 진행 표시를 따로 계산하면 단계를
 * 더하거나 뺄 때 한 곳만 고쳐져 숫자가 튄다(실제로 없어진 '저장 버튼' 단계가
 * 남아 로그인하면 3/12 다음이 5/12였다). 단계 수는 여기 한 곳에 둔다.
 *
 * 월 목표·달력(요리 캘린더 2번째)과 마이페이지 세 단계는 로그인해야 있는
 * 화면이라, 비로그인이면 요리 캘린더 첫 단계에서 끝난다.
 */
export const USAGE_GUIDE_STEPS = {
  myFridge: 3,
  recipeList: 9,
  calendar: (loggedIn: boolean) => (loggedIn ? 2 : 1),
  myPage: 3,
} as const;

export function usageGuideTotalSteps(loggedIn: boolean): number {
  return USAGE_GUIDE_STEPS.myFridge + USAGE_GUIDE_STEPS.recipeList
    + USAGE_GUIDE_STEPS.calendar(loggedIn) + (loggedIn ? USAGE_GUIDE_STEPS.myPage : 0);
}

export function isUsageGuideDueThisVisit(): boolean {
  return sessionStorage.getItem(ONBOARDING_KEYS.usageGuideDueThisVisit) === 'true';
}

export function markUsageGuideFinished(): void {
  sessionStorage.setItem(ONBOARDING_KEYS.usageGuideFinishedThisVisit, 'true');
  window.dispatchEvent(new Event(USAGE_GUIDE_FINISHED_EVENT));
}

export function markUsageGuideOpened(): void {
  sessionStorage.setItem(ONBOARDING_KEYS.usageGuideStartedThisVisit, 'true');
  window.dispatchEvent(new Event(USAGE_GUIDE_OPENED_EVENT));
}

export function isStandaloneAppMode(): boolean {
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  return iosStandalone || Boolean(displayModeStandalone);
}

export function isHomeInstallPromptSnoozed(now = Date.now()): boolean {
  if (localStorage.getItem(ONBOARDING_KEYS.homeInstallNeverShow) === 'true') return true;
  if (sessionStorage.getItem(ONBOARDING_KEYS.homeInstallDismissedThisSession) === 'true') return true;

  const snoozedUntil = parseTime(localStorage.getItem(ONBOARDING_KEYS.homeInstallSnoozedUntil));
  return snoozedUntil > now;
}

export function dismissHomeInstallPromptForSession(): void {
  sessionStorage.setItem(ONBOARDING_KEYS.homeInstallDismissedThisSession, 'true');
}

export function snoozeHomeInstallPrompt(days = HOME_INSTALL_SNOOZE_DAYS): void {
  const snoozedUntil = Date.now() + days * DAY_MS;
  localStorage.setItem(ONBOARDING_KEYS.homeInstallSnoozedUntil, new Date(snoozedUntil).toISOString());
  dismissHomeInstallPromptForSession();
}

/**
 * 유통기한 임박 알림 안내 — **딱 한 번만** 본다(스누즈 없음).
 *
 * "기존 회원 전부를 서버에서 켜 달라" 는 요청이 있었지만, 알림 허용은
 * 브라우저가 그 사람의 실제 클릭으로만 내주는 것이라(보안상 그 무엇으로도
 * 우회 불가) 서버에서 대신 켜 줄 방법이 없다. 대신 로그인한 사람에게 이
 * 팝업을 한 번 보여줘 그 자리에서 바로 누를 수 있게 한다 — [알림켜기]/
 * [닫기] 어느 쪽을 눌러도 다시는 안 뜬다. 기기 단위라 다른 기기로 로그인하면
 * 그 기기에서는 다시 한 번 뜬다(어차피 알림 자체도 기기별로 따로 켜야 한다).
 */
export function isExpiryPushPromptSeen(): boolean {
  return localStorage.getItem(ONBOARDING_KEYS.expiryPushPromptSeen) === 'true';
}

export function markExpiryPushPromptSeen(): void {
  localStorage.setItem(ONBOARDING_KEYS.expiryPushPromptSeen, 'true');
}
