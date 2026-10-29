import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Dialog from './ui/Dialog';
import {
  GATE_EVENT, GateDetail, GateKind, gateCopy, isGuestNow, markReturnGateShown, shouldShowReturnGate, trackGate,
} from '../utils/loginGate';

/**
 * 비회원 로그인 확인창 — 앱에 **하나만** 둔다(2026-10-22).
 *
 * 한도(재료·즐겨찾기·기록·완료 3개), AI 체험 소진, 두 번째 방문 — 모두 같은 규격의 확인창이다.
 * 화면마다 따로 만들면 문구·버튼·닫는 법이 또 제각각이 되므로, 어느 화면에서든 `openLoginGate(kind)` 로
 * 이벤트만 쏘고 여기서 그린다(UsedUpHost 와 같은 방식).
 *
 * 두 번째 방문은 앱을 켜자마자가 아니라 **다시 열고 한 화면 둘러본 뒤**, 다른 화면으로 처음 옮겨 가는
 * 순간에 한 번 띄운다(켜자마자 뜨면 무슨 냉장고인지 헷갈린다는 지적).
 */
const SKIP_PATHS = ['/login', '/signup', '/auth', '/admin', '/find-email', '/reset-password', '/join-household', '/legal', '/account-deletion'];

const LoginGateHost: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [gate, setGate] = React.useState<GateDetail | null>(null);
  const firstPath = React.useRef(location.pathname);

  React.useEffect(() => {
    const onGate = (e: Event) => {
      const detail = (e as CustomEvent<GateDetail>).detail;
      if (!detail || !isGuestNow()) return;
      setGate(detail);
      trackGate('cta_view', detail.kind);
    };
    window.addEventListener(GATE_EVENT, onGate);
    return () => window.removeEventListener(GATE_EVENT, onGate);
  }, []);

  // 두 번째 방문: 처음 화면에서 다른 화면으로 옮겨 가는 순간 1번
  React.useEffect(() => {
    if (location.pathname === firstPath.current) return;
    if (SKIP_PATHS.some(p => location.pathname.startsWith(p))) return;
    if (!shouldShowReturnGate()) return;
    markReturnGateShown();
    const timer = window.setTimeout(() => {
      setGate({ kind: 'return' });
      trackGate('cta_view', 'return');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  if (!gate) return null;
  const kind: GateKind = gate.kind;
  const copy = gateCopy(kind, gate.credits);

  const dismiss = () => {
    trackGate('cta_dismiss', kind);
    setGate(null);
  };
  const login = () => {
    trackGate('cta_click', kind);
    setGate(null);
    navigate('/login');
  };

  return (
    <Dialog
      open
      nested
      onClose={dismiss}
      title={copy.title}
      actions={[
        { label: copy.dismiss, onClick: dismiss, variant: 'outline' },
        { label: kind === 'save' ? '3초 만에 저장하기' : '로그인하기', onClick: login, variant: 'primary' },
      ]}
    >
      <div style={{ fontSize: 14 }}>
        {copy.lines.map(line => <div key={line}>{line}</div>)}
        {copy.warn && <div style={{ marginTop: 10, fontWeight: 700, color: 'var(--ink-900)' }}>{copy.warn}</div>}
      </div>
    </Dialog>
  );
};

export default LoginGateHost;
