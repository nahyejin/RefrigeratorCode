const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

export type CoupangClickSource = 'pill' | 'card_cta';

interface CoupangClickPayload {
  source: CoupangClickSource;
  ingredient?: string;
  /** 그 카드의 부족 재료 개수 — "몇 개 부족할 때 실제로 사는가"를 보기 위함 */
  lackingCount?: number;
  recipeId?: number;
}

/**
 * 쿠팡 링크 클릭을 기록한다.
 *
 * 왜 필요한가: 지금 이 앱에는 분석 도구가 설치돼 있지 않고(`pwaAnalytics.ts` 는 gtag 호출
 * 코드만 있고 GA 스크립트가 없어 어디서도 쓰이지 않음), 쿠팡 클릭도 전혀 기록되지 않는다.
 * 그래서 "카드 CTA 와 pill 탭 중 무엇이 눌리는지", "부족 1~3개 기준이 맞는지" 를
 * 판단할 근거가 없다. 광고 자리를 더 늘리기 전에 이걸 먼저 쌓는다.
 *
 * 클릭 직후 쿠팡으로 이동하므로 일반 fetch 는 중간에 취소될 수 있어 sendBeacon 을 쓴다.
 * 측정 실패가 사용자 동작을 막으면 안 되므로 모든 예외는 조용히 무시한다.
 */
export function trackCoupangClick(payload: CoupangClickPayload): void {
  try {
    const body = JSON.stringify({
      ...payload,
      page: typeof location !== 'undefined' ? location.pathname : undefined,
    });
    const url = `${API_BASE_URL}/api/track/coupang-click`;

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 측정 실패는 무시 — 구매 동선을 막지 않는다
  }
}
