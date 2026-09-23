import * as React from 'react';

/**
 * 안드로이드 폰 「뒤로」 버튼으로 **열려 있는 창부터 닫기**(2026-09-23 요청).
 *
 * 카메라 시트·요리 AI 대화창이 열린 채로 「뒤로」를 누르면 창은 그대로 두고 뒤 화면만 바뀌거나 앱이
 * 내려갔다. 안드로이드 사용자는 「뒤로」 = 지금 떠 있는 창 닫기로 기대한다.
 *
 * 창(Sheet·Dialog·대화창)은 열려 있는 동안 여기 닫기 함수를 쌓아 두고, NativeShortcutBridge 의
 * backButton 처리가 [closeTopOnBack] 으로 **맨 위(가장 나중에 열린) 창 하나만** 닫는다. 쌓인 창이 없을 때만
 * 이전 화면으로 간다. 웹·iOS 에서는 부르는 곳이 없어 아무 일도 하지 않는다.
 */
const stack: Array<() => void> = [];

/** 열려 있는 동안 「뒤로」로 닫히게 한다. onClose 는 최신 것을 쓴다. */
export function useCloseOnBack(open: boolean, onClose: () => void): void {
  const ref = React.useRef(onClose);
  ref.current = onClose;
  React.useEffect(() => {
    if (!open) return;
    const handler = () => ref.current();
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

/** 맨 위 창을 닫았으면 true(그러면 화면 뒤로 가기는 하지 않는다). */
export function closeTopOnBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}
