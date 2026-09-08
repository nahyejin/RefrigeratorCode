import * as React from 'react';

/**
 * 냉장고요리를 기다리는 동안 화면 가운데에 **떠 있는** 표시.
 *
 * ── 왜 AI 쪽과 다른 그림인가 ────────────────────────────────────────
 *
 * 사진 인식·AI 식단은 `scan-frame`(문서 위를 노란 선이 훑는 그림)을 쓴다.
 * 그건 **"지금 AI 를 쓰는 중이고 크레딧이 나간다"** 는 신호다. 여기는 AI 가
 * 아니라 서버가 매칭률을 세는 일이라, 같은 그림을 쓰면 **안 쓴 크레딧이
 * 나간다고 오해**하게 된다.
 *
 * 그래서 하는 일을 그대로 그린다 — **재료 칸이 하나씩 맞춰지는** 모양.
 * 칸이 순서대로 노랗게 차오르면 "지금 맞춰 보는 중" 이 그대로 읽힌다.
 *
 * ── 왜 가짜 진행바가 없나 ───────────────────────────────────────────
 *
 * 남은 시간을 모르면서 아는 척하면 90%에서 멈춘 순간 더 고장 나 보인다.
 * 대신 **경과 시간에 따라 문구가 바뀌어** 진행되고 있다는 감각을 준다.
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

/** 재료 칸 9개가 순서대로 차오른다. 칸마다 시작을 늦춰 물결처럼 보이게 한다. */
const MatchGrid = () => (
  <div className="cm-match-grid" aria-hidden>
    {Array.from({ length: 9 }, (_, i) => (
      <span key={i} style={{ animationDelay: `${i * 0.13}s` }} />
    ))}
  </div>
);

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
        // **화면 가운데에 띄운다.** 목록 안에 끼우면 스크롤에 밀려 무엇을
        // 기다리는지 사라지고, 위에 두면 검색창을, 아래에 두면 탭을 가린다.
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 900,
        width: 'min(320px, calc(100vw - 40px))',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '22px 20px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--line-200)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <MatchGrid />

      <div style={{ minWidth: 0, width: '100%' }}>
        {/* `wordBreak: keep-all` — 낱말 중간에서 끊기지 않게 한다.
            "레시피 4만여 개를 하나씩 맞춰 보는 중" 이 "맞춰 보는" 에서
            어색하게 갈리던 것을 막는다. */}
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: 'var(--ink-900)',
            lineHeight: 1.5,
            wordBreak: 'keep-all',
          }}
        >
          {done ? lastText : steps[step]}
        </div>
        {note && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-500)',
              marginTop: 8,
              lineHeight: 1.6,
              wordBreak: 'keep-all',
            }}
          >
            {note}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingScanLoader;
