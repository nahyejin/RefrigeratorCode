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
 * 스크롤을 움직이지 않을 때도, 화면에 보이는 구간 + 탭 위까지만 하이라이트.
 * 긴 요소는 뷰포트와 교차하는 세로 구간만 노란 박스로 잘림.
 */
function clipGuideHighlightRect(rect: DOMRect): DOMRect {
  const maxBottom = window.innerHeight - BOTTOM_TAB_RESERVE_PX;
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, maxBottom);
  const height = Math.max(0, bottom - top);
  return new DOMRect(rect.left, top, rect.width, height);
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

  useEffect(() => {
    if (!visible || currentStep >= steps.length) return;

    const updateTargetPosition = () => {
      let target: Element | null = null;
      
      if (steps[currentStep].targetSelector.includes('settings-icon')) {
        // data-guide-target 속성이 있는 설정 아이콘 찾기 (냉장보관 첫 번째 재료)
        target = document.querySelector('[data-guide-target="settings-icon"]');
        console.log('[GuideOverlay] data-guide-target으로 찾은 타겟:', target);
        
        // 위 방법이 실패하면 title="설정"인 요소 찾기
        if (!target) {
          const allSettings = document.querySelectorAll('[title="설정"]');
          console.log('[GuideOverlay] title="설정"인 요소 개수:', allSettings.length);
          
          if (allSettings.length > 0) {
            // 냉장보관 섹션 찾기 - 더 정확한 방법
            const allDivs = Array.from(document.querySelectorAll('div'));
            const fridgeSection = allDivs.find(div => {
              const text = div.textContent || '';
              return text.includes('냉장보관') && (text.includes('❄️') || text.includes('❄'));
            });
            
            console.log('[GuideOverlay] 냉장보관 섹션 찾음:', fridgeSection);
            
            if (fridgeSection) {
              // 냉장보관 섹션의 부모나 형제 요소에서 설정 아이콘 찾기
              let searchContainer: Element | null = fridgeSection.parentElement;
              let depth = 0;
              while (searchContainer && depth < 5) {
                const settingsInContainer = searchContainer.querySelectorAll('[title="설정"]');
                if (settingsInContainer.length > 0) {
                  target = settingsInContainer[0];
                  console.log('[GuideOverlay] 냉장보관 섹션 내에서 찾은 타겟:', target);
                  break;
                }
                searchContainer = searchContainer.parentElement;
                depth++;
              }
            }
            
            // 여전히 못 찾으면 첫 번째 설정 아이콘 사용
            if (!target && allSettings.length > 0) {
              target = allSettings[0];
              console.log('[GuideOverlay] 첫 번째 설정 아이콘 사용:', target);
            }
          }
        }
      } else {
        target = document.querySelector(steps[currentStep].targetSelector);
      }
      
      if (target) {
        const applyRect = () => {
          const rect = clipGuideHighlightRect(target!.getBoundingClientRect());
          console.log('[GuideOverlay] 타겟 위치:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            element: target
          });
          setTargetRect(rect);
        };
        applyRect();
      } else {
        console.warn('[GuideOverlay] 타겟 요소를 찾을 수 없습니다:', steps[currentStep].targetSelector);
        console.log('[GuideOverlay] 현재 페이지의 모든 [title="설정"] 요소:', document.querySelectorAll('[title="설정"]'));
        console.log('[GuideOverlay] 현재 페이지의 모든 [data-guide-target] 요소:', document.querySelectorAll('[data-guide-target]'));
      }
    };

    updateTargetPosition();
    window.addEventListener('scroll', updateTargetPosition);
    window.addEventListener('resize', updateTargetPosition);

    // 약간의 지연 후 위치 업데이트 (렌더링 완료 대기)
    // 여러 번 시도하여 요소가 렌더링될 때까지 기다림
    const timer1 = setTimeout(updateTargetPosition, 100);
    const timer2 = setTimeout(updateTargetPosition, 300);
    const timer3 = setTimeout(updateTargetPosition, 500);

    return () => {
      window.removeEventListener('scroll', updateTargetPosition);
      window.removeEventListener('resize', updateTargetPosition);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
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
      console.log('[GuideOverlay] targetRect이 null입니다');
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
    
    console.log('[GuideOverlay] 하이라이트 스타일:', style);
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

