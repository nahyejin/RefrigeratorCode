import * as React from 'react';

/**
 * 화면 위에 **떠 있는** 로딩 표시.
 *
 * 왜 만들었나:
 *   냉장고요리 첫 요청은 실측 2.5~7초다. 그동안 목록 자리에 회색 상자와 점만
 *   있으니 **아무것도 변하지 않아** 멈춘 것처럼 보였다. 게다가 그 상자가
 *   목록 안에 끼어 있어서, 스크롤을 내리면 무엇을 기다리는지도 사라졌다.
 *
 *   사진 인식·AI 식단에서 쓰는 `StepLoading` 의 **훑는 애니메이션**을 그대로
 *   쓴다. 같은 앱 안에서 기다림은 같은 모양이어야 한다. 다만 여기서는 화면에
 *   끼우지 않고 **맨 위 레이어에 띄운다** — 어디를 보고 있든 눈에 남는다.
 *
 * 왜 가짜 진행바를 안 쓰나:
 *   남은 시간을 모르면서 아는 척하면 90%에서 멈춘 순간 더 고장 나 보인다.
 *   대신 **경과 시간에 따라 문구가 바뀌어** 진행되고 있다는 감각을 준다.
 *   (`StepLoading` 의 판단을 그대로 따른다)
 */
export interface FloatingScanLoaderProps {
  /** 시간이 지나며 바뀔 문구. 마지막까지 가면 `lastText` 로 넘어간다. */
  steps: string[];
  /** 단계가 넘어가는 시각(ms) */
  timings?: number[];
  lastText?: string;
  /** 문구 아래 한 줄 안내 */
  note?: React.ReactNode;
}

const FloatingScanLoader: React.FC<FloatingScanLoaderProps> = ({
  steps,
  timings = [1500, 4000, 8000, 13000],
  lastText = '거의 다 됐어요',
  note,
}) => {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    const timers = timings.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = step >= steps.length;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        // **맨 위 레이어에 떠 있는다.** 목록 안에 끼우면 스크롤에 밀려
        // 무엇을 기다리는지 사라진다.
        position: 'fixed',
        left: '50%',
        // **아래쪽에 띄운다.** 위에 두면 검색창·필터 줄을 가린다(실제로 그랬다).
        // 하단 탭(약 64px) 위로 띄우면 어떤 조작도 안 가리면서 계속 보인다.
        bottom: 84,
        transform: 'translateX(-50%)',
        zIndex: 900,
        width: 'min(340px, calc(100vw - 32px))',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--line-200)',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12)',
        animation: 'cm-float-in 260ms ease-out',
        pointerEvents: 'none',
      }}
    >
      {/* 사진 인식에서 쓰는 훑는 애니메이션 — 지금 뭔가 읽고 있다는 신호 */}
      <div className="scan-frame scan-frame--sm" aria-hidden>
        <i style={{ top: 14, width: 34 }} />
        <i style={{ top: 25, width: 24 }} />
        <i style={{ top: 36, width: 38 }} />
        <i style={{ top: 47, width: 20 }} />
        <i style={{ top: 58, width: 30 }} />
        <span className="scan-line" />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.45 }}>
          {done ? lastText : steps[step]}
        </div>
        {note && (
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 5, lineHeight: 1.6 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingScanLoader;
