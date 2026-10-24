import * as React from 'react';
import { useUsage } from './UsageMeter';

/**
 * 어드민이 크레딧을 **추가로 준 것**을 앱을 켰을 때 한 번 알린다.
 *
 * 유료 전환은 `PlanUpgradeToast` 가 알린다. 그런데 플랜은 그대로 두고 크레딧만 더 준 경우에는
 * 알림이 전혀 없어서, 받은 사람이 잔액이 늘어난 줄 모르고 지나쳤다.
 *
 * 서버가 최근 2주 안의 마지막 어드민 지급(`admin_grant`: id·양)을 내려 주고, 이 기기에서 그 id 를 이미
 * 보여 줬는지만 localStorage 로 기억한다(`PlanUpgradeToast` 와 같은 이유로 서버에 읽음 표를 두지 않는다).
 */

const SEEN = 'cookmatch_grant_seen';

const CreditGrantToast: React.FC = () => {
  const usage = useUsage();
  const [show, setShow] = React.useState(false);
  const grant = usage?.admin_grant || null;

  React.useEffect(() => {
    if (!grant) return;
    let seen = '';
    try {
      seen = localStorage.getItem(SEEN) || '';
    } catch {
      return;   // 저장이 막혀 있으면 매번 뜨는 것보다 안 띄우는 편이 낫다
    }
    if (seen === String(grant.id)) return;
    try {
      localStorage.setItem(SEEN, String(grant.id));
    } catch {
      return;
    }
    // 유료 전환 토스트와 같이 뜨는 날이면 그것이 끝난 뒤에 보여 준다.
    let wait = 0;
    try {
      const at = Number(sessionStorage.getItem('cookmatch_plan_toast_at') || 0);
      if (at && Date.now() - at < 7000) wait = 6500;
    } catch { /* 없어도 된다 */ }
    let hide: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      setShow(true);
      hide = setTimeout(() => setShow(false), 6000);
    }, wait);
    return () => {
      clearTimeout(t);
      if (hide) clearTimeout(hide);
    };
  }, [grant?.id]);

  if (!show || !grant) return null;

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
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.6 }}>
        <b style={{ color: '#FFD600' }}>{grant.amount}크레딧</b>이 추가 지급됐어요.
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

export default CreditGrantToast;
