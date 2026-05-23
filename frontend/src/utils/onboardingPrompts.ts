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
