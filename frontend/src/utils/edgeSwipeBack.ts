import * as React from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * 아이폰: 화면 **왼쪽 끝에서 오른쪽으로 밀면 뒤로가기 버튼을 누른 것과 같게**(2026-09-24 사용자 요청).
 *
 * 처음엔(2026-09-22) 웹뷰 전체에 iOS 스와이프 뒤로 가기(`allowsBackForwardNavigationGestures`)를 켰는데,
 * 탭 이동도 방문 기록에 남아 **내 냉장고·냉장고 요리·요즘 인기 같은 탭 화면에서도** 밀면 이전 탭으로 넘어갔다.
 * 사용자가 원한 건 「위에 뒤로가기 버튼이 있는 화면(키워드·재료 검색 결과 등)에서만」이었다 → 웹뷰 제스처는 끄고,
 * 화면에 떠 있는 [BackButton] 이 여기 자기 onClick 을 올려 두면 **가장 나중에 뜬 버튼 하나**만 스와이프로 누른다.
 * 창 안의 뒤로가기(요리 AI 「지난 대화」 등)면 그 창 안에서 한 단계 뒤로 간다. 안드로이드는 시스템 뒤로 제스처가 따로 있다.
 */
const stack: Array<() => void> = [];

const EDGE = 24; // 이 폭 안에서 시작한 손짓만(화면 가운데 가로 스크롤과 구분)
const TRIGGER = 70; // 이만큼 오른쪽으로 끌면 뒤로
let startX = -1;
let startY = 0;
let installed = false;

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = stack.length && t && t.clientX <= EDGE ? t.clientX : -1;
    startY = t ? t.clientY : 0;
  }, { passive: true });
  window.addEventListener('touchend', e => {
    if (startX < 0) return;
    const t = e.changedTouches[0];
    const dx = t ? t.clientX - startX : 0;
    const dy = t ? Math.abs(t.clientY - startY) : 0;
    startX = -1;
    if (dx >= TRIGGER && dy < dx * 0.6) stack[stack.length - 1]?.();
  }, { passive: true });
}

/** 이 뒤로가기 버튼이 떠 있는 동안 왼쪽 끝 스와이프로 onBack 을 부른다(iOS 앱에서만). */
export function useEdgeSwipeBack(onBack: () => void): void {
  const ref = React.useRef(onBack);
  ref.current = onBack;
  React.useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return;
    install();
    const handler = () => ref.current();
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}
