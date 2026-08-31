import React, { useEffect, useRef, useState } from 'react';

interface GuideStep {
  targetSelector: string;
  message: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface GuideOverlayProps {
  visible: boolean;
  currentStep: number;
  onNext: () => void;
  onClose: () => void;
  /** 이전 단계 (첫 단계에서는 버튼 숨김) */
  onPrevious?: () => void;
  steps: GuideStep[];
  isLastStepConfirm?: boolean;
  totalSteps?: number; // 전체 가이드 단계 수 (기본값: steps.length)
  startStepOffset?: number; // 시작 단계 오프셋 (기본값: 0)
}

/** 하단 고정 탭 높이만큼 위까지를 안전 영역으로 봄 */
const BOTTOM_TAB_RESERVE_PX = 80;

/**
 * 화면에 보이는 구간 + 탭 위까지만 하이라이트.
 * 긴 요소(보관 칸 전체 등)는 뷰포트와 교차하는 세로 구간만 노란 박스로 잘림.
 */
function clipGuideHighlightRect(rect: DOMRect): DOMRect {
  const top = Math.max(rect.top, 0);
  const preferredBottom = Math.min(rect.bottom, window.innerHeight - BOTTOM_TAB_RESERVE_PX);
  // 탭 위까지만 잘랐더니 남는 높이가 없는 경우 — 작은 버튼이 문서 끝이라 더 스크롤할
  // 수 없어 탭 근처에 걸린 때다. 그럴 땐 화면 끝까지 허용한다.
  // 하단 탭에 조금 겹치는 게, 상자를 아예 안 그려서 무엇을 가리키는지 모르는 것보다 낫다.
  const bottom =
    preferredBottom - top >= 16 ? preferredBottom : Math.min(rect.bottom, window.innerHeight);
  return new DOMRect(rect.left, top, rect.width, Math.max(0, bottom - top));
}

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  visible,
  currentStep,
  onNext,
  onClose,
  onPrevious,
  steps,
  isLastStepConfirm = false,
  totalSteps,
  startStepOffset = 0
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  /**
   * 이번 단계에서 이미 스크롤을 맞췄는지.
   * 매번 맞추면 scroll 이벤트가 다시 이 함수를 부르면서 끝없이 되돌아온다.
   */
  const scrolledForStep = useRef<number | null>(null);

  useEffect(() => {
    if (!visible || currentStep >= steps.length) return;

    const selector = steps[currentStep].targetSelector;
    scrolledForStep.current = null;

    /** 타겟을 찾아 위치를 잰다. 못 찾았으면 false */
    const updateTargetPosition = (): boolean => {
      const target = document.querySelector(selector);

      if (!target) {
        // 이번 단계의 타겟을 못 찾으면 targetRect 를 반드시 비워야 한다.
        // 안 비우면 직전 단계에서 찾았던 위치가 그대로 남아, 노란 하이라이트가
        // 엉뚱한(이전 단계) 요소 자리에 떠 있는 것처럼 보인다 — 실제로 UI가
        // 바뀌어 selector 가 안 맞게 됐을 때 이 증상으로 나타났다.
        setTargetRect(null);
        return false;
      }

      // 화면 밖에 있는 것을 가리키면 안 된다.
      // 예전엔 스크롤을 전혀 건드리지 않아서, 타겟이 접힌 화면 아래에 있으면
      // clipGuideHighlightRect 가 높이 0 으로 잘라 냈고 → 최소 크기(24px) 상자가
      // **화면 맨 위**에 그려졌다. 안내 문구와 상관없는 자리에 노란 상자가 뜨는
      // 증상이 이것이었다. 그러니 재기 전에 먼저 보이는 자리로 끌어온다.
      if (scrolledForStep.current !== currentStep) {
        scrolledForStep.current = currentStep;
        const safeTop = 16;
        const safeBottom = window.innerHeight - BOTTOM_TAB_RESERVE_PX - 8;
        const r = target.getBoundingClientRect();
        if (r.top < safeTop || r.bottom > safeBottom) {
          // 1) 먼저 안쪽 스크롤 상자를 맞춘다. inline:'nearest' 라 재료 배지처럼
          //    가로 스크롤 안에 있는 것을 가리켜도 가로로 튀지 않는다.
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          // 2) 그다음 페이지를 움직여 **안전 구간(고정 헤더 아래 ~ 하단 탭 위)의
          //    가운데**로 가져온다. scrollIntoView 의 'center' 는 뷰포트 기준이라
          //    하단 탭에 가려지는 자리로 데려다 놓는 경우가 있다.
          const r2 = target.getBoundingClientRect();
          const want = safeTop + (safeBottom - safeTop) / 2 - r2.height / 2;
          window.scrollBy({ top: r2.top - want });
        }
      }

      const rect = clipGuideHighlightRect(target.getBoundingClientRect());
      // 스크롤을 맞췄는데도 볼 수 있는 높이가 남지 않으면(고정 헤더에 완전히 가림 등)
      // 엉뚱한 자리에 상자를 그리느니 아예 그리지 않는다. 문구는 화면 가운데로 간다.
      setTargetRect(rect.height >= 8 ? rect : null);
      return true;
    };

    updateTargetPosition();
    // capture 단계로 듣는다 — 페이지가 아니라 안쪽 스크롤 상자가 움직일 때도
    // (재료 배지 가로 스크롤 등) 위치를 다시 재야 하기 때문이다.
    window.addEventListener('scroll', updateTargetPosition, true);
    window.addEventListener('resize', updateTargetPosition);

    /**
     * 이 단계가 떠 있는 동안 계속 다시 잰다.
     *
     * 한 번만 재면 안 되는 이유가 둘 있다.
     *  1) 타겟이 **늦게 생긴다.** 레시피 카드(RecipeCard)는 썸네일이 실제로 뜨는지
     *     확인될 때까지 null 을 돌려주므로, 가이드가 시작되는 시점엔 즐겨찾기·완료·
     *     공유·기록 버튼이 아직 문서에 없다. 예전엔 여기서 포기해 하이라이트가
     *     아예 안 나왔다.
     *  2) 타겟이 **자리를 옮긴다.** 위쪽 카드가 뒤늦게 렌더되면 아래가 밀린다.
     */
    let tries = 0;
    let warned = false;
    const tick = setInterval(() => {
      const ok = updateTargetPosition();
      tries += 1;
      if (!ok && !warned && tries >= 40) {
        warned = true;
        console.warn('[GuideOverlay] 타겟 요소를 찾을 수 없습니다:', selector);
      }
    }, 250);

    return () => {
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.removeEventListener('resize', updateTargetPosition);
      clearInterval(tick);
    };
  }, [visible, currentStep, steps]);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const position = step.position || 'bottom';

  // 툴팁 위치 계산
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 'var(--z-modal)',
      };
    }

    const isStorageAreas = steps[currentStep].targetSelector.includes('storage-areas');
    const tooltipWidth = isStorageAreas || steps[currentStep].targetSelector.includes('settings-icon') ? 340 : 320;
    const tooltipHeight = isStorageAreas ? 220 : 100;
    const spacing = 12;
    let top = 0;
    let left = 0;

    // 재고 영역 첫 안내: 하이라이트 바로 옆(아래 우선)에 붙임 — 'top' 배치 + 상단 클램프로 화면 최상단에 뜨는 현상 방지
    if (isStorageAreas) {
      const gap = 10;
      const th = tooltipHeight;
      const maxTop = window.innerHeight - BOTTOM_TAB_RESERVE_PX - 8 - th;

      let t = targetRect.bottom + gap;
      if (t > maxTop) {
        t = targetRect.top - gap - th;
      }
      if (t < 16) {
        t = Math.min(targetRect.bottom + gap, maxTop);
      }
      t = Math.max(16, Math.min(t, maxTop));

      let l = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      if (l < 16) l = 16;
      if (l + tooltipWidth > window.innerWidth - 16) {
        l = window.innerWidth - tooltipWidth - 16;
      }

      return {
        position: 'fixed',
        top: `${t}px`,
        left: `${l}px`,
        zIndex: 'var(--z-modal)',
      };
    }

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - spacing;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        if (top < 16) {
          top = targetRect.bottom + spacing;
        }
        break;
      case 'bottom':
        top = targetRect.bottom + spacing;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        // 모달을 타겟 위쪽으로 배치하여 하이라이트를 가리지 않도록
        // 설정버튼, 저장버튼, 완료/공유/기록 버튼의 경우 더 높게 배치
        const isSettingsOrActionButton = steps[currentStep].targetSelector.includes('settings-icon') || 
                                         steps[currentStep].targetSelector.includes('save-button') ||
                                         steps[currentStep].targetSelector.includes('recipe-favorite-button') ||
                                         steps[currentStep].targetSelector.includes('recipe-done-button') ||
                                         steps[currentStep].targetSelector.includes('recipe-share-button') ||
                                         steps[currentStep].targetSelector.includes('recipe-write-button');
        // 저장 버튼은 바로 위에 붙도록 offset을 작게 설정
        const extraOffset = steps[currentStep].targetSelector.includes('save-button') ? 10 : 
                           (isSettingsOrActionButton ? 60 : 20);
        top = targetRect.top - tooltipHeight - spacing - extraOffset;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        // 화면 왼쪽 경계 체크
        if (left < 16) {
          left = 16;
        }
        // 화면 위쪽 경계 체크 - 위로 올릴 수 없으면 아래로
        if (top < 16) {
          top = targetRect.bottom + spacing;
        }
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + spacing;
        break;
    }

    // 화면 경계 체크
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }
    if (top < 16) top = 16;
    if (top + tooltipHeight > window.innerHeight - 16) {
      top = window.innerHeight - tooltipHeight - 16;
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 'var(--z-modal)', // 하이라이트(10001)보다 위에 표시
    };
  };

  // 하이라이트 영역 스타일
  const getHighlightStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { display: 'none' };
    }

      const style = {
      position: 'fixed' as const,
      top: `${targetRect.top}px`,
      left: `${targetRect.left}px`,
      width: `${Math.max(targetRect.width, 24)}px`, // 최소 너비 보장
      height: `${Math.max(targetRect.height, 24)}px`, // 최소 높이 보장
      zIndex: 'var(--z-modal)', // 배경 오버레이(9998) 위에, 툴팁(10002) 아래
      border: '3px solid #FFD600',
      borderRadius: '8px',
      pointerEvents: 'none' as const,
      backgroundColor: 'transparent',
    };

    return style;
  };

  return (
    <>
      {/* 배경 오버레이 - 하이라이트와 모달 영역 제외 */}
      <div
        ref={overlayRef}
        className="fixed inset-0"
        style={{
          zIndex: 'var(--z-overlay)',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
        onClick={onClose}
      />

      {/* 하이라이트 영역 - 배경 오버레이 위에 표시 */}
      {targetRect && (
        <div style={getHighlightStyle()}>
          {/* 더 잘 보이도록 반투명 배경 추가 */}
          <div style={{
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            right: '-2px',
            bottom: '-2px',
            backgroundColor: 'rgba(255, 214, 0, 0.6)',
            borderRadius: '10px',
            border: '2px solid #FFD600',
          }} />
        </div>
      )}

      {/* 툴팁 - 배경 오버레이 위에 표시 */}
      <div
        style={getTooltipStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-white rounded-lg shadow-lg p-3"
          style={{
            width: step.targetSelector.includes('settings-icon') || step.targetSelector.includes('storage-areas') ? '340px' : '320px',
            fontSize: '15px',
            lineHeight: '1.5',
            color: '#3A3A42',
            maxWidth: 'calc(100vw - 32px)', // 화면 너비를 넘지 않도록
          }}
        >
          <div className="mb-1.5" style={{ textAlign: 'left', wordBreak: 'keep-all' }}>
            {typeof step.message === 'string' ? (
              <div style={{ whiteSpace: step.targetSelector.includes('save-button') ? 'nowrap' : 'pre-line' }}>{step.message}</div>
            ) : (
              step.message
            )}
          </div>
          {/* 진행 상황 표시 */}
          <div className="mb-2 text-right" style={{ fontSize: '13px', color: '#6A6A73' }}>
            ({currentStep + startStepOffset + 1}/{totalSteps || steps.length})
          </div>
          <div
            className="flex flex-row items-center justify-between gap-2 w-full"
            style={{ flexWrap: 'wrap', rowGap: 8 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
              style={{ outline: 'none', cursor: 'pointer', alignSelf: 'center' }}
            >
              설명 건너뛰기
            </button>
            <div className="flex items-center gap-2 shrink-0">
              {currentStep > 0 && onPrevious ? (
                <button
                  type="button"
                  onClick={onPrevious}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
                  style={{ outline: 'none', cursor: 'pointer' }}
                >
                  이전
                </button>
              ) : null}
              <button
                type="button"
                onClick={onNext}
                className="px-4 py-1.5 bg-[#FFD600] text-[#1A1A1E] rounded-lg text-sm font-medium hover:bg-yellow-300 transition"
                style={{ outline: 'none', border: 'none', cursor: 'pointer' }}
              >
                {currentStep < steps.length - 1
                  ? '다음'
                  : isLastStepConfirm
                    ? '확인'
                    : '다음'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

