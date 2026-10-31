import { isNativeApp } from './pwa';

const DAY_MS = 24 * 60 * 60 * 1000;

export const ONBOARDING_KEYS = {
  lastVisitAt: 'last_visit_at',
  visitEvaluatedThisSession: 'onboarding_visit_evaluated_this_session',
  usageGuideDueThisVisit: 'usage_guide_due_this_visit',
  usageGuideStartedThisVisit: 'usage_guide_started_this_visit',
  usageGuideFinishedThisVisit: 'usage_guide_finished_this_visit',
  usageGuideNeverShow: 'usage_guide_never_show',
  expiryPushPromptSeen: 'expiry_push_prompt_seen',
} as const;

/**
 * 첫 시작 팝업에서 [이 재료로 요리 보기]로 곧바로 요리 화면에 간 사람(2026-10-29) — 첫 방문에는 사용 가이드를 건너뛴다
 * (가치를 보기 전에 18단계 안내를 얹지 않으려고). 대신 **다음에 앱을 열 때** 내냉장고에서 한 번 보여 준다.
 * 가이드가 실제로 열리면(`markUsageGuideOpened`) 표시를 지운다.
 */
const GUIDE_DEFERRED_KEY = 'usage_guide_deferred_to_next_visit';

export function deferUsageGuideToNextVisit(): void {
  try {
    if (!localStorage.getItem(ONBOARDING_KEYS.usageGuideNeverShow)) localStorage.setItem(GUIDE_DEFERRED_KEY, 'true');
  } catch {
    /* 표시를 못 남기면 가이드는 안 뜬다 — 마이페이지에서 다시 볼 수 있다 */
  }
}

export const USAGE_GUIDE_INACTIVE_DAYS = 30;
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
  // 첫 방문에 가이드를 미뤄 둔 사람은 그다음 방문에서 한 번(가이드가 열릴 때까지 매 방문 대상)
  const deferred = !isFirstVisit && localStorage.getItem(GUIDE_DEFERRED_KEY) === 'true';
  const shouldShowGuide = !neverShow && (isFirstVisit || isLongReturn || deferred);

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
 * 마이페이지 세 단계는 로그인해야 있는 화면이라, 비로그인이면 요리 캘린더 마지막 단계(15)에서 끝난다.
 */
export const USAGE_GUIDE_STEPS = {
  myFridge: 3,
  recipeList: 9,
  // 요리 캘린더 3단계(2026-10-22): 13 이번 주 **AI** 식단 추천 버튼 → 14 요리 기록 달력 → 15 이번 달 목표.
  // 일반 「이번 주 식단 추천」 버튼은 따로 소개하지 않는다(AI 가 더 강조돼야 한다는 사용자 요청).
  // 예전엔 로그인한 사람만 월 목표·달력 단계를 봤는데(2단계), 달력은 비로그인도 쓰는 화면이라 모두에게 보여 준다.
  calendar: 3,
  myPage: 3,
} as const;

export function usageGuideTotalSteps(loggedIn: boolean): number {
  return USAGE_GUIDE_STEPS.myFridge + USAGE_GUIDE_STEPS.recipeList
    + USAGE_GUIDE_STEPS.calendar + (loggedIn ? USAGE_GUIDE_STEPS.myPage : 0);
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
  try { localStorage.removeItem(GUIDE_DEFERRED_KEY); } catch { /* 무시 */ }
  window.dispatchEvent(new Event(USAGE_GUIDE_OPENED_EVENT));
}

/** 가이드가 열렸고 아직 끝나지 않았다 — 이 동안은 다른 팝업(두 번째 방문 로그인 안내 등)을 띄우지 않는다. */
export function isUsageGuideRunning(): boolean {
  return sessionStorage.getItem(ONBOARDING_KEYS.usageGuideStartedThisVisit) === 'true'
    && sessionStorage.getItem(ONBOARDING_KEYS.usageGuideFinishedThisVisit) !== 'true';
}

/**
 * 마이페이지 「사용 가이드 다시 보기」 — 이번 방문을 「가이드를 볼 차례」로 되돌린다. 호출한 쪽이 `/my-fridge` 로 보낸다.
 * 내냉장고가 열리면서 가이드를 처음부터 시작하고(첫 시작 팝업은 이미 본 기기라 다시 뜨지 않는다), 끝나면 냉장고요리 →
 * 캘린더 →(로그인했으면) 마이페이지로 이어진다.
 */
export function requestUsageGuideReplay(): void {
  sessionStorage.setItem(ONBOARDING_KEYS.visitEvaluatedThisSession, 'true');
  sessionStorage.setItem(ONBOARDING_KEYS.usageGuideDueThisVisit, 'true');
  sessionStorage.removeItem(ONBOARDING_KEYS.usageGuideStartedThisVisit);
  sessionStorage.removeItem(ONBOARDING_KEYS.usageGuideFinishedThisVisit);
  try { localStorage.removeItem('myfridge_guide_completed'); } catch { /* 무시 */ }
}

export function isStandaloneAppMode(): boolean {
  // 스토어에서 받은 앱(Capacitor) 안이면 "홈 화면에 추가" 안내는 의미가 없다 —
  // 이미 설치된 앱이라 웹(PWA)용 안내가 뜨면 심사에서도 어색하다.
  if (isNativeApp()) return true;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  return iosStandalone || Boolean(displayModeStandalone);
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
