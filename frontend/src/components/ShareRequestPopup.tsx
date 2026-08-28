import * as React from 'react';
import Dialog from './ui/Dialog';
import { useAuth } from '../context/AuthContext';

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

interface PendingRequest {
  id: number;
  requester_id: number;
  requester_nickname: string;
}

/**
 * 다른 그룹원이 보낸 "즐겨찾기·완료·기록 공유해 달라" 요청 팝업.
 *
 * 전에는 이 확인을 마이페이지 안에서만 했다 — 그래서 "마이페이지에 들어가야만"
 * 뜨고, 다른 탭(냉장고요리, 요리 캘린더 등)에 있는 동안은 요청이 와 있어도
 * 전혀 몰랐다. 앱을 다시 열었을 때 지금 어느 탭에 있든 뜨도록 AppRouter에
 * 전역으로 하나만 마운트한다(마이페이지 전용이 아님).
 *
 * 확인 시점: (1) 로그인 상태가 잡히는 순간, (2) 앱이 다시 화면에 보이게 될 때
 * (visibilitychange) — "앱에 다시 들어오는 순간" 이라는 요구를 이 두 시점으로
 * 커버한다. 계속 켜져 있는 동안 실시간으로 폴링하지는 않는다(그 정도까지는
 * 필요 없음 — 서버 푸시가 아니라 "다음에 들어왔을 때 물어보는" 정도로 범위를
 * 좁힌 기능이라 그렇다).
 */
const ShareRequestPopup: React.FC = () => {
  const { isLoggedIn, user: authUser } = useAuth();
  const [pendingRequests, setPendingRequests] = React.useState<PendingRequest[]>([]);
  const [respondingId, setRespondingId] = React.useState<number | null>(null);

  const checkPending = React.useCallback(async () => {
    if (!isLoggedIn || !authUser?.id) return;
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`${getApiUrl()}/api/households/share-requests/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.requests || []);
      }
    } catch (error) {
      console.warn('[ShareRequestPopup] 공유 요청 조회 실패:', error);
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

  const respond = async (requestId: number, accept: boolean) => {
    setRespondingId(requestId);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      await fetch(`${getApiUrl()}/api/households/share-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accept }),
      });
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (accept) {
        // 지금 이 순간 마이페이지의 "그룹 설정" 카드가 이미 화면에 떠 있을 수
        // 있는데, 그 카드는 자기 마운트 시점에만 서버 값을 불러오지 이 팝업의
        // 응답 결과를 알 방법이 없다. 이벤트로 알려서 그 자리에서 바로 최신
        // 상태(공유 중)로 보이게 한다 — 전에는 이 알림이 없어서 수락해도 화면엔
        // 계속 "비공개"로 보이고, 실제로 반영됐는지 확인하려면 마이페이지를
        // 다시 열거나(재마운트) 직접 [켜기]를 한 번 더 눌러야 하는 것처럼
        // 보였다(서버 값 자체는 이미 바뀌어 있었음).
        window.dispatchEvent(new CustomEvent('household-share-updated'));
      }
    } catch (error) {
      console.warn('[ShareRequestPopup] 공유 요청 응답 실패:', error);
    } finally {
      setRespondingId(null);
    }
  };

  if (!pendingRequests.length) return null;

  const current = pendingRequests[0];

  return (
    <Dialog
      open
      onClose={() => {}}
      showClose={false}
      closeOnBackdrop={false}
      title={`${current.requester_nickname}님의 요청`}
      actions={[
        { label: '거절', variant: 'outline', onClick: () => respond(current.id, false) },
        { label: '수락', variant: 'primary', onClick: () => respond(current.id, true) },
      ]}
    >
      {respondingId === current.id
        ? '처리 중...'
        : `${current.requester_nickname}님이 내 즐겨찾기·완료·기록을 그룹에 공유해 달라고 요청했어요. 수락하면 그룹원들이 내가 즐겨찾기·완료·기록한 레시피를 볼 수 있어요.`}
    </Dialog>
  );
};

export default ShareRequestPopup;
