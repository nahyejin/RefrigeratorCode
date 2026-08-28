import * as React from 'react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { useAuth } from '../context/AuthContext';

interface HouseholdMember {
  id: number;
  nickname: string;
}

interface HouseholdInfo {
  in_household: boolean;
  invite_code?: string;
  members?: HouseholdMember[];
}

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

function getToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

/**
 * 마이페이지에 들어가는 "가족 그룹" 관리 카드.
 *
 * 냉장고 재료는 계정 기준으로 저장되기 때문에, 가족이 각자 계정으로 접속해도
 * 재료를 같이 보려면 결국 하나의 저장 공간을 공유해야 한다. 이 컴포넌트는
 * 그 저장 공간(household)을 만들고, 초대 코드로 다른 계정을 그 공간에
 * 연결하고, 필요하면 다시 빠져나오는 화면을 담당한다. 실제 공유 로직(같은
 * user_ingredients 행을 읽고 쓰게 되는 것)은 백엔드 리다이렉션이 처리하므로,
 * 여기서는 "지금 그룹에 속해 있는지 + 누구랑 같이 있는지 + 초대 코드"만
 * 보여주면 된다.
 */
const HouseholdSection: React.FC = () => {
  const { isLoggedIn, user } = useAuth();
  const [info, setInfo] = React.useState<HouseholdInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [createInfoOpen, setCreateInfoOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');
  const [joinError, setJoinError] = React.useState('');
  const [mergeIngredients, setMergeIngredients] = React.useState(true);
  const [shareRecipeActions, setShareRecipeActions] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState('');

  const authedFetch = React.useCallback((path: string, options: RequestInit = {}) => {
    const token = getToken();
    return fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  }, []);

  const loadInfo = React.useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const res = await authedFetch('/api/households/me');
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch (e) {
      console.warn('[HouseholdSection] 그룹 정보 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, authedFetch]);

  React.useEffect(() => {
    loadInfo();
    // user?.nickname 을 의존성에 넣어서, 내 정보 수정에서 닉네임을 바꾸면
    // 페이지 이동 없이도 그룹 멤버 목록(닉네임 배지)이 바로 갱신되게 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInfo, user?.nickname]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(''), 2500);
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/households', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '그룹 생성에 실패했어요.');
        return;
      }
      setCreateInfoOpen(false);
      await loadInfo();
      showToast('그룹을 만들었어요. 초대 코드를 가족에게 알려주세요.');
    } catch (e) {
      showToast('그룹 생성 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setJoinError('초대 코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    setJoinError('');
    try {
      const res = await authedFetch('/api/households/join', {
        method: 'POST',
        body: JSON.stringify({
          invite_code: joinCode.trim(),
          merge_ingredients: mergeIngredients,
          share_recipe_actions: shareRecipeActions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || '그룹 참여에 실패했어요.');
        return;
      }
      setJoinOpen(false);
      setJoinCode('');
      await loadInfo();
      showToast(
        mergeIngredients
          ? '그룹에 참여했어요. 냉장고 재료가 하나로 합쳐졌어요.'
          : '그룹에 참여했어요. 그룹의 기존 재료를 보게 돼요.'
      );
    } catch (e) {
      setJoinError('그룹 참여 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  const handleShareInvite = async () => {
    if (!info?.invite_code) return;
    const url = `${window.location.origin}/join-household?code=${info.invite_code}`;
    const text = `쿡매치 가족 그룹에 초대할게요! 아래 링크를 눌러 참여해주세요.\n${url}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '쿡매치 가족 그룹 초대', text, url });
        return;
      } catch (e) {
        // 사용자가 공유를 취소한 경우 등 — 조용히 클립보드 복사로 대체
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('초대 링크를 복사했어요. 카카오톡 등에 붙여넣어 보내주세요.');
    } catch (e) {
      showToast(url);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/households/leave', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '그룹 나가기에 실패했어요.');
        return;
      }
      setLeaveOpen(false);
      await loadInfo();
      showToast('그룹에서 나갔어요.');
    } catch (e) {
      showToast('그룹 나가기 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/households/regenerate-code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '초대 코드 재발급에 실패했어요.');
        return;
      }
      await loadInfo();
      showToast('새 초대 코드를 발급했어요. 예전 코드는 더 이상 쓸 수 없어요.');
    } catch (e) {
      showToast('초대 코드 재발급 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async () => {
    if (!info?.invite_code) return;
    try {
      await navigator.clipboard.writeText(info.invite_code);
      showToast('초대 코드를 복사했어요.');
    } catch (e) {
      showToast(info.invite_code);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <div
      style={{
        border: '1px solid var(--line-200)',
        borderRadius: 16,
        padding: '16px 16px',
        marginBottom: 16,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>가족 그룹</span>
      </div>

      {loading && !info ? (
        <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '8px 0' }}>불러오는 중...</div>
      ) : info?.in_household ? (
        <div>
          <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 10 }}>
            같은 초대 코드로 들어온 가족과 냉장고 재료를 함께 관리하고 있어요.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'var(--surface-sub)',
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 2 }}>초대 코드</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: '#1A1A1E' }}>
                {info.invite_code}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                복사
              </Button>
              <Button variant="secondary" size="sm" onClick={handleShareInvite}>
                초대 보내기
              </Button>
            </div>
          </div>

          {!!info.members?.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {info.members.map((m) => (
                <span
                  key={m.id}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ink-700)',
                    background: 'var(--surface-sub)',
                    border: '1px solid var(--line-200)',
                    borderRadius: 9999,
                    padding: '4px 10px',
                  }}
                >
                  {m.nickname}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={busy}>
              코드 재발급
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)} disabled={busy}>
              그룹 나가기
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12 }}>
            그룹을 만들거나 초대 코드로 참여하면, 가족이 각자 계정으로 접속해도
            같은 냉장고 재료를 함께 관리할 수 있어요. 즐겨찾기·완료·기록한
            레시피도 원하면 "OO님도 즐겨찾기함" 처럼 서로 볼 수 있어요.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => setCreateInfoOpen(true)} disabled={busy}>
              그룹 만들기
            </Button>
            <Button variant="outline" size="sm" onClick={() => setJoinOpen(true)} disabled={busy}>
              초대 코드로 참여하기
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={createInfoOpen}
        onClose={() => setCreateInfoOpen(false)}
        title="가족 그룹 만들기"
        actions={[
          { label: '취소', onClick: () => setCreateInfoOpen(false), variant: 'outline' },
          { label: '만들기', onClick: handleCreate, variant: 'primary' },
        ]}
      >
        <div style={{ textAlign: 'left', fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 8 }}>
            지금 누르면 우리 가족만의 <b>초대 코드</b>가 바로 만들어져요.
          </p>
          <p style={{ marginBottom: 8 }}>
            그 코드를 가족에게 카카오톡이나 문자로 보내주면(초대 코드 생성 후
            "초대 보내기" 버튼으로 바로 공유할 수 있어요), 가족이 링크를 눌러
            들어오거나 코드를 직접 입력해서 참여할 수 있어요.
          </p>
          <p>
            참여한 가족과는 냉장고 재료를 함께 보고 관리하게 돼요. 즐겨찾기·완료·
            기록은 계정별로 그대로 남고, 그룹 화면에서 배지로만 표시돼요.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={joinOpen}
        onClose={() => {
          setJoinOpen(false);
          setJoinError('');
          setJoinCode('');
        }}
        title="초대 코드로 참여하기"
        actions={[
          { label: '취소', onClick: () => setJoinOpen(false), variant: 'outline' },
          { label: '참여하기', onClick: handleJoin, variant: 'primary' },
        ]}
      >
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 10, textAlign: 'center' }}>
            가족에게 받은 8자리 초대 코드를 입력해주세요.
          </p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="예: AB12CD34"
            maxLength={12}
            style={{
              width: '100%',
              height: 44,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid var(--line-300)',
              fontSize: 16,
              letterSpacing: 2,
              textAlign: 'center',
              boxSizing: 'border-box',
              marginBottom: 14,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink-700)' }}>
              <input
                type="checkbox"
                checked={mergeIngredients}
                onChange={(e) => setMergeIngredients(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                지금 내 냉장고 재료를 그룹 재료에 합치기
                <br />
                <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>
                  꺼두면 내 재료는 삭제되지 않고 그대로 보존돼요(그룹에는 안 보임).
                  나중에 그룹을 나가면 그 재료를 그대로 돌려받아요. 켜두면 지금
                  재료가 그룹 재료에 합쳐지고, 나갈 때는 그 시점 그룹 재료를
                  대신 가져가게 돼요.
                </span>
              </span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink-700)' }}>
              <input
                type="checkbox"
                checked={shareRecipeActions}
                onChange={(e) => setShareRecipeActions(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                내 즐겨찾기·완료·기록을 그룹원에게도 보여주기
                <br />
                <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>
                  (기록 자체는 합쳐지지 않고 계정별로 그대로 유지돼요)
                </span>
              </span>
            </label>
          </div>
          {joinError && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 10, textAlign: 'center' }}>
              {joinError}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="그룹에서 나가시겠어요?"
        actions={[
          { label: '취소', onClick: () => setLeaveOpen(false), variant: 'outline' },
          { label: '나가기', onClick: handleLeave, variant: 'danger' },
        ]}
      >
        지금 그룹 냉장고에 있는 재료는 그대로 복사돼서
        <br />
        내 개인 냉장고로 옮겨져요. 그룹에는 그대로 남고요.
        <br />
        즐겨찾기·완료·기록은 원래 계정별 기록이라 바뀌지 않아요.
        <br />
        다시 함께 쓰려면 초대 코드가 다시 필요해요.
      </Dialog>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 90,
            transform: 'translateX(-50%)',
            background: '#1A1A1E',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 16px',
            borderRadius: 9999,
            zIndex: 'var(--z-modal)' as unknown as number,
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
};

export default HouseholdSection;
