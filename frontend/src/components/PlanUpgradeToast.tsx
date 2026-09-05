import * as React from 'react';
import { useUsage } from './UsageMeter';

/**
 * 유료로 바뀐 것을 **한 번** 알린다.
 *
 * 왜 필요한가:
 *   승급은 어드민이 한다. 사용자는 요청을 보내 놓고 기다리는데, 지금까지는
 *   아무 알림이 없어서 마이페이지를 다시 열어야 PLUS 배지를 봤다. 기다리는
 *   사람에게 "됐다" 를 말해 주지 않으면, 그 사람은 안 된 줄 안다.
 *
 * 왜 기기에 기억하나:
 *   "봤다" 는 이 기기의 사정이다. 서버에 두면 읽음 표시를 위해 표가 하나
 *   더 생기는데, 그만한 일이 아니다. 다른 기기에서 한 번 더 뜨는 것은
 *   문제가 아니다 — 좋은 소식이라 두 번 봐도 나쁘지 않다.
 */

const SEEN = 'cookmatch_plan_seen';

const PlanUpgradeToast: React.FC = () => {
  const usage = useUsage();
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (!usage || !usage.is_paid) return;
    // 기간이 바뀌면 다시 알린다(연장도 알 만한 일이다).
    const mark = `plus:${usage.plan_until || 'forever'}`;
    let seen = '';
    try {
      seen = localStorage.getItem(SEEN) || '';
    } catch {
      return;   // 저장이 막혀 있으면 매번 뜨는 것보다 안 띄우는 편이 낫다
    }
    if (seen === mark) return;
    try {
      localStorage.setItem(SEEN, mark);
    } catch {
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, [usage?.is_paid, usage?.plan_until]);

  if (!show || !usage) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 14, right: 14, bottom: 84,
        zIndex: 'var(--z-toast)' as any,
        maxWidth: 452, margin: '0 auto',
        background: '#1A1A1E', color: '#FFFFFF',
        borderRadius: 14, padding: '14px 16px',
        boxShadow: '0 10px 30px rgba(0,0,0,.28)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}
    >
      <span aria-hidden style={{
        flexShrink: 0, padding: '2px 7px', borderRadius: 9999,
        background: '#FFD600', color: '#1A1A1E',
        fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', marginTop: 1,
      }}>PLUS</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.6 }}>
        <b>유료 계정이 됐어요.</b>
        <br />
        매주 <b style={{ color: '#FFD600' }}>{usage.weekly_credits} 크레딧</b>을 받아요
        {usage.plan_until && <> · {usage.plan_until} 까지</>}.
      </span>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="닫기"
        style={{
          flexShrink: 0, border: 'none', background: 'transparent',
          color: 'rgba(255,255,255,.6)', fontSize: 16, cursor: 'pointer', padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
};

export default PlanUpgradeToast;
