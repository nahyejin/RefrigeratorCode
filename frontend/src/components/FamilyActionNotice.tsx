import * as React from 'react';
import Dialog from './ui/Dialog';
import { useAuth } from '../context/AuthContext';

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

interface FamilyNotification {
  id: number;
  actor_user_id: number;
  actor_nickname: string;
  action_type: 'add' | 'delete';
  entity_type: 'completed_recipe' | 'manual_log' | 'meal_plan';
  title: string;
  created_at: string;
}

/**
 * 가족이 나 대신 완료·수동 기록을 추가/삭제했을 때 뜨는 팝업.
 *
 * "내 것을 식구가 건드렸을 때는 당사자에게 알림이 가서 복구할지 물어봐야
 * 한다"는 요청(2026-09-14) — 실시간 푸시가 아니라 **다음에 앱을 열었을 때**
 * 확인하는 방식으로 범위를 좁혔다(ShareRequestPopup과 같은 패턴). 진짜 웹
 * 푸시로 보내려면 브라우저 알림 권한이 필요해 매번 못 뜬다.
 */
const FamilyActionNotice: React.FC = () => {
  const { isLoggedIn, user: authUser } = useAuth();
  const [pending, setPending] = React.useState<FamilyNotification[]>([]);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const checkPending = React.useCallback(async () => {
    if (!isLoggedIn || !authUser?.id) return;
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`${getApiUrl()}/api/users/${authUser.id}/family-notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPending(data.notifications || []);
      }
    } catch (error) {
      console.warn('[FamilyActionNotice] 알림 조회 실패:', error);
    }
  }, [isLoggedIn, authUser?.id]);

  React.useEffect(() => {
    checkPending();
  }, [checkPending]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkPending();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [checkPending]);

  const respond = async (notifId: number, undo: boolean) => {
    if (!authUser?.id) return;
    setBusyId(notifId);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      await fetch(
        `${getApiUrl()}/api/users/${authUser.id}/family-notifications/${notifId}/${undo ? 'undo' : 'dismiss'}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      setPending(prev => prev.filter(n => n.id !== notifId));
      if (undo) {
        // 요리 캘린더가 이미 떠 있으면 그 자리에서 바로 반영되게.
        window.dispatchEvent(new CustomEvent('family-action-undone'));
      }
    } catch (error) {
      console.warn('[FamilyActionNotice] 처리 실패:', error);
    } finally {
      setBusyId(null);
    }
  };

  if (!pending.length) return null;

  const current = pending[0];
  const isAdd = current.action_type === 'add';
  const isBusy = busyId === current.id;
  // 무엇을 대신 처리한 것인지에 따라 문구가 달라진다 — "완료 기록"과
  // "요리 계획"·"직접 기록"은 다른 말이라 뭉뚱그리면 헷갈린다(2026-09-14,
  // 요리 계획도 그룹원끼리 대신 추가/삭제할 수 있게 되며 추가된 경우).
  const entityLabel = current.entity_type === 'meal_plan' ? '요리 계획'
    : current.entity_type === 'manual_log' ? '기록'
    : '완료 기록';

  return (
    <Dialog
      open
      onClose={() => {}}
      showClose={false}
      closeOnBackdrop={false}
      title="식구가 내 기록을 바꿨어요"
      dismissLabel="확인"
      actions={[
        { label: '확인', variant: 'outline', onClick: () => respond(current.id, false) },
        { label: isBusy ? '처리 중' : (isAdd ? '취소하기' : '복구하기'), variant: 'primary', onClick: () => respond(current.id, true) },
      ]}
    >
      <span style={{ wordBreak: 'keep-all' }}>
        <b>{current.actor_nickname}</b>님이{' '}
        <b>{current.title}</b>
        {isAdd ? `을(를) ${entityLabel}에 추가했어요.` : `의 ${entityLabel}을(를) 지웠어요.`}
        <br />
        {isAdd ? '내가 한 게 아니면 취소할 수 있어요.' : '실수였다면 복구할 수 있어요.'}
      </span>
    </Dialog>
  );
};

export default FamilyActionNotice;
