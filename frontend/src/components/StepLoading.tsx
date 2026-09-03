import React from 'react';

/**
 * 기다리는 동안 **무슨 일이 일어나는 중인지** 보여 주는 화면.
 *
 * 사진 인식에서 먼저 쓰던 것을 공용으로 뺐다. 같은 앱 안에서 기다림은 항상 같은
 * 모양이어야 하고, 두 벌로 두면 한쪽만 고쳐져 서로 달라진다.
 *
 * 세 가지를 같이 쓴다:
 *   - 훑는 애니메이션 — 지금 뭔가 읽고 있다는 신호
 *   - 바뀌는 단계 문구 — 시간이 흘러도 **진행되고 있다**는 감각
 *   - 결과와 같은 모양의 스켈레톤 — 곧 무엇이 나올지 미리 알려 주고,
 *     실제 결과로 바뀔 때 화면이 덜 튄다
 *
 * 가짜 진행바는 쓰지 않는다. 남은 시간을 모르면서 아는 척하면, 90%에서 멈춰
 * 있는 순간 오히려 더 고장 난 것처럼 보인다. 단계 문구는 **경과 시간** 기준이다.
 */

export interface StepLoadingProps {
  /** 시간이 지나며 바뀔 문구들. 마지막까지 가면 `lastText` 로 넘어간다. */
  steps: string[];
  /** 단계가 넘어가는 시각(ms). `steps` 와 같은 길이여야 자연스럽다. */
  timings?: number[];
  /** 모든 단계를 지난 뒤 보여 줄 문구 */
  lastText?: string;
  /** 문구 아래 한 줄 안내 (보통 얼마나 걸리는지) */
  note?: React.ReactNode;
  /** 모든 단계를 지난 뒤의 안내 */
  lastNote?: React.ReactNode;
  /** 아래에 깔 스켈레톤 줄 수 */
  rows?: number;
}

const StepLoading: React.FC<StepLoadingProps> = ({
  steps,
  timings = [1200, 4500, 8500, 14000],
  lastText = '거의 다 됐어요',
  note,
  lastNote,
  rows = 3,
}) => {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    const timers = timings.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = step >= steps.length;

  return (
    <div style={{ padding: '20px 0 8px' }} role="status" aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
        <div className="scan-frame" aria-hidden>
          <i style={{ top: 22, width: 52 }} />
          <i style={{ top: 38, width: 38 }} />
          <i style={{ top: 54, width: 58 }} />
          <i style={{ top: 70, width: 30 }} />
          <i style={{ top: 86, width: 46 }} />
          <span className="scan-line" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E', lineHeight: 1.45 }}>
            {done ? lastText : steps[step]}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 6, lineHeight: 1.6 }}>
            {done ? (lastNote ?? note) : note}
          </div>
        </div>
      </div>

      {/* 곧 나올 결과와 같은 모양. 무엇이 나올지 미리 알려 주고, 실제 값으로
          바뀔 때 높이가 크게 안 튄다. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="skeleton-block" style={{ width: 18, height: 18, borderRadius: 5 }} />
            <div className="skeleton-block"
                 style={{ width: [92, 68, 104, 80, 96][i % 5], height: 13, borderRadius: 6 }} />
            <div className="skeleton-block"
                 style={{ width: [56, 72, 48, 64, 52][i % 5], height: 13, borderRadius: 6 }} />
            <div className="skeleton-block"
                 style={{ flex: 1, minWidth: 30, height: 13, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepLoading;
