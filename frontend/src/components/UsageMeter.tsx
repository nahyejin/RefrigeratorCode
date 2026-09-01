import React from 'react';
import {
  type Usage,
  getCachedUsage,
  isLow,
  refreshUsage,
  remainingRatio,
  resetLabel,
  subscribeUsage,
} from '../utils/usage';

/**
 * AI 사용량 표시.
 *
 * 자리마다 성격이 다르다 (USAGE_QUOTA_PLAN.md 5절).
 *  - `badge` : 아이콘 모서리. **부족할 때만** 나온다
 *  - `line`  : 시트·챗 패널 헤더. 기능을 열었을 때 한 줄
 *  - `gauge` : 마이페이지. 막대 + 리셋 시각 + 추가 요청
 *
 * 값은 전부 서버(`/api/usage`)에서 온다. 프론트에서 다시 계산하지 않는다 —
 * 두 곳에서 세면 반드시 어긋난다.
 */

/** 사용량을 구독한다. 화면 어디서 갱신되든 함께 바뀐다. */
export function useUsage(): Usage | null {
  const [usage, setUsage] = React.useState<Usage | null>(getCachedUsage());

  React.useEffect(() => {
    const unsubscribe = subscribeUsage(setUsage);
    if (!getCachedUsage()) void refreshUsage();
    return unsubscribe;
  }, []);

  return usage;
}

const YELLOW = '#FFD600';
const RED = '#D14343';

/** 남은 양에 따른 색. 빠듯할 때만 빨강으로 바뀐다. */
function toneOf(ratio: number): string {
  if (ratio <= 0.05) return RED;
  return YELLOW;
}

/**
 * 아이콘 모서리 배지.
 *
 * 평소에는 **아무것도 그리지 않는다.** 많이 남았을 때 숫자를 들이밀면
 * "아껴 써야 하나" 싶어 오히려 안 쓰게 된다. 20% 이하로 떨어질 때만 알린다.
 */
export const UsageBadge: React.FC = () => {
  const usage = useUsage();
  if (!isLow(usage) || !usage) return null;

  const left = Math.min(usage.weekly_remaining, usage.daily_remaining);
  return (
    <span
      aria-label={`남은 사용량 ${left}`}
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9999,
        background: left === 0 ? RED : '#1A1A1E',
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '18px',
        textAlign: 'center',
        pointerEvents: 'none',
        boxShadow: '0 0 0 2px var(--surface, #FFFFFF)',
      }}
    >
      {left}
    </span>
  );
};

/**
 * 시트·챗 패널 헤더 한 줄.
 *
 * 기능을 쓰려고 연 시점이 알려주기 가장 좋은 때다. 다 썼을 때는 막다른 길로
 * 끝내지 않고 언제 다시 채워지는지 말해 준다.
 */
export const UsageLine: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const usage = useUsage();
  if (!usage) return null;

  const out = usage.weekly_remaining <= 0 || usage.daily_remaining <= 0;
  const daily = usage.daily_remaining < usage.weekly_remaining;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        fontSize: 12,
        color: 'var(--ink-500)',
        ...style,
      }}
    >
      <span style={{ fontWeight: 600, color: out ? RED : 'var(--ink-700)' }}>
        이번 주 {usage.weekly_used} / {usage.weekly_limit}
      </span>
      {out ? (
        <span>· {daily ? '내일 다시 이어서 쓸 수 있어요' : `${resetLabel(usage)}에 채워져요`}</span>
      ) : (
        daily && <span>· 오늘은 {usage.daily_remaining}번 더</span>
      )}
      {usage.is_guest && <span>· 로그인하면 더 넉넉해요</span>}
    </div>
  );
};

/**
 * 마이페이지용 게이지.
 *
 * 여기가 "내 계정 상태"를 보는 자리다. 남은 양과 리셋 시각, 그리고 더 필요할 때
 * 무엇을 하면 되는지까지 한 덩어리로 보여준다.
 */
export const UsageGauge: React.FC<{ onRequestMore?: () => void }> = ({ onRequestMore }) => {
  const usage = useUsage();

  React.useEffect(() => {
    void refreshUsage();
  }, []);

  if (!usage) return null;

  const ratio = remainingRatio(usage);
  const pct = usage.weekly_limit > 0 ? (usage.weekly_used / usage.weekly_limit) * 100 : 0;
  const tone = toneOf(ratio);

  return (
    <div
      style={{
        border: '1px solid var(--line-200)',
        borderRadius: 14,
        padding: '16px 18px',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E' }}>AI 사용량</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
          <b style={{ color: '#1A1A1E', fontWeight: 700 }}>{usage.weekly_used}</b> / {usage.weekly_limit}
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={usage.weekly_used}
        aria-valuemin={0}
        aria-valuemax={usage.weekly_limit}
        style={{ height: 8, borderRadius: 9999, background: 'var(--line-200)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: '100%',
            background: tone,
            borderRadius: 9999,
            transition: 'width .3s ease',
          }}
        />
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.6 }}>
        사진으로 재료 담기와 요리 챗봇이 함께 쓰는 양이에요.
        <br />
        {resetLabel(usage)}에 다시 채워져요.
        {usage.daily_remaining < usage.weekly_remaining && ` 오늘은 ${usage.daily_remaining}번 더 쓸 수 있어요.`}
      </div>

      {usage.is_guest ? (
        <div style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 600 }}>
          로그인하면 훨씬 넉넉하게 쓸 수 있어요.
        </div>
      ) : (
        onRequestMore && (
          <button
            type="button"
            onClick={onRequestMore}
            style={{
              alignSelf: 'flex-start',
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--line-200)',
              background: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-700)',
              cursor: 'pointer',
            }}
          >
            더 필요해요
          </button>
        )
      )}
    </div>
  );
};

export default UsageGauge;
