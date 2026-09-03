import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/usage';

/**
 * 어드민 — 사용자 목록 · 한도 조정 · 대시보드.
 *
 * 지금은 사용자 앱과 **같은 프론트** 안에 있다. 관리자 1명, 사용자 10명 아래
 * 규모에서 별도 어드민 앱은 과하다. 다만 나중에 떼기 쉬운 모양은 지킨다:
 *
 *  - 이 화면은 `lazy()` 로만 불러온다 → 일반 사용자 번들에 안 실린다
 *  - 서버 경로는 전부 `/api/admin/*` → 나중에 그 경로만 IP 제한 뒤로 넣거나
 *    프론트를 분리할 수 있다
 *  - 권한은 **서버가** 매번 확인한다. 여기서 화면을 숨기는 건 편의일 뿐 보안이 아니다
 *
 * 떼어낼 때의 신호는 사용자 수가 아니라 관리자 수와 위험도다 —
 * 관리자가 여러 명이 되고 되돌리기 어려운 작업(환불·계정 삭제)이 늘면 그때.
 */

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

interface AdminUser {
  id: number;
  email: string;
  nickname: string;
  provider: string;
  created_at: string | null;
  deleted_at: string | null;
  household_id: number | null;
  is_admin: boolean;
  plan: string;
  balance: number;
  granted: number;
  used_total: number;
  daily_cap: number;
  note: string | null;
  ingredient_count: number;
  week_credits: number;
  week_tokens: number;
  today_credits: number;
}

interface UsageRow {
  kind: string;
  credits: number;
  detail: string | null;
  model: string | null;
  images: number | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  created_at: string | null;
}

function authHeaders(): Record<string, string> {
  // 키 이름은 `auth_token` 이다 (utils/usage.ts 의 getAuthToken 설명 참고).
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

const shortDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const num = (n: number) => n.toLocaleString('ko-KR');

const S = {
  page: { minHeight: '100vh', background: 'var(--surface-sub)', padding: '16px 12px 48px' } as React.CSSProperties,
  card: {
    background: 'var(--surface)', border: '1px solid var(--line-200)',
    borderRadius: 14, padding: 16, marginBottom: 12,
  } as React.CSSProperties,
  h2: { fontSize: 16, fontWeight: 700, color: '#1A1A1E', margin: '0 0 10px' } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: 'var(--ink-500)',
    padding: '8px 10px', whiteSpace: 'nowrap' as const, borderBottom: '1px solid var(--line-200)',
  },
  td: {
    fontSize: 13, padding: '9px 10px', borderBottom: '1px solid var(--line-200)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  input: {
    height: 34, borderRadius: 8, border: '1px solid var(--line-200)',
    padding: '0 10px', fontSize: 13, minWidth: 0,
  } as React.CSSProperties,
  btn: {
    height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--line-200)',
    background: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  primary: {
    height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
    background: '#FFD600', color: '#1A1A1E', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties,
};


/**
 * 한도 정책 한 장.
 *
 * 관리자가 "이 사람 한도를 얼마로 올려 줄까" 를 정하려면 **기준이 눈앞에 있어야
 * 한다.** 문서를 찾아보게 만들면 결국 감으로 정하게 된다.
 *
 * 숫자는 서버가 지금 실제로 쓰는 값이다(환경변수로 바뀐 값도 그대로 따라온다).
 * 화면에 하드코딩하면 값을 바꿨을 때 화면만 옛 숫자를 말하게 된다.
 */
const PolicyCard: React.FC<{ policy: any }> = ({ policy }) => {
  const [open, setOpen] = React.useState(false);
  if (!policy) return null;

  const label: Record<string, string> = { guest: '비회원', free: '회원 (free)', plus: '회원 (plus)' };
  const chat = policy.credits?.chat ?? 1;
  const vision = policy.credits?.vision ?? 2;

  return (
    <div style={{ ...S.card, marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', border: 'none', background: 'transparent', padding: 0,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>한도 정책</span>
        <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
          {open ? '접기 ▲' : '펼치기 ▼'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320 }}>
              <thead><tr>{['구분', '일 상한'].map(h => (
                <th key={h} style={S.th}>{h}</th>))}</tr></thead>
              <tbody>
                {(policy.plans || []).map((p: any) => (
                  <tr key={p.key}>
                    <td style={S.td}>{label[p.key] || p.key}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{p.daily}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.8 }}>
            <b>무엇을 세는가</b> — 챗봇 질문 <b>{chat}</b>, 사진 인식 <b>{vision}</b>
            (사진 장수와 무관).
            <br />
            사진이 여러 장이어도 LLM 호출은 한 번이라, 장수만큼 매기면 여러 장을 한 번에
            올리는 것에 벌금을 매기는 꼴이 된다.
            <br />
            <br />
            <b>한도가 아니라 잔액이다</b>
            <br />
            가입할 때 <b>{policy.signup_credits}</b>개를 주고, 매주 월요일에
            <b> {policy.weekly_credits}</b>개씩 더 준다. 쓰면 줄고 저절로 원상복구되지
            않는다. 모자라면 충전하거나 관리자에게 요청한다.
            <br />
            <br />
            매주 가득 채워 주던 방식을 버린 이유 — <b>다 쓸 일이 없으면 부족함을 못
            느끼고, 그러면 결제할 이유가 영영 안 생긴다.</b> 잔액은 실제로 소진된다.
            <br />
            <br />
            매주 조금이라도 주는 이유 — <b>0이 되면 앱을 아예 안 열게 된다.</b>
            앱을 안 열면 결제도 안 한다.
            <br />
            <br />
            <b>일 상한을 함께 두는 이유</b> — 잔액이 있어도 하루에 몰아 쓰면
            "어제 다 써서 오늘 못 쓴다" 가 된다. 그 경험은 한도가 있다는 사실보다
            앱을 더 나쁘게 기억하게 만든다.
            <br />
            <br />
            <b>비회원</b> — AI 기능을 아예 못 쓴다. 로그인해야 크레딧이 생긴다.
            <br />
            <b>다음 주간 지급</b> — {String(policy.resets_at || '').slice(0, 10)}
          </div>

          <div style={{ background: 'var(--surface-sub)', borderRadius: 10, padding: '12px 14px',
                        fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.8 }}>
            <b>가입 {policy.signup_credits}개가 실제로 얼마인가</b>
            <br />
            · 챗봇만 쓰면 <b>{Math.floor((policy.signup_credits || 0) / chat)}회</b> 질문
            <br />
            · 사진만 쓰면 <b>{Math.floor((policy.signup_credits || 0) / vision)}회</b> 인식
            <br />
            · 첫 주 전형 — 영수증 2장 + 재료 사진 3회 + 챗봇 8회
            = {2 * vision + 3 * vision + 8 * chat} 크레딧
            (쓰고도 {(policy.signup_credits || 0) - (2 * vision + 3 * vision + 8 * chat)} 남음)
            <br />
            · 보통 사용자가 쓰는 양은 <b>주 11~16</b> 정도로 본다
            (요리 3~4회 × 챗봇 2~3번 + 장보기 1회)
          </div>

          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.7 }}>
            <b>더 줄 때</b>: 아래 사용자 목록 → <b>자세히</b> → 크레딧 지급에 숫자를
            적으면 그 사람 잔액에 더해집니다. <b>메모는 필수</b>예요 — 몇 달 뒤에
            왜 이 사람만 다른지 알 수 없게 됩니다.
            <br />
            <b>기준을 바꿀 때</b>: 감으로 바꾸지 말고 대시보드의 <b>크레딧 환산 점검</b>
            (종류별 크레딧당 실제 토큰)을 먼저 보세요. 값 자체는 환경변수
            <code> CREDITS_SIGNUP</code>, <code>CREDITS_WEEKLY</code>,
            <code> QUOTA_FREE_DAILY</code> 로 조정합니다.
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 크레딧 지급 · 플랜 조정 패널. 메모를 안 적으면 저장되지 않는다 (서버도 막는다).
 *
 * 크레딧은 한도가 아니라 **잔액**이라 "설정" 이 아니라 "지급" 이다. 숫자를
 * 덮어쓰게 두면 실수로 남의 잔액을 깎을 수 있어서, 보태기만 되게 했다.
 */
const QuotaEditor: React.FC<{ user: AdminUser; onSaved: () => void }> = ({ user, onSaved }) => {
  const [plan, setPlan] = React.useState(user.plan);
  const [grant, setGrant] = React.useState('');
  const [daily, setDaily] = React.useState(String(user.daily_cap));
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!note.trim()) {
      setError('왜 바꾸는지 메모를 남겨 주세요. 몇 달 뒤에 이유를 알 수 없게 됩니다.');
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/users/${user.id}/quota`, {
        method: 'PUT',
        body: JSON.stringify({
          plan,
          grant_credits: grant === '' ? null : Number(grant),
          daily_cap: daily === '' ? null : Number(daily),
          note: note.trim(),
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.7 }}>
        지금 잔액 <b style={{ color: '#1A1A1E' }}>{user.balance}</b>
        <span style={{ color: 'var(--ink-500)' }}> (받은 {user.granted} · 쓴 {user.used_total})</span>
        <br />
        <b>크레딧 지급</b>은 잔액에 <b>더합니다</b>. 덮어쓰지 않아요 —
        실수로 남의 잔액을 깎는 일이 없도록.
        <br />
        일 상한 기본값은 <b>free 15</b>, <b>plus 50</b> 이에요.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={plan} onChange={e => setPlan(e.target.value)} style={S.input}>
          <option value="free">free</option>
          <option value="plus">plus</option>
        </select>
        <label style={{ fontSize: 12, color: 'var(--ink-500)' }}>
          크레딧 지급{' '}
          <input
            value={grant}
            onChange={e => setGrant(e.target.value)}
            placeholder="+100"
            style={{ ...S.input, width: 84 }}
          />
        </label>
        <label style={{ fontSize: 12, color: 'var(--ink-500)' }}>
          일{' '}
          <input value={daily} onChange={e => setDaily(e.target.value)} style={{ ...S.input, width: 72 }} />
        </label>
      </div>
      {/* width:100% 만 주면 표 칸(td) 안에서 내용 너비를 밀어내 표 전체가
          가로로 늘어난다. 최대 폭을 묶고 box-sizing 을 맞춰야 좁은 화면에서
          제자리에 머문다. */}
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="왜 바꾸는지 (필수)"
        style={{ ...S.input, width: '100%', maxWidth: 420, boxSizing: 'border-box' }}
      />
      {user.note && (
        <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>지난 메모: {user.note}</div>
      )}
      {error && <div style={{ fontSize: 12, color: '#D14343' }}>{error}</div>}
      <button type="button" onClick={save} disabled={saving} style={S.primary}>
        {saving ? '저장 중...' : '한도 저장'}
      </button>
    </div>
  );
};

/**
 * 관리자 권한 주기/뺏기.
 *
 * 왜 필요한가: 관리자 표시가 계정 하나에만 있으면 **그 계정이 탈퇴할 때 어드민에
 * 들어갈 사람이 없어진다.** 떠나기 전에 후임을 지정할 수 있어야 한다.
 * 마지막 한 명은 서버가 해제를 막는다 — 실수로 잠기는 상황을 만들지 않는다.
 */
const AdminToggle: React.FC<{ user: AdminUser; onChanged: () => void }> = ({ user, onChanged }) => {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    setBusy(true); setError(null);
    try {
      await api('/api/admin/users/' + user.id + '/admin', {
        method: 'PUT', body: JSON.stringify({ is_admin: !user.is_admin }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '바꾸지 못했어요.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}>
          지금 <b>{user.is_admin ? '관리자입니다' : '일반 사용자입니다'}</b>
        </span>
        <button type="button" style={user.is_admin ? S.btn : S.primary} disabled={busy} onClick={toggle}>
          {busy ? '바꾸는 중...' : user.is_admin ? '관리자 해제' : '관리자로 지정'}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: '#D14343' }}>{error}</div>}
      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.6 }}>
        탈퇴하기 전에 다른 사람을 먼저 지정해 두세요. 마지막 관리자는 해제되지 않습니다.
      </div>
    </div>
  );
};

/** 한 사용자의 최근 호출 이력. 크레딧과 **실제 토큰**을 나란히 본다. */
const UsageHistory: React.FC<{ userId: number }> = ({ userId }) => {
  const [rows, setRows] = React.useState<UsageRow[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    api(`/api/admin/users/${userId}/usage`)
      .then(d => alive && setRows(d.history || []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!rows) return <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>불러오는 중...</div>;
  if (rows.length === 0) return <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>아직 사용 기록이 없어요.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
        <thead>
          <tr>
            {['시각', '종류', '크레딧', '사진', '토큰', '모델'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={S.td}>{(r.created_at || '').replace('T', ' ').slice(0, 16)}</td>
              <td style={S.td}>{r.kind === 'vision' ? '사진' : '챗봇'}</td>
              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.credits}</td>
              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.images ?? '-'}</td>
              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                {r.total_tokens != null ? num(r.total_tokens) : '-'}
              </td>
              <td style={{ ...S.td, color: 'var(--ink-500)', fontSize: 12 }}>{r.model || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


/**
 * 한도 추가 요청 목록.
 *
 * 결제를 붙이지 않기로 했으므로 여기가 "유료 전환" 자리를 대신한다. 요청이
 * 꾸준히 들어오기 시작하면 그때 결제를 붙일 근거가 생긴다 —
 * 그 전까지는 이 목록 자체가 수요 측정이다.
 */
const Requests: React.FC = () => {
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api(`/api/admin/requests?status=${showAll ? 'all' : 'open'}`)
      .then(d => setRows(d.requests || []))
      .catch(e => setError(e.message));
  }, [showAll]);

  React.useEffect(load, [load]);

  const handle = async (id: number, status: string) => {
    await api(`/api/admin/requests/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  if (error) return <div style={S.card}>{error}</div>;
  if (!rows) return <div style={S.card}>불러오는 중...</div>;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-500)' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          처리한 것도 보기
        </label>
      </div>

      {rows.length === 0 ? (
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>대기 중인 요청이 없어요</div>
          <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>
            요청이 주 5건을 넘기 시작하면 결제를 붙일 때가 된 것입니다
            (USAGE_QUOTA_PLAN.md 6절).
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
            <thead>
              <tr>{['요청일', '이메일', '닉네임', '플랜', '사유', '상태', ''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ opacity: r.status === 'open' ? 1 : 0.55 }}>
                  <td style={S.td}>{shortDate(r.created_at)}</td>
                  <td style={S.td}>{r.email}</td>
                  <td style={S.td}>{r.nickname}</td>
                  <td style={S.td}>{r.plan}</td>
                  <td style={{ ...S.td, whiteSpace: 'normal', maxWidth: 260 }}>{r.message || '-'}</td>
                  <td style={S.td}>{r.status}</td>
                  <td style={S.td}>
                    {r.status === 'open' ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button type="button" style={{ ...S.primary, height: 28 }}
                                onClick={() => handle(r.id, 'done')}>처리함</button>
                        <button type="button" style={{ ...S.btn, height: 28, padding: '0 10px' }}
                                onClick={() => handle(r.id, 'rejected')}>거절</button>
                      </span>
                    ) : (
                      <button type="button" style={{ ...S.btn, height: 28, padding: '0 10px' }}
                              onClick={() => handle(r.id, 'open')}>되돌리기</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--ink-500)', padding: '0 4px' }}>
        한도를 실제로 올리는 건 <b>사용자 탭 → 자세히 → 한도 조정</b>에서 합니다.
        "올려 줬다"와 "요청을 닫았다"는 다른 일이라 섞지 않았습니다.
      </div>
    </>
  );
};




/**
 * 대표어 고르기 — 치면 걸러서 목록으로 보여준다.
 *
 * 처음엔 `<datalist>` 를 썼는데 브라우저마다 동작이 달라 목록이 아예 안 뜨거나
 * 앞글자만 맞아야 걸리는 경우가 있었다. 1,300개 중에서 고르는 일이라 "치면 바로
 * 후보가 보이는" 게 핵심이라 직접 만들었다.
 */
const KeywordPicker: React.FC<{
  value: string;
  keywords: string[];
  onPick: (keyword: string) => void;
}> = ({ value, keywords, onPick }) => {
  const [text, setText] = React.useState(value || '');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => { setText(value || ''); }, [value]);

  const matches = React.useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const hit = keywords.filter(k => k.toLowerCase().includes(q));
    // 정확히 같은 것 → 앞에서 시작하는 것 → 나머지. 짧은 것 먼저.
    return hit
      .sort((a, b) => {
        const rank = (k: string) =>
          k.toLowerCase() === q ? 0 : k.toLowerCase().startsWith(q) ? 1 : 2;
        return rank(a) !== rank(b) ? rank(a) - rank(b) : a.length - b.length;
      })
      .slice(0, 30);
  }, [text, keywords]);

  return (
    <div style={{ position: 'relative', minWidth: 180, flex: '1 1 180px', maxWidth: 280 }}>
      <input
        value={text}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="대표어 검색 (예: 상추)"
        style={{ ...S.input, height: 30, width: '100%', boxSizing: 'border-box' }}
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: 34, left: 0, right: 0, zIndex: 5,
          maxHeight: 200, overflowY: 'auto', background: 'var(--surface)',
          border: '1px solid var(--line-200)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
        }}>
          {matches.map(k => (
            <button
              key={k}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setText(k); setOpen(false); onPick(k); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none',
                background: 'transparent', padding: '8px 10px', fontSize: 13, cursor: 'pointer',
                color: 'var(--ink-900)',
              }}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      {open && text.trim() && matches.length === 0 && (
        <div style={{
          position: 'absolute', top: 34, left: 0, right: 0, zIndex: 5,
          background: 'var(--surface)', border: '1px solid var(--line-200)',
          borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--ink-500)',
        }}>
          사전에 없는 이름이에요. 새 재료로 추가하시겠어요?
        </div>
      )}
    </div>
  );
};

/** 대표어가 어느 분류에 있는지 (선택지 목록에서 찾는다) */
function pathOfKeyword(keyword: string, opts: any) {
  if (!keyword || !opts?.keywordPaths) return null;
  return opts.keywordPaths[keyword] || null;
}

/** 분류 한 줄로 (빈 칸은 건너뛴다) */
function pathText(sug: any) {
  const parts = [sug['중분류'], sug['소분류'], sug['세분류'], sug['세세분류']]
    .map((x: string) => (x || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' › ') : '';
}

/**
 * 제안 한 건.
 *
 * **어디로 들어가는지가 보여야 승인할 수 있다.** 처음에는 동의어일 때 분류를
 * `-` 로 비워 뒀는데, 그러면 관리자는 "청상추를 상추의 동의어로" 만 보고
 * 그게 사전 어디에 붙는지 모른 채 승인하게 된다.
 * 그래서 동의어면 **대상 대표어가 있는 분류**를 그대로 보여주고,
 * 새 재료면 **분류를 직접 고르게** 한다.
 */
const SuggestionRow: React.FC<{
  sug: any;
  opts: any;
  onPatch: (patch: any) => void;
  onTarget: (keyword: string) => void;
  onAsk: (decision: string) => Promise<void>;
}> = ({ sug, opts, onPatch, onTarget, onAsk }) => {
  const skip = sug.decision === 'skip';
  const [asking, setAsking] = React.useState(false);

  /**
   * 판단을 바꾸면 **분류도 다시 물어본다.**
   *
   * 관리자가 "이건 새 재료야" 라고만 정하고 분류는 329개 목록에서 직접 찾게 하면
   * 사실상 못 쓴다. 판단은 사람이, 나머지는 AI 가 채우는 게 맞다.
   * (채워진 뒤에도 아래 드롭다운으로 고칠 수 있다)
   */
  const changeDecision = async (next: string) => {
    onPatch({ decision: next });
    if (next === 'skip') return;
    setAsking(true);
    try {
      await onAsk(next);
    } finally {
      setAsking(false);
    }
  };
  const paths: any[] = opts?.paths || [];
  const pathKey = (p: any) =>
    [p['중분류'], p['소분류'], p['세분류'], p['세세분류']].join('|');

  return (
    <div style={{
      border: '1px solid var(--line-200)', borderRadius: 12, padding: '12px 14px',
      background: skip ? 'var(--surface-sub)' : 'var(--surface)', opacity: skip ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>{sug.raw}</b>
        <select
          value={sug.decision}
          onChange={e => { void changeDecision(e.target.value); }}
          disabled={asking}
          style={{ ...S.input, height: 30 }}
        >
          <option value="synonym">기존 재료의 다른 이름</option>
          <option value="keyword">새 재료로 추가</option>
          <option value="skip">넣지 않음</option>
        </select>
        {asking && <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>AI가 분류를 정하는 중...</span>}
      </div>

      {sug.decision === 'synonym' && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>어느 재료의 다른 이름인가요?</span>
            <KeywordPicker
              value={sug.keyword || ''}
              keywords={opts?.keywords || []}
              onPick={onTarget}
            />
          </div>
          <div style={{ fontSize: 12.5, color: pathText(sug) ? 'var(--ink-700)' : '#D14343' }}>
            {pathText(sug)
              ? <>들어갈 자리 — <b>{pathText(sug)}</b> 의 <b>{sug.keyword}</b> 아래</>
              : '대표어를 정하면 어느 분류로 들어가는지 여기 나와요'}
          </div>
        </div>
      )}

      {sug.decision === 'keyword' && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>어느 분류에 넣을까요?</span>
            <select
              value={pathKey(sug)}
              onChange={e => {
                const found = paths.find(p => pathKey(p) === e.target.value);
                if (found) onPatch(found);
              }}
              style={{ ...S.input, height: 30, maxWidth: '100%' }}
            >
              <option value={pathKey(sug)}>
                {pathText(sug) || '(고르세요)'}
              </option>
              {paths.filter(p => pathKey(p) !== pathKey(sug)).map(p => (
                <option key={pathKey(p)} value={pathKey(p)}>
                  {[p['중분류'], p['소분류'], p['세분류'], p['세세분류']].filter(Boolean).join(' › ')}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 12.5, color: pathText(sug) ? 'var(--ink-700)' : '#D14343' }}>
            {pathText(sug)
              ? <>들어갈 자리 — <b>{pathText(sug)}</b> 에 새 재료 <b>{sug.keyword || sug.raw}</b></>
              : '분류를 골라야 반영할 수 있어요'}
          </div>
        </div>
      )}

      {sug.reason && (
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.5 }}>
          {sug.reason}
        </div>
      )}
    </div>
  );
};

/**
 * 재료 사전 보강.
 *
 * 사진에서 읽혔지만 사전에 없던 이름들을 관리자가 골라 LLM 에게 물어보고,
 * **승인한 것만** 사전에 들어간다. 바로 넣지 않는 이유는 사진 인식과 같다 —
 * LLM 은 틀리고, 사전은 모든 사용자의 레시피 매칭 기준이라 영향이 넓다.
 */
const Dictionary: React.FC = () => {
  const [misses, setMisses] = React.useState<any[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = React.useState<any[] | null>(null);
  /** 판단을 고칠 때 쓸 선택지 — 쓸 수 있는 분류 조합과 기존 대표어 목록 */
  const [opts, setOpts] = React.useState<{ paths: any[]; keywords: string[] } | null>(null);
  const [additions, setAdditions] = React.useState<any[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api('/api/admin/dictionary/misses')
      .then(d => { setMisses(d.misses || []); setPicked(new Set()); setSuggestions(null); })
      .catch(e => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  React.useEffect(() => {
    api('/api/admin/dictionary/options').then(setOpts).catch(() => {});
    api('/api/admin/dictionary/additions').then(d => setAdditions(d.additions || [])).catch(() => {});
  }, []);

  const toggle = (name: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const ask = async () => {
    clearMessages();
    setBusy('제안 받는 중...');
    try {
      const d = await api('/api/admin/dictionary/suggest', {
        method: 'POST', body: JSON.stringify({ names: [...picked] }),
      });
      setSuggestions(d.suggestions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제안을 받지 못했어요.');
    } finally { setBusy(null); }
  };

  const applyApproved = async () => {
    clearMessages();
    const items = (suggestions || []).filter(x => x.decision !== 'skip');
    if (items.length === 0) { setNote('반영할 항목이 없어요.'); return; }
    setBusy('반영 중...');
    try {
      const d = await api('/api/admin/dictionary/apply', {
        method: 'POST', body: JSON.stringify({ items }),
      });
      setNote(d.saved + '개를 사전에 넣었어요. 바로 인식에 쓰입니다.');
      load();
      api('/api/admin/dictionary/additions').then(x => setAdditions(x.additions || [])).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '반영하지 못했어요.');
    } finally { setBusy(null); }
  };

  const dropPicked = async () => {
    clearMessages();
    setBusy('지우는 중...');
    try {
      const d = await api('/api/admin/dictionary/misses', {
        method: 'DELETE', body: JSON.stringify({ names: [...picked] }),
      });
      setNote(d.deleted + '개를 목록에서 지웠어요.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally { setBusy(null); }
  };

  /** 제안 하나를 고친다. LLM 이 틀렸을 때 관리자가 바로잡을 수 있어야 한다. */
  const patchSuggestion = (raw: string, patch: any) => {
    setSuggestions(prev => (prev || []).map(x => (x.raw === raw ? { ...x, ...patch } : x)));
  };

  /**
   * 지난 안내를 지운다.
   *
   * 이걸 안 하면 **앞선 동작의 오류가 화면에 남아** 방금 한 일이 실패한 것처럼
   * 보인다. 실제로 "되돌리기" 는 성공했는데 이전 "제안 받기" 의 오류가 그대로
   * 떠 있어서 되돌리기가 실패한 줄 알았던 일이 있었다.
   */
  const clearMessages = () => { setError(null); setNote(null); };

  /** 사전에 보탠 것을 되돌린다 (아직 파일에 안 들어간 것만). */
  const cancelAddition = async (raw: string) => {
    clearMessages();
    try {
      await api('/api/admin/dictionary/additions', {
        method: 'DELETE', body: JSON.stringify({ raw_name: raw }),
      });
      setNote(raw + ' 을(를) 되돌렸어요.');
      api('/api/admin/dictionary/additions').then(x => setAdditions(x.additions || [])).catch(() => {});
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '되돌리지 못했어요.');
    }
  };

  /**
   * 판단을 바꿨을 때 그 한 건만 다시 물어본다.
   *
   * 판단(동의어냐 새 재료냐)은 사람이 정하고, 대표어·분류는 AI 가 채운다.
   * 사람이 329개 분류 목록에서 직접 찾게 하면 사실상 쓰이지 않는다.
   */
  const askAgain = async (raw: string, decision: string) => {
    try {
      const d = await api('/api/admin/dictionary/suggest', {
        method: 'POST', body: JSON.stringify({ names: [raw], force: decision }),
      });
      const got = (d.suggestions || [])[0];
      if (got) patchSuggestion(raw, { ...got, decision });
    } catch {
      /* 실패하면 사람이 직접 고르면 된다 */
    }
  };

  /** 동의어 대상을 바꾸면 **그 대표어가 있는 분류**도 따라 바뀌어야 한다. */
  const setSynonymTarget = (raw: string, keyword: string) => {
    const path = pathOfKeyword(keyword, opts);
    patchSuggestion(raw, { keyword, ...(path || { 중분류: '', 소분류: '', 세분류: '', 세세분류: '' }) });
  };

  if (error && !misses) return <div style={S.card}>{error}</div>;
  if (!misses) return <div style={S.card}>불러오는 중...</div>;

  const unresolved = misses.filter(m => !m.now_resolves_to);

  return (
    <>
      <div style={S.card}>
        <h2 style={S.h2}>사전에 없던 이름</h2>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.7, marginBottom: 12 }}>
          <b>사진</b>에서 읽혔거나 <b>레시피 본문</b>에서 뽑혔는데, 사전에 없어서
          버려진 이름들이에요. 넣을 것을 고른 뒤 <b>제안 받기</b>를 누르면 어느
          분류에 넣을지, 기존 재료의 다른 이름인지를 알려 줘요.
          <b> 승인한 것만</b> 사전에 들어갑니다.
          <br />
          <b>많이 나온 순</b>으로 정렬돼 있어요. 위쪽부터 보시면 됩니다 —
          한 번 나온 오타를 고치는 것보다 <b>천 번 버려진 이름</b>을 넣는 게
          훨씬 많이 바뀝니다.
          <br />
          요리 이름·주류 브랜드처럼 <b>일부러 안 넣을 것</b>은 목록에서 지워 두세요.
          안 지우면 볼 때마다 다시 판단하게 됩니다.
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" style={S.primary} disabled={!picked.size || !!busy} onClick={ask}>
            {busy === '제안 받는 중...' ? busy : '제안 받기 (' + picked.size + ')'}
          </button>
          <button type="button" style={S.btn} disabled={!picked.size || !!busy} onClick={dropPicked}>
            목록에서 지우기
          </button>
          {/* 한 번 더 누르면 풀려야 한다. 고르기만 되고 풀리지 않으면
              잘못 골랐을 때 새로고침 말고는 되돌릴 방법이 없다. */}
          <button type="button" style={S.btn} onClick={() => {
            const all = unresolved.map(m => m.raw_name);
            const allPicked = all.length > 0 && all.every(n => picked.has(n));
            setPicked(allPicked ? new Set() : new Set(all));
          }}>
            {unresolved.length > 0 && unresolved.every(m => picked.has(m.raw_name))
              ? '전체 해제'
              : '안 잡히는 것 모두 고르기'}
          </button>
        </div>

        {note && <div style={{ fontSize: 12, color: 'var(--ink-700)', marginBottom: 8 }}>{note}</div>}
        {error && <div style={{ fontSize: 12, color: '#D14343', marginBottom: 8 }}>{error}</div>}

        {misses.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>지금은 못 잡은 이름이 없어요.</div>
        ) : (() => {
          // 표로 둔다.
          //
          // 알약으로 늘어놓으면 **몇 번 나온 것인지가 안 읽힌다.** 숫자가 이름
          // 뒤에 붙어 있어 줄이 안 맞고, 15,000번짜리와 1번짜리가 똑같은 크기의
          // 알약으로 나란히 있어 무엇부터 볼지 판단이 안 된다. 지금은 후보가
          // 수천 종이라 더 그렇다.
          const total = (m: any) => (m.total_hits ?? ((m.hit_count || 0) + (m.recipe_hits || 0)));
          const peak = Math.max(1, ...misses.map(total));
          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 34 }} />
                    <th style={S.th}>이름</th>
                    <th style={S.th}>나온 횟수</th>
                    <th style={S.th}>어디서</th>
                  </tr>
                </thead>
                <tbody>
                  {misses.map(m => {
                    const on = picked.has(m.raw_name);
                    const solved = !!m.now_resolves_to;
                    const n = total(m);
                    return (
                      <tr
                        key={m.raw_name}
                        onClick={() => { if (!solved) toggle(m.raw_name); }}
                        style={{
                          cursor: solved ? 'default' : 'pointer',
                          background: on ? '#FFF8CC' : 'transparent',
                        }}
                      >
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={solved}
                            onChange={() => { if (!solved) toggle(m.raw_name); }}
                            onClick={e => e.stopPropagation()}
                            aria-label={m.raw_name}
                          />
                        </td>
                        <td style={{
                          ...S.td,
                          color: solved ? 'var(--ink-500)' : 'var(--ink-900)',
                          textDecoration: solved ? 'line-through' : 'none',
                        }}>
                          {m.raw_name}
                          {solved && (
                            <span style={{ fontSize: 11, color: 'var(--ink-500)', textDecoration: 'none' }}>
                              {' → ' + m.now_resolves_to + ' 로 이제 잡혀요'}
                            </span>
                          )}
                        </td>
                        {/* 숫자만 있으면 15,000 과 800 의 차이가 안 와닿는다.
                            막대를 옆에 둬서 눈으로 바로 크기를 재게 한다. */}
                        <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums', width: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ minWidth: 46, textAlign: 'right' }}>{num(n)}</span>
                            <span style={{ flex: 1, height: 4, borderRadius: 2,
                                           background: 'var(--line-200)', minWidth: 40 }}>
                              <span style={{ display: 'block', width: (n / peak) * 100 + '%',
                                             height: '100%', borderRadius: 2, background: '#FFD600' }} />
                            </span>
                          </div>
                        </td>
                        <td style={{ ...S.td, fontSize: 11.5, color: 'var(--ink-500)' }}>
                          {[
                            (m.recipe_hits || 0) > 0 ? '레시피 ' + num(m.recipe_hits) : '',
                            (m.hit_count || 0) > 0 ? '사진 ' + num(m.hit_count) : '',
                          ].filter(Boolean).join(' · ') || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {additions && additions.length > 0 && (
        <div style={S.card}>
          <h2 style={S.h2}>사전에 보탠 것 {additions.length}건</h2>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10, lineHeight: 1.7 }}>
            승인한 순간 <b>바로 인식에 쓰입니다.</b> 아래 <b>파일 반영</b>은 그것과
            별개로, 저장소의 사전 파일(CSV)에 옮겨졌는지예요 —
            <b> 매일 새벽 4시 30분</b>에 자동으로 옮겨집니다.
            (서버가 도는 곳은 파일시스템이 임시라 서버가 직접 못 고쳐요)
            <br />
            <b style={{ color: '#D14343' }}>실패</b>가 뜨면 이유가 함께 나와요. 원인을 고치면
            다음 새벽에 자동으로 다시 시도합니다. 아니면 <b>되돌리기</b>로 치우세요.
          </div>

          {/* 카드로 둔다. 표로 두면 좁은 화면에서 가로 스크롤이 생기고
              첫 열(이름)이 화면 밖으로 밀려 무엇에 대한 줄인지 안 보였다. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {additions.map((a: any) => {
              const failed = !!a.apply_error;
              return (
                <div key={a.raw_name} style={{
                  border: '1px solid var(--line-200)', borderRadius: 10, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 14 }}>{a.raw_name}</b>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                      background: a.applied_to_csv ? '#E8F0E4' : failed ? '#FBE3E0' : '#FFF3B0',
                      color: a.applied_to_csv ? '#3A6B2E' : failed ? '#B03A28' : '#7A5C00',
                    }}>
                      {a.applied_to_csv ? '파일 반영 완료' : failed ? '반영 실패' : '반영 대기'}
                    </span>
                    {!a.applied_to_csv && (
                      <button
                        type="button"
                        onClick={() => { void cancelAddition(a.raw_name); }}
                        style={{ ...S.btn, height: 26, padding: '0 10px', fontSize: 12 }}
                      >
                        되돌리기
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-700)' }}>
                    {a.kind === 'synonym' ? a.keyword + ' 의 다른 이름' : '새 재료 ' + a.keyword}
                    {' · '}
                    <span style={{ color: 'var(--ink-500)' }}>
                      {[a['중분류'], a['소분류']].filter(Boolean).join(' › ') || '분류 없음'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
                    승인 {String(a.created_at || '').replace('T', ' ').slice(0, 16)}
                    {a.applied_at && ' · 파일 반영 ' + String(a.applied_at).replace('T', ' ').slice(0, 16)}
                  </div>
                  {failed && (
                    <div style={{ fontSize: 12, color: '#D14343' }}>실패 이유 — {a.apply_error}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {suggestions && (
        <div style={S.card}>
          <h2 style={S.h2}>제안 — 승인할 것만 남기세요</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map(sug => (
              <SuggestionRow
                key={sug.raw}
                sug={sug}
                opts={opts}
                onPatch={(patch: any) => patchSuggestion(sug.raw, patch)}
                onTarget={(kw: string) => setSynonymTarget(sug.raw, kw)}
                onAsk={(decision: string) => askAgain(sug.raw, decision)}
              />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" style={S.primary} disabled={!!busy} onClick={applyApproved}>
              {busy === '반영 중...' ? busy : '사전에 반영'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.6 }}>
            반영하면 <b>바로 인식에 쓰입니다.</b> 저장소의 사전 파일로 옮기는 것은
            <b> 매일 새벽 4시 30분에 자동으로</b> 진행돼요(아래 목록에서 확인할 수 있어요).
          </div>
        </div>
      )}
    </>
  );
};


const daysSince = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

/**
 * 운영 상태 — 손으로 관리해야 하는 자료들과 자동 작업.
 *
 * 서버는 이 값을 **만들지 못한다.** "파일을 언제 마지막으로 고쳤는지"는 git
 * 이력이고, "크롤러가 몇 시에 도는지"는 윈도우 작업 스케줄러인데, 둘 다
 * 개발 컴퓨터에만 있다. 그쪽에서 매일 `scripts/report_ops_status.py --write`
 * 로 DB 에 적어 두고 여기서는 읽기만 한다.
 *
 * 그래서 **언제 적힌 값인지**를 맨 위에 크게 보여준다. 그 스크립트가 며칠 안
 * 돌았으면 화면의 숫자도 그만큼 오래된 것이다.
 */
const Maintenance: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api('/api/admin/maintenance').then(d => setData(d)).catch(e => setError(e.message));
  }, []);

  if (error) return <div style={S.card}>{error}</div>;
  if (!data) return <div style={S.card}>불러오는 중...</div>;

  const st = data.status;
  if (!st) {
    return (
      <div style={S.card}>
        <h2 style={S.h2}>아직 기록된 상태가 없어요</h2>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.7 }}>
          개발 컴퓨터에서 아래를 한 번 돌리면 여기에 나옵니다. 매일 배치에도 들어 있어요.
          <br />
          <code>python scripts/report_ops_status.py --write</code>
        </div>
      </div>
    );
  }

  const stale = daysSince(st.generated_at);

  return (
    <>
      <div style={S.card}>
        <h2 style={S.h2}>운영 상태</h2>
        <div style={{ fontSize: 13, color: stale !== null && stale > 2 ? '#D14343' : 'var(--ink-500)', lineHeight: 1.6 }}>
          {(st.generated_at || '').replace('T', ' ').slice(0, 16)} 기준
          {stale !== null && (stale <= 0 ? ' (오늘)' : ' (' + stale + '일 전)')}
          {stale !== null && stale > 2 && ' — 개발 컴퓨터의 기록 배치가 며칠째 안 돌았어요'}
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>손으로 관리하는 자료</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
            <thead>
              <tr>{['자료', '내용', '최근 수정', '왜 관리하나'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(st.files || []).map((f: any) => {
                const old = daysSince(f.last_commit_at);
                return (
                  <tr key={f.path}>
                    <td style={S.td}><b>{f.label}</b></td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                      {num(f.rows || 0)}행
                      {f.filled !== undefined && (
                        <span style={{ color: f.filled < 10 ? '#D14343' : 'var(--ink-500)' }}>
                          {' · 링크 ' + f.filled + '개'}
                        </span>
                      )}
                    </td>
                    <td style={{ ...S.td, color: old !== null && old > 120 ? '#D14343' : undefined }}>
                      {(f.last_commit_at || '').slice(0, 10)}
                      {old !== null && <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>{' (' + old + '일)'}</span>}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'normal', maxWidth: 300, fontSize: 12,
                                 color: 'var(--ink-500)' }}>{f.why}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>자동으로 도는 작업</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
            <thead>
              <tr>{['작업', '상태', '마지막 실행', '결과', '다음 실행'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(st.tasks || []).map((t: any, i: number) => (
                <tr key={t.name || i}>
                  <td style={S.td}>{t.name || t.error || '?'}</td>
                  <td style={S.td}>{t.state || '-'}</td>
                  <td style={S.td}>{String(t.last_run || '-').slice(0, 16)}</td>
                  <td style={{ ...S.td, color: t.last_result === 0 ? 'var(--ink-500)' : '#D14343',
                               fontWeight: t.last_result === 0 ? 400 : 700 }}>
                    {t.last_result === 0 ? '성공' : '실패 (' + t.last_result + ')'}
                  </td>
                  <td style={S.td}>{String(t.next_run || '-').slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(st.logs || []).length > 0 && (
        <div style={S.card}>
          <h2 style={S.h2}>배치 로그 마지막 줄</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {st.logs.map((l: any) => (
              <div key={l.file}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {l.file}
                  <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>
                    {' · ' + String(l.modified_at || '').replace('T', ' ').slice(0, 16)}
                  </span>
                </div>
                <pre style={{
                  margin: 0, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-sub)',
                  fontSize: 11, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap',
                  color: 'var(--ink-700)',
                }}>{(l.tail || []).join('\n')}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * 추이 그래프의 계열 색.
 *
 * 이웃한 두 색이 **색각 이상(적록·청황)에서도 구분되는지 검증한 조합**이라
 * 순서를 바꾸거나 색을 갈아 끼우지 않는다. 계열이 5개를 넘으면 색을 새로
 * 만들지 말고 상위 5개만 그리고 나머지는 아래 표로 보낸다 — 색을 늘리는 순간
 * 어느 선이 어느 화면인지 아무도 못 읽는다.
 */
const SERIES_COLORS = ['#2563EB', '#B4780A', '#0F9D58', '#B0518A', '#7C3AED'];

/**
 * 계열마다 점 모양도 다르게 둔다.
 *
 * 색만으로 구분하게 두면 색각 이상이거나 흑백으로 뽑았을 때 선이 뒤섞인다.
 * 모양은 색과 별개로 살아남는다.
 */
const SERIES_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'donut'];

const Mark: React.FC<{ shape: string; x: number; y: number; color: string; r?: number }> =
  ({ shape, x, y, color, r = 4 }) => {
    // 겹치는 점은 배경색 테두리로 떼어 놓는다. 안 그러면 두 선이 만나는 자리에서
    // 한 덩어리로 뭉쳐 어느 쪽이 위인지 안 보인다.
    const ring = { stroke: 'var(--surface)', strokeWidth: 2 };
    if (shape === 'square') {
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={color} {...ring} />;
    }
    if (shape === 'triangle') {
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`}
                      fill={color} {...ring} />;
    }
    if (shape === 'diamond') {
      return <polygon points={`${x},${y - r - 1.5} ${x + r + 1.5},${y} ${x},${y + r + 1.5} ${x - r - 1.5},${y}`}
                      fill={color} {...ring} />;
    }
    if (shape === 'donut') {
      return <circle cx={x} cy={y} r={r - 0.5} fill="var(--surface)" stroke={color} strokeWidth={2.5} />;
    }
    return <circle cx={x} cy={y} r={r} fill={color} {...ring} />;
  };

/** 보기 단위. `count` 는 가로축에 세울 칸 수. */
const UNITS: Record<string, { label: string; count: number; note: string }> = {
  day: { label: '일자별', count: 14, note: '최근 2주' },
  month: { label: '월별', count: 12, note: '최근 12개월' },
  year: { label: '년도별', count: 6, note: '최근 6년' },
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 날짜(YYYY-MM-DD)를 보기 단위의 칸 이름으로 접는다. */
const bucketOf = (date: string, unit: string) =>
  unit === 'year' ? date.slice(0, 4) : unit === 'month' ? date.slice(0, 7) : date;

/**
 * 빈 칸까지 포함한 가로축을 만든다.
 *
 * 기록이 있는 날만 이으면 **없는 날이 사라져** 선이 붙어 버린다. 뜸했던 기간이
 * 활발했던 것처럼 보이는데, 그게 이 그래프로 가장 하기 쉬운 착각이다.
 */
const axisBuckets = (unit: string, oldest: string | null): string[] => {
  const today = new Date();
  const out: string[] = [];
  const n = UNITS[unit].count;
  if (unit === 'day') {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    }
  } else if (unit === 'month') {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    }
  } else {
    const thisYear = today.getFullYear();
    const first = oldest ? Number(oldest.slice(0, 4)) : thisYear;
    for (let y = Math.max(first, thisYear - n + 1); y <= thisYear; y++) out.push(String(y));
  }
  return out;
};

const tickLabel = (b: string, unit: string) =>
  unit === 'day' ? b.slice(5).replace('-', '/')
    : unit === 'month' ? b.slice(2).replace('-', '/')
      : b;

const fullLabel = (b: string, unit: string) =>
  unit === 'day' ? b
    : unit === 'month' ? `${b.slice(0, 4)}년 ${Number(b.slice(5))}월`
      : `${b}년`;

/**
 * 세로축 눈금 간격을 1·2·5·10… 중에서 고른다.
 *
 * 꼭대기만 올려 잡고 4등분하면 `0 / 13 / 25 / 38 / 50` 같은 눈금이 나온다.
 * 읽을 때마다 머릿속에서 반올림해야 해서, 간격을 먼저 반듯한 수로 정하고
 * 꼭대기를 거기에 맞춘다.
 */
const niceStep = (x: number) => {
  if (!(x > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 5, 10]) {
    if (x <= mag * m) return mag * m;
  }
  return mag * 10;
};

/**
 * 화면별 추이 꺾은선.
 *
 * 왜 표가 아니라 선인가: 표는 "지금 어느 화면이 많나" 에 답하지만
 * **"늘고 있나 줄고 있나"** 에는 답하지 못한다. 광고를 켠 뒤 무엇이 달라졌는지는
 * 시간축이 있어야 보인다.
 */
const TrendChart: React.FC<{ rows: any[]; unit: string }> = ({ rows, unit }) => {
  const [at, setAt] = React.useState<number | null>(null);

  const oldest = rows.length
    ? rows.reduce((a: string, r: any) => (r.date < a ? r.date : a), rows[0].date)
    : null;
  const buckets = axisBuckets(unit, oldest);

  // 계열은 **전 기간 합계** 상위 5개로 고정한다.
  // 칸마다 순위로 색을 주면 단위를 바꿀 때마다 색이 옮겨 다녀, 같은 색이 어제는
  // 홈이고 오늘은 레시피가 된다.
  const totals = new Map<string, number>();
  rows.forEach((r: any) => totals.set(r.screen, (totals.get(r.screen) || 0) + r.views));
  const names = [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, SERIES_COLORS.length)
    .map(([k]) => k);

  const cell = new Map<string, number>();
  rows.forEach((r: any) => {
    const k = r.screen + '|' + bucketOf(r.date, unit);
    cell.set(k, (cell.get(k) || 0) + r.views);
  });
  const value = (screen: string, b: string) => cell.get(screen + '|' + b) || 0;

  if (names.length === 0 || buckets.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '18px 0' }}>
        아직 화면 기록이 없어요. 앱을 몇 번 돌아다니면 여기에 쌓입니다.
      </div>
    );
  }

  const W = 720, H = 230, padL = 48, padR = 16, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const peak = Math.max(...names.flatMap(nm => buckets.map(b => value(nm, b))));
  const gap = niceStep(Math.max(peak, 1) / 4);
  const top = Math.max(gap, Math.ceil(peak / gap) * gap);
  const x = (i: number) => buckets.length === 1
    ? padL + plotW / 2
    : padL + (i * plotW) / (buckets.length - 1);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += gap) ticks.push(t);
  const labelEvery = Math.ceil(buckets.length / 7);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const i = buckets.length === 1
      ? 0
      : Math.round(((vx - padL) / plotW) * (buckets.length - 1));
    setAt(Math.max(0, Math.min(buckets.length - 1, i)));
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerLeave={() => setAt(null)}
        role="img"
        aria-label="화면별 추이"
      >
        {/* 눈금은 뒤로 물러나 있어야 한다. 선을 읽는 걸 방해하면 안 된다. */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)}
                  stroke="var(--line-200)" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-500)">
              {num(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          (i % labelEvery === 0 || i === buckets.length - 1) ? (
            <text key={b} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-500)">
              {tickLabel(b, unit)}
            </text>
          ) : null
        ))}
        {at !== null && (
          <line x1={x(at)} x2={x(at)} y1={padT} y2={padT + plotH}
                stroke="var(--ink-500)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {names.map((nm, si) => (
          <polyline key={nm} fill="none" stroke={SERIES_COLORS[si]} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round"
                    points={buckets.map((b, i) => `${x(i)},${y(value(nm, b))}`).join(' ')} />
        ))}
        {names.map((nm, si) => buckets.map((b, i) => (
          <Mark key={nm + b} shape={SERIES_SHAPES[si]}
                x={x(i)} y={y(value(nm, b))} color={SERIES_COLORS[si]} />
        )))}
      </svg>

      {at !== null && (
        <div style={{
          position: 'absolute', top: 0,
          left: `${(x(at) / W) * 100}%`,
          transform: x(at) > W / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
          background: 'var(--surface)', border: '1px solid var(--line-200)', borderRadius: 10,
          boxShadow: '0 6px 18px rgba(0,0,0,.10)', padding: '8px 10px',
          pointerEvents: 'none', fontSize: 12, minWidth: 140, zIndex: 2,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{fullLabel(buckets[at], unit)}</div>
          {names.map((nm, si) => (
            <div key={nm} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.8 }}>
              <svg width={11} height={11} viewBox="0 0 11 11" aria-hidden>
                <Mark shape={SERIES_SHAPES[si]} x={5.5} y={5.5} r={4} color={SERIES_COLORS[si]} />
              </svg>
              <span style={{ flex: 1, color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>{nm}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{num(value(nm, buckets[at]))}</b>
            </div>
          ))}
        </div>
      )}

      {/* 색만으로는 못 읽는 사람이 있으므로 이름표는 항상 둔다. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
        {names.map((nm, si) => (
          <span key={nm} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--ink-700)',
          }}>
            <svg width={14} height={12} viewBox="0 0 14 12" aria-hidden>
              <line x1={0} y1={6} x2={14} y2={6} stroke={SERIES_COLORS[si]} strokeWidth={2} />
              <Mark shape={SERIES_SHAPES[si]} x={7} y={6} r={3.5} color={SERIES_COLORS[si]} />
            </svg>
            {nm}
          </span>
        ))}
      </div>
    </div>
  );
};

/** ISO 시각에서 날짜만. */
const dayOf = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : null);

/** "2026-08-01 ~ 2026-09-02" 꼴. 기록이 없으면 그렇다고 말한다. */
const spanOf = (from?: string | null, to?: string | null) =>
  from ? `${dayOf(from)} ~ ${dayOf(to) || '오늘'}` : '아직 기록 없음';

/**
 * 이 카드의 숫자가 **언제부터 언제까지의 것인지** 적는 줄.
 *
 * 카드마다 집계 구간이 다르다(누적 / 이번 주 / 최근 30일 / 기록을 켠 뒤부터).
 * 안 적어 두면 볼 때마다 "이게 언제 거지" 를 되묻게 되고, 결국 잘못 비교한다.
 */
const Range: React.FC<{ children: React.ReactNode; inline?: boolean }> = ({ children, inline }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    margin: inline ? 0 : '-4px 0 12px',
  }}>
    <span style={{
      fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
      background: 'var(--surface-sub)', color: 'var(--ink-500)', whiteSpace: 'nowrap',
    }}>기간</span>
    <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{children}</span>
  </div>
);

/**
 * 날짜별 막대그래프 (한 계열).
 *
 * 전에는 막대만 그리고 값은 `title`(마우스 올림)로만 보여 줬다. **폰에는 마우스가
 * 없어서 숫자를 볼 방법이 아예 없었다.** 그래서 세로 눈금과 막대 위 숫자를 둘 다
 * 그린다 — 어느 쪽으로도 읽힌다.
 *
 * 기록이 있는 날만 그리지 않고 **빈 날도 0으로 세운다.** 있는 날만 이으면 뜸했던
 * 기간이 사라져 활발했던 것처럼 보인다.
 */
const DailyBars: React.FC<{ rows: [string, number][]; unit: string }> = ({ rows, unit }) => {
  const [at, setAt] = React.useState<number | null>(null);

  // 날짜별 값을 보기 단위로 접는다. 꺾은선 쪽과 같은 규칙을 쓴다 — 두 그래프가
  // 서로 다른 방식으로 묶으면 같은 화면에서 숫자가 안 맞아 보인다.
  const folded = new Map<string, number>();
  rows.forEach(([date, v]) => {
    const key = bucketOf(date, unit);
    folded.set(key, (folded.get(key) || 0) + v);
  });
  const oldest = rows.length ? rows.map(r => r[0]).sort()[0] : null;
  const buckets = axisBuckets(unit, oldest);
  const values = buckets.map(b => folded.get(b) || 0);
  const total = values.reduce((a, b) => a + b, 0);

  const W = 720, H = 180, padL = 44, padR = 14, padT = 20, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const peak = Math.max(...values, 0);
  const gap = niceStep(Math.max(peak, 1) / 3);
  const top = Math.max(gap, Math.ceil(peak / gap) * gap);
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += gap) ticks.push(t);

  const slot = plotW / buckets.length;
  // 막대 사이에 배경색 틈을 두고, 칸이 적을 때(연도별) 막대가 무한정 뚱뚱해지지
  // 않게 상한을 둔다. 6칸짜리 그래프에서 막대 하나가 100px 이면 그래프가 아니라
  // 색 블록처럼 보인다.
  const barW = Math.min(48, Math.max(6, slot - 6));
  const x = (i: number) => padL + slot * i + slot / 2;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(buckets.length / 7);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    setAt(Math.max(0, Math.min(buckets.length - 1, Math.floor((vx - padL) / slot))));
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>
        이 기간 합계 <b style={{ color: '#1A1A1E' }}>{num(total)}</b> 크레딧
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerLeave={() => setAt(null)}
        role="img"
        aria-label="일별 크레딧"
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)}
                  stroke="var(--line-200)" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-500)">
              {num(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const v = values[i];
          if (!v) return null;
          const h = Math.max(3, padT + plotH - y(v));
          return (
            <rect key={b} x={x(i) - barW / 2} y={y(v)} width={barW} height={h}
                  rx={4} fill="#FFD600" />
          );
        })}
        {/* 막대 위에 숫자. 노란 막대는 배경과 대비가 약해서, 숫자가 없으면
            "몇인지 모르겠다" 가 된다. 0인 날은 적지 않는다(눈만 어지럽다). */}
        {buckets.map((b, i) => (
          values[i] ? (
            <text key={b} x={x(i)} y={y(values[i]) - 6} textAnchor="middle"
                  fontSize={11} fontWeight={700} fill="#1A1A1E">
              {num(values[i])}
            </text>
          ) : null
        ))}
        {buckets.map((b, i) => (
          (i % labelEvery === 0 || i === buckets.length - 1) ? (
            <text key={b} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-500)">
              {tickLabel(b, unit)}
            </text>
          ) : null
        ))}
      </svg>

      {at !== null && (
        <div style={{
          position: 'absolute', top: 18,
          left: `${(x(at) / W) * 100}%`,
          transform: x(at) > W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
          background: 'var(--surface)', border: '1px solid var(--line-200)', borderRadius: 10,
          boxShadow: '0 6px 18px rgba(0,0,0,.10)', padding: '6px 10px',
          pointerEvents: 'none', fontSize: 12, whiteSpace: 'nowrap', zIndex: 2,
        }}>
          <b>{fullLabel(buckets[at], unit)}</b> · {num(values[at])} 크레딧
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [act, setAct] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  // 추이 그래프 보기. 기본은 일자별 — 어제 뭘 했는지가 가장 자주 궁금하다.
  const [unit, setUnit] = React.useState<string>('day');
  const [metric, setMetric] = React.useState<'views' | 'exits'>('views');
  // 크레딧 그래프는 화면 추이와 **따로** 고른다. 둘을 한 상태로 묶으면
  // 한쪽을 월별로 보려다 다른 쪽까지 바뀌어 비교하던 걸 놓친다.
  const [creditUnit, setCreditUnit] = React.useState<string>('day');

  React.useEffect(() => {
    api('/api/admin/dashboard').then(setData).catch(e => setError(e.message));
    api('/api/admin/activity').then(setAct).catch(() => {});
  }, []);

  if (error) return <div style={S.card}>{error}</div>;
  if (!data) return <div style={S.card}>불러오는 중...</div>;

  const P = data.periods || {};
  const AP = (act && act.periods) || {};

  const daily: any[] = data.usage_daily || [];
  const byDate = new Map<string, number>();
  daily.forEach(d => byDate.set(d.date, (byDate.get(d.date) || 0) + d.credits));
  // DailyBars 가 빈 날을 0으로 채우므로 여기서는 자르지 않고 그대로 넘긴다.
  const recent: [string, number][] = [...byDate.entries()];

  return (
    <>
      {act && (
        <>
          <div style={S.card}>
            <h2 style={S.h2}>어디까지 오고 어디서 멈추나</h2>
            <Range>
              전체 기간 누적 · 첫 가입 {dayOf(AP.users_from) || '-'} ~ 오늘 {dayOf(AP.now) || '-'}
            </Range>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 12, lineHeight: 1.6 }}>
              가입한 사람이 각 단계까지 얼마나 오는지예요. <b>많이 줄어드는 칸이 고칠 곳</b>입니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(act.steps || []).map((st: any, i: number) => {
                const base = act.steps[0]?.count || 1;
                const pct = Math.round((st.count / base) * 100);
                const prev = i > 0 ? act.steps[i - 1].count : null;
                const drop = prev !== null && prev > 0 ? Math.round(((prev - st.count) / prev) * 100) : null;
                return (
                  <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 76, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{st.label}</div>
                    <div style={{ flex: 1, minWidth: 0, height: 22, background: 'var(--line-200)',
                                  borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: '#FFD600' }} />
                    </div>
                    <div style={{ width: 108, textAlign: 'right', fontSize: 12,
                                  fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      <b>{st.count}</b>명 · {pct}%
                      {drop !== null && drop > 0 && (
                        <span style={{ color: '#D14343' }}>{' -' + drop + '%'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 10, lineHeight: 1.6 }}>
              탈퇴 {act.churned}명.
              <br />
              <b>아직 못 보는 것</b>: {(act.blind_spots || []).join(' / ')}
              <br />
              이걸 보려면 화면 진입·행동을 남기는 기록이 따로 필요해요.
            </div>
          </div>

          {(act.screens || []).length > 0 && (
            <div style={S.card}>
              <h2 style={S.h2}>어느 화면을 보고 어디서 나가나</h2>
              <Range>
                화면 기록을 켠 뒤부터 · {spanOf(AP.events_from, AP.events_to)}
              </Range>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 12, lineHeight: 1.6 }}>
                방문 {act.sessions?.total ?? 0}회 · 사람 {act.sessions?.people ?? 0}명 ·
                두 번 이상 온 사람 <b>{act.sessions?.returning ?? 0}명</b>
                {(act.sessions?.people ?? 0) > 0 &&
                  ' (' + Math.round(((act.sessions?.returning ?? 0) / act.sessions.people) * 100) + '%)'}
              </div>

              {/* 고르는 것들은 그래프 **위 한 줄**에 모은다. 흩어 두면 무엇이
                  무엇을 바꾸는지 매번 찾아야 한다. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8,
                            alignItems: 'center', margin: '2px 0 10px' }}>
                <div style={{ display: 'inline-flex', border: '1px solid var(--line-200)',
                              borderRadius: 8, overflow: 'hidden' }}>
                  {([['views', '화면 진입'], ['exits', '나간 자리']] as const).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMetric(k)}
                      aria-pressed={metric === k}
                      style={{
                        height: 32, padding: '0 12px', border: 'none', cursor: 'pointer',
                        fontSize: 12.5, fontWeight: metric === k ? 700 : 500, color: '#1A1A1E',
                        background: metric === k ? '#FFD600' : 'var(--surface)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  aria-label="보기 단위"
                  style={{ ...S.input, height: 32 }}
                >
                  {Object.keys(UNITS).map(k => (
                    <option key={k} value={k}>{UNITS[k].label}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
                  {UNITS[unit].note} · 많이 {metric === 'views' ? '본' : '나간'} 화면 5개만
                </span>
              </div>

              <TrendChart
                rows={metric === 'views' ? (act.screen_series || []) : (act.exit_series || [])}
                unit={unit}
              />
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)', margin: '6px 0 16px', lineHeight: 1.6 }}>
                {metric === 'views'
                  ? '그 칸 동안 각 화면에 들어온 횟수예요.'
                  : '그 칸 동안 끝난 방문을, 마지막으로 본 화면으로 나눈 수예요. 높은 선이 사람을 놓치는 자리입니다.'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>많이 본 화면</div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr>{['화면', '진입', '방문'].map(h => (
                      <th key={h} style={S.th}>{h}</th>))}</tr></thead>
                    <tbody>
                      {act.screens.map((r: any) => (
                        <tr key={r.screen}>
                          <td style={S.td}>{r.screen}</td>
                          <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(r.views)}</td>
                          <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(r.sessions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  {/* 방문의 마지막 화면 = 그 사람이 나간 자리.
                      상위에 뜨는 화면이 곧 손볼 곳이다. */}
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    마지막으로 본 화면 <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>(= 나간 자리)</span>
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr>{['화면', '방문 수'].map(h => (
                      <th key={h} style={S.th}>{h}</th>))}</tr></thead>
                    <tbody>
                      {(act.exits || []).map((r: any) => (
                        <tr key={r.screen}>
                          <td style={S.td}>{r.screen}</td>
                          <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(r.n)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(act.sources || []).length > 0 && (() => {
                // 광고를 어디에 더 쓸지는 **방문 수가 아니라 전환율**로 정한다.
                // 3천 명이 들어와 아무도 재료를 안 담는 유입보다, 300명이 들어와
                // 절반이 담는 유입이 낫다. 그래서 비율을 옆에 붙여 둔다.
                const totalSessions = act.sources.reduce(
                  (a: number, r: any) => a + (r.sessions || 0), 0) || 1;
                const cols = ['유입', '방문', '사람', '방문당 화면',
                              '재료 담기', 'AI 사용', '가입', '쿠팡', '첫 화면', '들어온 기간'];
                return (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>어디서 들어왔나</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10, lineHeight: 1.7 }}>
                      방문이 시작될 때의 <code>utm_source</code> 로 나눴어요.
                      표시가 없으면 <b>(직접)</b> — 주소를 직접 치거나 북마크·홈 화면
                      아이콘으로 들어온 방문입니다.
                      <br />
                      괄호 안 비율은 모두 <b>그 유입의 방문 수 대비</b>예요.
                      <b> 방문이 많은 쪽</b>이 아니라 <b>재료 담기·가입 비율이 높은 쪽</b>에
                      광고를 더 쓰면 됩니다.
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
                        <thead><tr>{cols.map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {act.sources.map((r: any) => {
                            const share = Math.round((r.sessions / totalSessions) * 100);
                            const rate = (n: number) => (r.sessions ? Math.round((n / r.sessions) * 100) : 0);
                            const cellNum = { ...S.td, fontVariantNumeric: 'tabular-nums' as const };
                            const pct = (n: number) => (
                              <>
                                {num(n || 0)}
                                <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                                  {' (' + rate(n || 0) + '%)'}
                                </span>
                              </>
                            );
                            return (
                              <tr key={r.source}>
                                <td style={S.td}><b>{r.source}</b></td>
                                <td style={cellNum}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                    <span>{num(r.sessions)}</span>
                                    <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{share}%</span>
                                  </div>
                                  <div style={{ height: 3, borderRadius: 2, background: 'var(--line-200)',
                                                marginTop: 3, minWidth: 56 }}>
                                    <div style={{ width: share + '%', height: '100%',
                                                  borderRadius: 2, background: '#FFD600' }} />
                                  </div>
                                </td>
                                <td style={cellNum}>{num(r.people || 0)}</td>
                                <td style={cellNum}>
                                  {r.sessions ? (r.views / r.sessions).toFixed(1) : '-'}
                                </td>
                                <td style={cellNum}>{pct(r.added)}</td>
                                <td style={cellNum}>{pct(r.ai)}</td>
                                <td style={cellNum}>{pct(r.signups)}</td>
                                <td style={cellNum}>{pct(r.coupang)}</td>
                                <td style={S.td}>{r.landing || '-'}</td>
                                <td style={{ ...S.td, fontSize: 11.5, color: 'var(--ink-500)' }}>
                                  {dayOf(r.first_at) || '-'} ~ {dayOf(r.last_at) || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 10, lineHeight: 1.7 }}>
                      <b>방문당 화면</b>이 1에 가까우면 첫 화면만 보고 바로 나갔다는 뜻이에요 —
                      그 유입은 사람은 데려오지만 앱을 못 붙잡고 있는 겁니다.
                      <br />
                      <b>첫 화면</b>은 그 유입으로 들어온 사람이 가장 먼저 닿은 화면이에요.
                      광고 링크가 엉뚱한 곳으로 떨어지고 있진 않은지 여기서 확인하세요.
                      <br />
                      광고·게시물 링크 뒤에 <code>?utm_source=instagram</code> 처럼 붙이면
                      어느 글에서 왔는지 이 표에 나뉘어 보입니다
                      (<code>instagram_story</code>, <code>threads_0902</code> 처럼 글마다
                      다르게 붙이면 글 단위로도 볼 수 있어요).
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {(act.features || []).length > 0 && (
            <div style={S.card}>
              <h2 style={S.h2}>어떤 기능을 쓰나</h2>
              <Range>전체 기간 누적 · {spanOf(AP.usage_from, AP.usage_to)}</Range>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{['기능', '쓴 사람', '호출', '크레딧'].map(h => (
                  <th key={h} style={S.th}>{h}</th>))}</tr></thead>
                <tbody>
                  {act.features.map((f: any) => (
                    <tr key={f.kind}>
                      <td style={S.td}>{f.kind === 'vision' ? '사진 인식' : '요리 챗봇'}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{f.users}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(f.calls)}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(f.credits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <h2 style={{ ...S.h2, padding: '16px 16px 0', margin: 0 }}>사람별 활동</h2>
            <div style={{ padding: '0 16px' }}>
              <Range>전체 기간 누적 · 마지막 활동이 최근인 100명</Range>
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700, marginTop: 10 }}>
              {/* 가입일이 있어야 "언제 들어온 사람이 아직 쓰고 있나" 를 읽을 수 있다.
                  마지막 활동만 보면 어제 가입해서 어제 쓴 사람과 반년 전에 가입해
                  계속 쓰는 사람이 똑같아 보인다. */}
              <thead><tr>{['닉네임', '가입일', '재료', '즐겨찾기', '완료', '기록', 'AI', '마지막 활동'].map(h => (
                <th key={h} style={S.th}>{h}</th>))}</tr></thead>
              <tbody>
                {(act.people || []).map((u: any) => (
                  <tr key={u.id}>
                    <td style={S.td}>{u.nickname}</td>
                    <td style={{ ...S.td, fontSize: 12, color: 'var(--ink-500)' }}>
                      {dayOf(u.created_at) || '-'}
                    </td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{u.ingredients}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{u.favorites}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{u.completed}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{u.recorded}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{u.credits}</td>
                    <td style={S.td}>{String(u.last_active || '').replace('T', ' ').slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={S.card}>
        <h2 style={S.h2}>한눈에</h2>
        {/* 타일마다 집계 구간이 다르다. 한 줄로 뭉뚱그리면 '이번 주' 와 '누적' 이
            나란히 놓인 걸 못 알아채므로 **타일마다** 적는다. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            ['전체 사용자', num(data.users?.total ?? 0), '누적 (탈퇴 포함)'],
            ['탈퇴', num(data.users?.deleted ?? 0), '누적'],
            ['식구 그룹 소속', num(data.users?.in_household ?? 0), '지금 이 순간'],
            ['이번 주 크레딧', num(data.this_week?.credits ?? 0), `${dayOf(P.week_start) || '월요일'}부터`],
            ['이번 주 호출', num(data.this_week?.calls ?? 0), `${dayOf(P.week_start) || '월요일'}부터`],
            ['쿠팡 클릭', num(data.coupang_clicks_30d ?? 0), `${dayOf(P.since_30d) || '30일 전'}부터`],
          ].map(([label, value, when]) => (
            <div key={label as string} style={{ background: 'var(--surface-sub)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{label}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#1A1A1E', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-500)', marginTop: 2 }}>{when}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>크레딧 사용 추이</h2>
        {/* 기간 줄과 단위 선택을 **한 줄에** 둔다. 아래위로 나누면 두 줄을
            잡아먹는데, 둘은 "지금 무엇을 보고 있나" 하나를 말하는 정보다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                      flexWrap: 'nowrap', margin: '-4px 0 12px' }}>
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <Range inline>{UNITS[creditUnit].note} · 기록이 없는 칸은 0</Range>
          </div>
          <select
            value={creditUnit}
            onChange={e => setCreditUnit(e.target.value)}
            aria-label="보기 단위"
            style={{ ...S.input, height: 30, flexShrink: 0, fontSize: 12.5, padding: '0 6px' }}
          >
            {Object.keys(UNITS).map(k => (
              <option key={k} value={k}>{UNITS[k].label}</option>
            ))}
          </select>
        </div>
        <DailyBars rows={recent} unit={creditUnit} />
      </div>

      {/* 크레딧 환산이 맞는지 확인하는 자리. 종류별 "크레딧당 실제 토큰"이 크게
          벌어지면 CREDITS_VISION 을 조정한다 — 감으로 바꾸지 말 것. */}
      <div style={S.card}>
        <h2 style={S.h2}>크레딧 환산 점검</h2>
        <Range>전체 기간 누적 · {spanOf(P.usage_from, P.usage_to)}</Range>
        {(data.credit_check || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>토큰이 기록된 호출이 아직 없어요.</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>{['종류', '호출', '평균 토큰', '크레딧당 토큰'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.credit_check.map((r: any) => (
                <tr key={r.kind}>
                  <td style={S.td}>{r.kind === 'vision' ? '사진' : '챗봇'}</td>
                  <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(r.n)}</td>
                  <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(r.avg_tokens || 0)}</td>
                  <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {num(r.tokens_per_credit || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.6 }}>
          두 줄의 <b>크레딧당 토큰</b>이 크게 벌어지면 환산이 어긋난 것입니다.
          그때 <code>CREDITS_VISION</code> 을 조정하세요.
        </div>
      </div>

    </>
  );
};

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  // 대시보드가 첫 탭이다 — 어드민을 여는 이유는 대개 "지금 어떤 상태지" 이기 때문.
  // 사전은 가끔 손보는 것이라 맨 뒤.
  const [tab, setTab] = React.useState<'dashboard' | 'users' | 'requests' | 'ops' | 'dictionary'>('dashboard');
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [policy, setPolicy] = React.useState<any>(null);
  const [keyword, setKeyword] = React.useState('');
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [openId, setOpenId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api('/api/admin/me')
      .then(d => setAllowed(!!d.is_admin))
      .catch(() => setAllowed(false));
  }, []);

  const loadUsers = React.useCallback(() => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (showDeleted) params.set('deleted', '1');
    api(`/api/admin/users?${params}`)
      .then(d => { setUsers(d.users || []); setPolicy(d.policy || null); })
      .catch(e => setError(e.message));
  }, [keyword, showDeleted]);

  React.useEffect(() => {
    if (allowed && tab === 'users') loadUsers();
  }, [allowed, tab, loadUsers]);

  if (allowed === null) {
    return <div style={{ ...S.page, padding: 32 }}>확인 중...</div>;
  }
  if (!allowed) {
    return (
      <div style={{ ...S.page, padding: 32 }}>
        <div style={S.card}>
          <h2 style={S.h2}>관리자만 볼 수 있어요</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>
            관리자 계정으로 로그인한 뒤 다시 들어와 주세요.
          </p>
          <button type="button" style={S.btn} onClick={() => navigate('/')}>홈으로</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>쿡매치 어드민</h1>
        <button type="button" style={S.btn} onClick={() => navigate('/')}>앱으로</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['dashboard', '대시보드'], ['users', '사용자'], ['requests', '요청'], ['ops', '운영'], ['dictionary', '사전']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              ...S.btn,
              background: tab === key ? '#1A1A1E' : '#FFFFFF',
              color: tab === key ? '#FFFFFF' : 'var(--ink-700)',
              border: tab === key ? '1px solid #1A1A1E' : S.btn.border,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' ? (
        <Dashboard />
      ) : tab === 'requests' ? (
        <Requests />
      ) : tab === 'dictionary' ? (
        <Dictionary />
      ) : tab === 'ops' ? (
        <Maintenance />
      ) : (
        <>
          <PolicyCard policy={policy} />

          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadUsers()}
              placeholder="이메일 · 닉네임 검색"
              style={{ ...S.input, flex: 1 }}
            />
            <button type="button" style={S.btn} onClick={loadUsers}>검색</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-500)' }}>
              <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
              탈퇴 포함
            </label>
          </div>

          {error && <div style={{ ...S.card, color: '#D14343' }}>{error}</div>}

          {/* "사용량" 과 "토큰" 이 뭔지 매번 헷갈리므로 표 옆에 적어 둔다. */}
          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.7, padding: '0 4px 8px' }}>
            <b>오늘 / 이번 주</b>는 <b>크레딧</b>이에요 — 챗봇 1, 사진 인식 2.
            사용자에게 보이는 숫자가 이것이고, 한도도 이 단위로 걸립니다.
            둘은 따로 걸려요(일 상한 · 주 한도).
            <br />
            <b>토큰</b>은 LLM 이 실제로 쓴 양(원가)이에요. 화면엔 안 나오고,
            "사진 2크레딧이 적정한가" 를 감이 아니라 근거로 판단하려고 기록만 합니다.
            아직 아무도 AI 를 안 썼다면 전부 0 입니다.
          </div>

          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  {['id', '이메일', '닉네임', '가입', '경로', '재료',
                    '오늘 (일 상한)', '이번 주 (주 한도)', '토큰', '플랜', '탈퇴', '관리'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users || []).map(u => (
                  <React.Fragment key={u.id}>
                    <tr style={{ opacity: u.deleted_at ? 0.5 : 1 }}>
                      <td style={S.td}>{u.id}</td>
                      <td style={S.td}>
                        {u.email}
                        {u.is_admin && (
                          <span style={{
                            marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                            borderRadius: 9999, background: '#FFD600', color: '#1A1A1E',
                          }}>
                            admin
                          </span>
                        )}
                      </td>
                      <td style={S.td}>{u.nickname}</td>
                      <td style={S.td}>{shortDate(u.created_at)}</td>
                      <td style={S.td}>{u.provider}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{u.ingredient_count}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                        {u.today_credits} / {u.daily_cap}
                      </td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                        {u.week_credits} · 잔액 {u.balance}
                      </td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{num(u.week_tokens)}</td>
                      <td style={S.td}>{u.plan}</td>
                      <td style={{ ...S.td, color: '#D14343' }}>{shortDate(u.deleted_at)}</td>
                      <td style={S.td}>
                        <button
                          type="button"
                          style={{ ...S.btn, height: 28, padding: '0 10px' }}
                          onClick={() => setOpenId(openId === u.id ? null : u.id)}
                        >
                          {openId === u.id ? '닫기' : '자세히'}
                        </button>
                      </td>
                    </tr>
                    {openId === u.id && (
                      <tr>
                        <td colSpan={12} style={{ padding: 14, background: 'var(--surface-sub)' }}>
                          {/* 표는 가로로 스크롤되지만 상세 패널까지 늘어나면
                              내용이 화면 밖으로 나간다. 보이는 폭에 묶어 둔다. */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14,
                                        maxWidth: 'min(560px, calc(100vw - 60px))' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>한도 조정</div>
                              <QuotaEditor user={u} onSaved={loadUsers} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>관리자 권한</div>
                              <AdminToggle user={u} onChanged={loadUsers} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>최근 사용 이력</div>
                              <UsageHistory userId={u.id} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {users && users.length === 0 && (
            <div style={S.card}>조건에 맞는 사용자가 없어요.</div>
          )}
        </>
      )}
    </div>
  );
};

export default Admin;
