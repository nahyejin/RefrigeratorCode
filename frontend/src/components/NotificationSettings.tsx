import React from 'react';
import { pushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../utils/push';

/**
 * 유통기한 임박 알림을 **마이페이지에 정착시킨다.**
 *
 * 왜 옮겼나:
 *   예전엔 "알림 받기" 버튼이 `ExpiryAlert`(냉장고요리 상단의 임박 재료 카드)
 *   안에만 있었다. 그 카드는 임박한 재료가 있을 때만 뜨므로, 알림을 껐다 켰다
 *   하려면 매번 그 상황이 될 때까지 기다려야 했다 — "이게 여기 있는 게 맞나"
 *   라는 실사용 지적(2026-09-12). 설정은 **켜져 있든 꺼져 있든 아무 때나** 손볼
 *   수 있는 자리에 있어야 한다.
 *
 * 왜 브라우저 알림이 아니라 웹 푸시인가:
 *   브라우저 `Notification` API는 그 순간 앱이 열려 있어야만 뜬다. 진짜
 *   "껐다 켜도, 며칠 안 들어와도" 오는 알림은 서버가 보내는 푸시뿐이다
 *   (`utils/push.ts`, `scripts/send_expiry_push_notifications.py`).
 *
 * "우리 식구도 다 받게" 는 왜 토글 하나가 아닌가:
 *   식구 그룹은 냉장고를 공유하지만, 알림을 받을지는 **각자의 기기**가 정하는
 *   거라(브라우저 권한 자체가 기기 단위) 한 사람이 눌러서 남까지 켜 줄 수는
 *   없다. 대신 서버는 같은 냉장고를 보는 구독자 전원에게 보낸다 — 그래서
 *   각자 자기 폰에서 이 화면을 한 번씩 켜면 다 같이 받게 된다.
 */
const NotificationSettings: React.FC = () => {
  const [status, setStatus] = React.useState<'loading' | 'on' | 'off' | 'unsupported'>('loading');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pushSupported()) { setStatus('unsupported'); return; }
    isPushSubscribed().then(on => setStatus(on ? 'on' : 'off'));
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    if (status === 'on') {
      await unsubscribeFromPush();
      setStatus('off');
    } else {
      const result = await subscribeToPush();
      if (result.ok) {
        setStatus('on');
      } else if (result.reason === 'denied') {
        setError('브라우저 알림 권한이 꺼져 있어요. 기기 설정에서 이 앱의 알림을 허용해 주세요.');
      } else if (result.reason === 'login_required') {
        setError('로그인 후에 켤 수 있어요.');
      } else if (result.reason === 'unsupported') {
        setStatus('unsupported');
      } else {
        setError('지금은 켤 수 없어요. 잠시 후 다시 시도해 주세요.');
      }
    }
    setBusy(false);
  };

  if (status === 'unsupported') return null;

  const on = status === 'on';

  return (
    <section
      style={{
        border: '1px solid var(--line-200)', borderRadius: 14, padding: '14px 16px',
        background: 'var(--surface-sub)', display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {/* 스위치 자체(46x26)만 누르게 해 뒀더니, 그 작은 자리를 정확히
          맞춰 누르려다 손가락이 살짝 밀리면서 "드래그해야 눌린다"는
          실사용 지적이 있었다. 줄 전체를 하나의 버튼으로 만들어 어디를
          눌러도 토글되게 한다 — 설정 화면에서 흔한 패턴이다. */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={status === 'loading' || busy}
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          border: 'none', background: 'none', padding: 0, textAlign: 'left',
          cursor: busy || status === 'loading' ? 'default' : 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--ink-900)' }}>
            유통기한 임박 알림
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.5, wordBreak: 'keep-all' }}>
            내 냉장고 재료가 곧 상할 때 앱을 안 켜도 알려드려요.
          </span>
        </span>
        <span
          aria-hidden
          style={{
            flexShrink: 0, width: 46, height: 26, borderRadius: 9999,
            background: on ? '#FFD600' : 'var(--line-200)',
            position: 'relative', opacity: status === 'loading' ? 0.5 : 1,
          }}
        >
          <span
            style={{
              position: 'absolute', top: 3, left: on ? 23 : 3,
              width: 20, height: 20, borderRadius: '50%', background: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s',
            }}
          />
        </span>
      </button>
      {error && (
        <div style={{ fontSize: 12, color: '#B03A28', lineHeight: 1.5, wordBreak: 'keep-all' }}>
          {error}
        </div>
      )}
    </section>
  );
};

export default NotificationSettings;
