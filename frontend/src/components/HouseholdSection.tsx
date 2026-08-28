import * as React from 'react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import Toggle from './ui/Toggle';
import { useAuth } from '../context/AuthContext';

interface HouseholdMember {
  id: number;
  nickname: string;
  share_recipe_actions: boolean;
}

interface HouseholdInfo {
  in_household: boolean;
  invite_code?: string;
  members?: HouseholdMember[];
  allow_ingredient_merge?: boolean;
  my_ingredients_merged?: boolean;
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
interface HouseholdSectionProps {
  /** 그룹 생성/참여/나가기가 성공했을 때 호출된다. 마이페이지가 그룹
   * 전체 즐겨찾기/기록/완료 목록을 다시 불러오는 데 쓴다. */
  onChange?: () => void;
}

const HouseholdSection: React.FC<HouseholdSectionProps> = ({ onChange }) => {
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
  const [createKeepIngredients, setCreateKeepIngredients] = React.useState(true);
  const [createShareRecipeActions, setCreateShareRecipeActions] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [statsFor, setStatsFor] = React.useState<HouseholdMember | null>(null);
  const [memberStats, setMemberStats] = React.useState<{ favorite: number; completed: number; recorded: number } | null>(null);
  const [requestSent, setRequestSent] = React.useState(false);

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
      const res = await authedFetch('/api/households', {
        method: 'POST',
        body: JSON.stringify({
          keep_ingredients: createKeepIngredients,
          share_recipe_actions: createShareRecipeActions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '그룹 생성에 실패했어요.');
        return;
      }
      setCreateInfoOpen(false);
      await loadInfo();
      onChange?.();
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
      onChange?.();
      if (data.merge_denied_by_policy) {
        showToast('그룹에 참여했어요. 이 그룹은 재료 합치기를 막아 둬서, 내 재료는 그대로 보존돼요.');
      } else {
        showToast(
          mergeIngredients
            ? '그룹에 참여했어요. 냉장고 재료가 하나로 합쳐졌어요.'
            : '그룹에 참여했어요. 그룹의 기존 재료를 보게 돼요.'
        );
      }
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
      onChange?.();
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

  const handleToggleMergePolicy = async (next: boolean) => {
    // 낙관적으로 먼저 반영 — 실패하면 loadInfo가 다시 불러와 되돌린다
    setInfo((prev) => (prev ? { ...prev, allow_ingredient_merge: next } : prev));
    try {
      const res = await authedFetch('/api/households/settings', {
        method: 'POST',
        body: JSON.stringify({ allow_ingredient_merge: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || '설정 변경에 실패했어요.');
        await loadInfo();
        return;
      }
      showToast(next ? '새 참여자의 재료 합치기를 허용했어요.' : '새 참여자의 재료 합치기를 막았어요.');
    } catch (e) {
      showToast('설정 변경 중 오류가 발생했어요.');
      await loadInfo();
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

  // 비공개(share_recipe_actions=false) 멤버를 누르면 그 사람의 활동 요약을
  // 보고, "공유 요청하기" 버튼으로 요청을 보낼 수 있다.
  const handleOpenMemberStats = async (member: HouseholdMember) => {
    setStatsFor(member);
    setMemberStats(null);
    setRequestSent(false);
    try {
      const res = await authedFetch(`/api/households/members/${member.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setMemberStats({ favorite: data.favorite, completed: data.completed, recorded: data.recorded });
      }
    } catch (e) {
      console.warn('[HouseholdSection] 멤버 통계 조회 실패:', e);
    }
  };

  const handleSendShareRequest = async () => {
    if (!statsFor) return;
    setBusy(true);
    try {
      const res = await authedFetch('/api/households/share-requests', {
        method: 'POST',
        body: JSON.stringify({ target_id: statsFor.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '요청 전송에 실패했어요.');
        return;
      }
      setRequestSent(true);
      showToast(`${statsFor.nickname}님에게 공유 요청을 보냈어요.`);
    } catch (e) {
      showToast('요청 전송 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {info.members.map((m) => {
                // 본인이거나 이미 공유 중인 사람은 요청할 게 없으니 그냥 표시만.
                // 비공개인 다른 멤버만 눌러서 공유를 요청할 수 있게 한다.
                const clickable = m.id !== Number(user?.id) && !m.share_recipe_actions;
                const Wrapper: any = clickable ? 'button' : 'div';
                return (
                  <Wrapper
                    key={m.id}
                    type={clickable ? 'button' : undefined}
                    onClick={clickable ? () => handleOpenMemberStats(m) : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: 'var(--surface-sub)',
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      cursor: clickable ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>{m.nickname}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: m.share_recipe_actions ? '#16A34A' : 'var(--ink-500)' }}>
                      즐겨찾기·완료·기록 {m.share_recipe_actions ? '공유 중' : '비공개'}
                      {clickable ? ' · 요청하기 >' : ''}
                    </span>
                  </Wrapper>
                );
              })}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <Toggle
              checked={info.allow_ingredient_merge !== false}
              onChange={handleToggleMergePolicy}
              label="새로 참여하는 사람의 재료 합치기 허용"
              hint="꺼두면 참여자의 기존 재료는 지워지지 않고 그대로 보존되고, 대신 우리 그룹의 기존 재료를 함께 보게 돼요. 우리 쪽 재료는 전혀 바뀌지 않아요."
            />
          </div>

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
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 16 }}>
            초대 코드가 만들어져요. 가족에게 보내서 함께 냉장고를 관리해보세요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Toggle
              checked={createKeepIngredients}
              onChange={setCreateKeepIngredients}
              label="지금 내 재료를 그룹 재료로 쓰기"
              hint="끄면 지금 재료는 지워지고 빈 상태로 시작해요."
            />
            <Toggle
              checked={createShareRecipeActions}
              onChange={setCreateShareRecipeActions}
              label="즐겨찾기·완료·기록 그룹에 공유"
              hint="기록은 계정별로 그대로 남고, 서로 보이기만 해요."
            />
          </div>
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
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="초대 코드 입력 (예: AB12CD34)"
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
              marginBottom: 16,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Toggle
              checked={mergeIngredients}
              onChange={setMergeIngredients}
              label="내 재료를 그룹 재료에 합치기"
              hint="꺼두면 내 재료는 지워지지 않고 보존되고, 대신 그룹의 기존 재료를 함께 보게 돼요. 그룹 재료는 바뀌지 않고, 나중에 나가면 내 재료를 그대로 돌려받아요."
            />
            <Toggle
              checked={shareRecipeActions}
              onChange={setShareRecipeActions}
              label="즐겨찾기·완료·기록 그룹에 공유"
              hint="기록은 계정별로 그대로 남고, 서로 보이기만 해요."
            />
          </div>
          {joinError && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 12, textAlign: 'center' }}>
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
        {info?.my_ingredients_merged === false ? (
          <>보존해 둔 내 재료를 그대로 돌려받아요. 즐겨찾기·완료·기록은 원래 그대로예요.</>
        ) : (
          <>지금 그룹 재료를 복사해서 가져가요(그룹에는 그대로 남아요). 즐겨찾기·완료·기록은 원래 그대로예요.</>
        )}
      </Dialog>

      <Dialog
        open={!!statsFor}
        onClose={() => setStatsFor(null)}
        title={statsFor ? `${statsFor.nickname}님` : ''}
        actions={
          requestSent
            ? [{ label: '닫기', onClick: () => setStatsFor(null), variant: 'outline' }]
            : [
                { label: '취소', onClick: () => setStatsFor(null), variant: 'outline' },
                { label: '공유 요청하기', onClick: handleSendShareRequest, variant: 'primary' },
              ]
        }
      >
        {!memberStats ? (
          <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '8px 0' }}>불러오는 중...</div>
        ) : requestSent ? (
          <div style={{ fontSize: 13, color: 'var(--ink-700)' }}>
            요청을 보냈어요. {statsFor?.nickname}님이 앱을 열면 수락/거절을 고를 수 있어요.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1E' }}>{memberStats.favorite}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>즐겨찾기</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1E' }}>{memberStats.recorded}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>기록</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1E' }}>{memberStats.completed}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>완료</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
              지금은 비공개예요. 요청을 보내면 {statsFor?.nickname}님이 앱을 열었을 때
              공유 여부를 직접 고를 수 있어요.
            </div>
          </div>
        )}
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
