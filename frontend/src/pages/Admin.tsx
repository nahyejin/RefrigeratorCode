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
  weekly_limit: number;
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
  const free = (policy.plans || []).find((p: any) => p.key === 'free');

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
              <thead><tr>{['구분', '주 한도', '일 상한'].map(h => (
                <th key={h} style={S.th}>{h}</th>))}</tr></thead>
              <tbody>
                {(policy.plans || []).map((p: any) => (
                  <tr key={p.key}>
                    <td style={S.td}>{label[p.key] || p.key}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{p.weekly}</td>
                    <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{p.daily}</td>
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
            <b>주 한도와 일 상한을 함께 두는 이유</b>
            <br />
            냉장고 재료 등록은 <b>장 본 날 하루에 몰린다.</b> 일별만 걸면 그날 막혀서
            첫 사용 경험이 차단으로 끝나고, 주별만 걸면 첫날 한 주치를 태우고 6일을 못 쓴다.
            <br />
            <br />
            <b>리셋</b> — 매주 월요일 00:00 (다음: {String(policy.resets_at || '').slice(0, 10)}).
            고정 요일이라 사용자가 언제 채워지는지 예측할 수 있다.
          </div>

          {free && (
            <div style={{ background: 'var(--surface-sub)', borderRadius: 10, padding: '12px 14px',
                          fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.8 }}>
              <b>주 {free.weekly} 이 실제로 얼마인가</b>
              <br />
              · 챗봇만 쓰면 <b>{Math.floor(free.weekly / chat)}회</b> 질문
              <br />
              · 사진만 쓰면 <b>{Math.floor(free.weekly / vision)}회</b> 인식
              <br />
              · 첫 주 전형 — 영수증 2장 + 재료 사진 5회 + 챗봇 10회
              = {2 * vision + 5 * vision + 10 * chat} 크레딧 (쓰고도 {free.weekly - (2 * vision + 5 * vision + 10 * chat)} 남음)
              <br />
              · 일 상한 {free.daily} 이면 세팅하는 날 사진 인식 {Math.floor(free.daily / vision)}회 가능
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.7 }}>
            <b>올려 줄 때</b>: 아래 사용자 목록 → <b>자세히</b> → 한도 조정에서 숫자를 직접
            적으면 그 사람에게만 적용됩니다. <b>메모는 필수</b>예요 — 몇 달 뒤에
            왜 이 사람만 다른지 알 수 없게 됩니다.
            <br />
            <b>기준을 바꿀 때</b>: 감으로 바꾸지 말고 대시보드의 <b>크레딧 환산 점검</b>
            (종류별 크레딧당 실제 토큰)을 먼저 보세요. 값 자체는 환경변수
            <code> QUOTA_FREE_WEEKLY</code> 등으로 조정합니다.
          </div>
        </div>
      )}
    </div>
  );
};

/** 한도 조정 패널. 메모를 안 적으면 저장되지 않는다 (서버도 막는다). */
const QuotaEditor: React.FC<{ user: AdminUser; onSaved: () => void }> = ({ user, onSaved }) => {
  const [plan, setPlan] = React.useState(user.plan);
  const [weekly, setWeekly] = React.useState(String(user.weekly_limit));
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
          weekly_limit: weekly === '' ? null : Number(weekly),
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
      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.6 }}>
        플랜 기본값은 <b>free 주 100 / 일 40</b>, <b>plus 주 400 / 일 100</b> 이에요.
        숫자를 직접 적으면 이 사람에게만 그 값이 적용됩니다 (요청이 오면 여기서 늘려 주세요).
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={plan} onChange={e => setPlan(e.target.value)} style={S.input}>
          <option value="free">free</option>
          <option value="plus">plus</option>
        </select>
        <label style={{ fontSize: 12, color: 'var(--ink-500)' }}>
          주{' '}
          <input value={weekly} onChange={e => setWeekly(e.target.value)} style={{ ...S.input, width: 72 }} />
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
}> = ({ sug, opts, onPatch, onTarget }) => {
  const skip = sug.decision === 'skip';
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
          onChange={e => onPatch({ decision: e.target.value })}
          style={{ ...S.input, height: 30 }}
        >
          <option value="synonym">기존 재료의 다른 이름</option>
          <option value="keyword">새 재료로 추가</option>
          <option value="skip">넣지 않음</option>
        </select>
      </div>

      {sug.decision === 'synonym' && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>어느 재료의 다른 이름인가요?</span>
            <input
              list="dict-keywords"
              value={sug.keyword || ''}
              onChange={e => onTarget(e.target.value)}
              placeholder="대표어 검색"
              style={{ ...S.input, height: 30, minWidth: 160 }}
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
    setBusy('제안 받는 중...'); setError(null); setNote(null);
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
        <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6, marginBottom: 12 }}>
          사진에서 읽혔지만 사전에 없어 담지 못한 것들이에요. 넣을 것을 고른 뒤
          <b> 제안 받기</b>를 누르면 어느 분류에 넣을지, 기존 재료의 다른 이름인지를
          알려 줘요. <b>승인한 것만</b> 사전에 들어갑니다.
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
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {misses.map(m => {
              const on = picked.has(m.raw_name);
              const solved = !!m.now_resolves_to;
              return (
                <button
                  key={m.raw_name}
                  type="button"
                  onClick={() => { if (!solved) toggle(m.raw_name); }}
                  title={solved ? ('이제 ' + m.now_resolves_to + ' 로 잡혀요') : (m.hit_count + '번 걸림')}
                  style={{
                    fontSize: 12, padding: '5px 10px', borderRadius: 9999,
                    cursor: solved ? 'default' : 'pointer',
                    border: on ? '1px solid #1A1A1E' : '1px dashed var(--line-300)',
                    background: on ? '#FFD600' : solved ? 'var(--surface-sub)' : '#FFFFFF',
                    color: solved ? 'var(--ink-500)' : 'var(--ink-900)',
                    textDecoration: solved ? 'line-through' : 'none',
                  }}
                >
                  {m.raw_name} <b>{m.hit_count}</b>
                  {solved ? ' → ' + m.now_resolves_to : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 동의어 대상 자동완성. 1,300개를 select 로 두면 못 고른다. */}
      <datalist id="dict-keywords">
        {(opts?.keywords || []).map(k => <option key={k} value={k} />)}
      </datalist>

      {additions && additions.length > 0 && (
        <div style={S.card}>
          <h2 style={S.h2}>사전에 보탠 것 {additions.length}건</h2>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10, lineHeight: 1.6 }}>
            <b>바로</b> 는 이미 인식에 쓰이고 있다는 뜻이고, <b>대기</b> 는 저장소의 사전
            파일로 아직 안 옮겨졌다는 뜻이에요 — 매일 새벽 4시 30분에 자동으로 옮겨집니다.
            (서버가 도는 곳은 파일시스템이 임시라 서버가 직접 못 고쳐요)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
              <thead><tr>{['이름', '어디로', '분류', '파일 반영'].map(h => (
                <th key={h} style={S.th}>{h}</th>))}</tr></thead>
              <tbody>
                {additions.map((a: any) => (
                  <tr key={a.raw_name}>
                    <td style={S.td}><b>{a.raw_name}</b></td>
                    <td style={S.td}>
                      {a.kind === 'synonym' ? a.keyword + ' 의 다른 이름' : '새 재료 ' + a.keyword}
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: 'var(--ink-500)' }}>
                      {[a['중분류'], a['소분류']].filter(Boolean).join(' › ') || '-'}
                    </td>
                    <td style={{ ...S.td, color: a.applied_to_csv ? 'var(--ink-500)' : '#B4780A',
                                 fontWeight: a.applied_to_csv ? 400 : 700 }}>
                      {a.applied_to_csv ? '완료' : '대기'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

const Dashboard: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [act, setAct] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api('/api/admin/dashboard').then(setData).catch(e => setError(e.message));
    api('/api/admin/activity').then(setAct).catch(() => {});
  }, []);

  if (error) return <div style={S.card}>{error}</div>;
  if (!data) return <div style={S.card}>불러오는 중...</div>;

  const daily: any[] = data.usage_daily || [];
  const byDate = new Map<string, number>();
  daily.forEach(d => byDate.set(d.date, (byDate.get(d.date) || 0) + d.credits));
  const recent = [...byDate.entries()].sort().slice(-14);
  const peak = Math.max(1, ...recent.map(([, v]) => v));

  return (
    <>
      {act && (
        <>
          <div style={S.card}>
            <h2 style={S.h2}>어디까지 오고 어디서 멈추나</h2>
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
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 12, lineHeight: 1.6 }}>
                방문 {act.sessions?.total ?? 0}회 · 사람 {act.sessions?.people ?? 0}명 ·
                두 번 이상 온 사람 <b>{act.sessions?.returning ?? 0}명</b>
                {(act.sessions?.people ?? 0) > 0 &&
                  ' (' + Math.round(((act.sessions?.returning ?? 0) / act.sessions.people) * 100) + '%)'}
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

              {(act.sources || []).length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>어디서 들어왔나</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {act.sources.map((r: any) => (
                      <span key={r.source} style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 9999,
                        background: 'var(--surface-sub)', color: 'var(--ink-700)',
                      }}>
                        {r.source} <b>{r.n}</b>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.6 }}>
                    광고·게시물 링크 뒤에 <code>?utm_source=instagram</code> 처럼 붙이면
                    어느 글에서 왔는지 여기 나뉘어 보입니다.
                  </div>
                </div>
              )}
            </div>
          )}

          {(act.features || []).length > 0 && (
            <div style={S.card}>
              <h2 style={S.h2}>어떤 기능을 쓰나</h2>
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
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620, marginTop: 10 }}>
              <thead><tr>{['닉네임', '재료', '즐겨찾기', '완료', '기록', 'AI', '마지막 활동'].map(h => (
                <th key={h} style={S.th}>{h}</th>))}</tr></thead>
              <tbody>
                {(act.people || []).map((u: any) => (
                  <tr key={u.id}>
                    <td style={S.td}>{u.nickname}</td>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
          {[
            ['전체 사용자', num(data.users?.total ?? 0)],
            ['탈퇴', num(data.users?.deleted ?? 0)],
            ['식구 그룹 소속', num(data.users?.in_household ?? 0)],
            ['이번 주 크레딧', num(data.this_week?.credits ?? 0)],
            ['이번 주 호출', num(data.this_week?.calls ?? 0)],
            ['쿠팡 클릭(30일)', num(data.coupang_clicks_30d ?? 0)],
          ].map(([label, value]) => (
            <div key={label as string} style={{ background: 'var(--surface-sub)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{label}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#1A1A1E', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>일별 크레딧 (최근 2주)</h2>
        {recent.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>아직 사용 기록이 없어요.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
            {recent.map(([date, value]) => (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  title={`${date} · ${value}`}
                  style={{
                    width: '100%', height: `${(value / peak) * 64}px`, minHeight: value ? 3 : 0,
                    background: '#FFD600', borderRadius: '4px 4px 0 0',
                  }}
                />
                <span style={{ fontSize: 9, color: 'var(--ink-500)' }}>{date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 크레딧 환산이 맞는지 확인하는 자리. 종류별 "크레딧당 실제 토큰"이 크게
          벌어지면 CREDITS_VISION 을 조정한다 — 감으로 바꾸지 말 것. */}
      <div style={S.card}>
        <h2 style={S.h2}>크레딧 환산 점검</h2>
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
                        {u.week_credits} / {u.weekly_limit}
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
