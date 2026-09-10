import * as Sentry from '@sentry/react';

/**
 * **사용자가 겪은 오류를 우리가 알게 한다.**
 *
 * 배포하고 나면 화면이 하얗게 뜨거나 버튼이 안 먹어도 **아무도 말해 주지
 * 않는다.** 대부분은 그냥 앱을 닫는다. 그래서 터진 것은 자동으로 알리고,
 * "이건 왜 이래요" 는 마이페이지의 문의 창구(`ContactBox`)로 받는다.
 *
 * **켜는 법** — Vercel 환경변수에 `VITE_SENTRY_DSN` 을 넣으면 그때부터 돈다.
 * 값이 없으면 아무 일도 안 한다(개발 중에는 넣지 않는 편이 낫다 — 내가 내는
 * 오류가 목록을 덮는다).
 *
 * **무엇을 안 보내나** — 개인정보는 보내지 않는다:
 *   · `sendDefaultPii: false` — IP·쿠키·헤더를 붙이지 않는다
 *   · 이메일·닉네임을 태그로 달지 않는다. 누구인지는 몰라도 **무엇이
 *     터졌는지**만 알면 고칠 수 있다
 *   · 냉장고 재료 이름이 URL 이나 값에 실려 나가지 않도록, 보내기 직전에
 *     한 번 더 훑어 지운다
 */

const DSN = (import.meta.env && (import.meta.env as any).VITE_SENTRY_DSN) || '';

/** 오류 메시지에 섞여 나갈 수 있는 개인적인 값을 지운다. */
function scrub(value: string): string {
  return value
    // 이메일
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<이메일>')
    // 로그인 토큰이 주소나 메시지에 실린 경우
    .replace(/(token|authorization|api[_-]?key)=[^&\s]+/gi, '$1=<가림>')
    // 냉장고 재료는 주소의 `my_ingredients` 로 나간다 — 무엇을 먹는지는 오류와 무관하다
    .replace(/(my_ingredients|ingredients)=[^&\s]+/gi, '$1=<가림>');
}

export function initErrorTracking() {
  if (!DSN) return;   // 값이 없으면 켜지 않는다

  Sentry.init({
    dsn: DSN,
    environment: (import.meta.env && (import.meta.env as any).MODE) || 'production',

    // **개인정보를 붙이지 않는다.**
    sendDefaultPii: false,

    // 얼마나 자주 겪는지는 알아야 고칠 순서를 정한다. 다만 모든 요청을 추적하면
    // 무료 한도를 금방 쓴다 — 10%만 표본으로 본다.
    tracesSampleRate: 0.1,

    // 우리가 고칠 수 없는 잡음은 애초에 안 보낸다. 이것들이 목록을 덮으면
    // 진짜 오류가 묻힌다.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // 사용자가 페이지를 떠나거나 네트워크가 끊긴 것 — 앱의 잘못이 아니다
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      'AbortError',
    ],

    beforeSend(event) {
      try {
        if (event.request?.url) event.request.url = scrub(event.request.url);
        if (event.message) event.message = scrub(event.message);
        event.exception?.values?.forEach(v => {
          if (v.value) v.value = scrub(v.value);
        });
      } catch {
        /* 지우다 실패했으면 그대로 보내지 않는다 */
        return null;
      }
      return event;
    },
  });
}

/**
 * 잡아서 처리한 오류를 남긴다 — 화면은 멀쩡한데 속으로 실패한 경우.
 * (예: 냉장고 목록을 못 받아 와서 「다시 시도」 를 보여 준 순간)
 */
export function noteHandledError(err: unknown, where: string) {
  if (!DSN) return;
  Sentry.captureException(err, { tags: { where } });
}
