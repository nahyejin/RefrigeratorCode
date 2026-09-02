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
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="왜 바꾸는지 (필수) — 예: 베타 테스터 요청, 2026-09-02"
        style={{ ...S.input, width: '100%' }}
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
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api('/api/admin/dictionary/misses')
      .then(d => { setMisses(d.misses || []); setPicked(new Set()); setSuggestions(null); })
      .catch(e => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

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
      setNote(d.saved + '개를 사전에 넣었어요. 저장소 CSV 로 옮기려면 scripts/apply_dictionary_additions.py --write 를 돌리세요.');
      load();
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

  /** 제안 하나의 판단을 바꾼다. LLM 이 틀렸을 때 관리자가 고칠 수 있어야 한다. */
  const setDecision = (raw: string, decision: string) => {
    setSuggestions(prev => (prev || []).map(x => (x.raw === raw ? { ...x, decision } : x)));
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
          <button type="button" style={S.btn}
                  onClick={() => setPicked(new Set(unresolved.map(m => m.raw_name)))}>
            안 잡히는 것 모두 고르기
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

      {suggestions && (
        <div style={S.card}>
          <h2 style={S.h2}>제안 — 승인할 것만 남기세요</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
              <thead>
                <tr>{['이름', '판단', '대표어', '분류', '이유'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {suggestions.map(sug => (
                  <tr key={sug.raw} style={{ opacity: sug.decision === 'skip' ? 0.5 : 1 }}>
                    <td style={S.td}><b>{sug.raw}</b></td>
                    <td style={S.td}>
                      <select value={sug.decision}
                              onChange={e => setDecision(sug.raw, e.target.value)}
                              style={{ ...S.input, height: 28 }}>
                        <option value="synonym">동의어</option>
                        <option value="keyword">새 재료</option>
                        <option value="skip">넣지 않음</option>
                      </select>
                    </td>
                    <td style={S.td}>{sug.keyword || '-'}</td>
                    <td style={{ ...S.td, fontSize: 12, color: 'var(--ink-500)' }}>
                      {sug.decision === 'keyword' ? sug['중분류'] + ' / ' + sug['소분류'] : '-'}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'normal', maxWidth: 260, fontSize: 12,
                                 color: 'var(--ink-500)' }}>{sug.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" style={S.primary} disabled={!!busy} onClick={applyApproved}>
              {busy === '반영 중...' ? busy : '사전에 반영'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.6 }}>
            반영하면 <b>바로 인식에 쓰입니다</b>(서버가 사전을 다시 읽어요).
            다만 저장소의 CSV 는 아직 그대로예요 — 서버가 도는 곳은 파일시스템이
            임시라 거기 쓴 건 다음 배포에 사라집니다. 정식으로 옮기려면
            <code> scripts/apply_dictionary_additions.py --write</code> 를 돌리세요.
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
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api('/api/admin/dashboard').then(setData).catch(e => setError(e.message));
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

      {(data.dictionary_misses || []).length > 0 && (
        <div style={S.card}>
          <h2 style={S.h2}>사전에 없던 이름 (상위 15)</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.dictionary_misses.map((m: any) => (
              <span
                key={m.raw_name}
                style={{
                  fontSize: 12, padding: '4px 9px', borderRadius: 9999,
                  border: '1px dashed var(--line-300)', color: 'var(--ink-700)',
                }}
              >
                {m.raw_name} <b>{m.hit_count}</b>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8 }}>
            전부 사전에 넣는 게 아닙니다 — 요리 이름·주류 브랜드는 제외
            (INGREDIENT_RECOGNITION_FEATURE.md 참고).
          </div>
        </div>
      )}
    </>
  );
};

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const [tab, setTab] = React.useState<'users' | 'requests' | 'dictionary' | 'ops' | 'dashboard'>('users');
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
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
      .then(d => setUsers(d.users || []))
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
        {([['users', '사용자'], ['requests', '요청'], ['dictionary', '사전'], ['ops', '운영'], ['dashboard', '대시보드']] as const).map(([key, label]) => (
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

          <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  {['id', '이메일', '닉네임', '가입', '경로', '재료', '이번 주', '토큰', '플랜', '탈퇴', ''].map(h => (
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
                        <td colSpan={11} style={{ padding: 14, background: 'var(--surface-sub)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>한도 조정</div>
                              <QuotaEditor user={u} onSaved={loadUsers} />
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
