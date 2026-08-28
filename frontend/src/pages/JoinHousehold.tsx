import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import { useAuth } from '../context/AuthContext';
import {
  stashPendingInviteCode,
  getPendingInviteCode,
  clearPendingInviteCode,
} from '../utils/householdInvite';

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

/**
 * 초대 링크(카카오톡/문자 등으로 공유된 `/join-household?code=...`)로
 * 들어왔을 때 보여주는 화면.
 *
 * 로그인이 안 되어 있으면 계정부터 있어야 그룹에 들어갈 수 있으므로
 * 코드를 잠깐 저장해 두고 로그인/회원가입으로 보낸다(householdInvite.ts).
 * 로그인돼 있으면 이 자리에서 바로 참여 여부를 물어본다 —
 * HouseholdSection의 참여 다이얼로그와 같은 선택지(재료 합치기 / 즐겨찾기
 * 등 공개 여부)를 준다.
 */
const JoinHousehold: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const codeFromUrl = (searchParams.get('code') || '').trim().toUpperCase();
  const code = codeFromUrl || getPendingInviteCode() || '';

  const [mergeIngredients, setMergeIngredients] = React.useState(true);
  const [shareRecipeActions, setShareRecipeActions] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(false);
  const [mergeDenied, setMergeDenied] = React.useState(false);

  React.useEffect(() => {
    if (codeFromUrl) {
      stashPendingInviteCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  const handleJoin = async () => {
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`${getApiUrl()}/api/households/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          invite_code: code,
          merge_ingredients: mergeIngredients,
          share_recipe_actions: shareRecipeActions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '그룹 참여에 실패했어요.');
        return;
      }
      clearPendingInviteCode();
      setMergeDenied(!!data.merge_denied_by_policy);
      setDone(true);
      setTimeout(() => navigate('/my-page'), 1600);
    } catch (e) {
      setError('그룹 참여 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="w-full max-w-[340px] mx-auto px-6 text-center">
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1E', marginBottom: 8 }}>
          식구 그룹 초대
        </div>

        {!code ? (
          <p style={{ fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.6 }}>
            초대 코드를 찾을 수 없어요. 받은 링크를 다시 확인해주세요.
          </p>
        ) : !isLoggedIn ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 20 }}>
              초대 코드 <b style={{ color: '#1A1A1E' }}>{code}</b> 로 그룹에 참여하려면
              <br />
              먼저 로그인하거나 계정을 만들어야 해요.
              <br />
              로그인하고 나면 자동으로 이어서 참여할 수 있어요.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button variant="primary" size="md" block onClick={() => navigate('/login')}>
                로그인
              </Button>
              <Button variant="outline" size="md" block onClick={() => navigate('/signup')}>
                3초 회원가입
              </Button>
            </div>
          </>
        ) : done ? (
          <p style={{ fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.6 }}>
            그룹에 참여했어요!{' '}
            {mergeDenied && '이 그룹은 재료 합치기를 막아 둬서, 내 재료는 그대로 보존돼요. '}
            마이페이지로 이동할게요.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 16 }}>
              초대 코드 <b style={{ color: '#1A1A1E' }}>{code}</b> 그룹에 참여할까요?
            </p>

            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <Toggle
                checked={mergeIngredients}
                onChange={setMergeIngredients}
                label="내 재료를 그룹 재료에 합치기"
                hint="이걸 켜면 내 냉장고 재료가 그룹 재료와 합쳐져요."
              />
              <Toggle
                checked={shareRecipeActions}
                onChange={setShareRecipeActions}
                label="즐겨찾기·완료·기록 그룹에 공유"
                hint="기록은 계정별로 그대로 남고, 서로 보이기만 해요."
              />
            </div>

            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>
            )}

            <Button variant="primary" size="md" block onClick={handleJoin} disabled={busy}>
              {busy ? '참여하는 중...' : '참여하기'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinHousehold;
