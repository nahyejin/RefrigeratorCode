import * as React from 'react';
import Sheet from './ui/Sheet';
import Dialog from './ui/Dialog';
import { colorForUser } from '../utils/memberColors';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

/**
 * 내냉장고 「재료 기록」 — 누가 무슨 재료를 언제 담고·빼고·옮기고·바꿨나 (2026-10-17).
 *
 * 왜: "재료가 뭔가 추가된 것 같은데 뭔지 모르겠다" — 특히 식구 그룹이면 냉장고 하나를 여럿이
 * 써서 더 그렇다(사용자 요청). 서버가 저장할 때마다 전·후를 견줘 남긴 것(`fridge_history`)을
 * 날짜별로 보여 준다. 보관은 3달.
 *
 * 한 번에 담은 것은 한 줄로 묶는다 — 영수증 사진 한 장에 12개를 담으면 12줄이 아니라
 * "사진으로 12개 담음" 한 줄과 그 아래 이름들.
 *
 * 히스토리 관리 (2026-10-19): 저장 한 번(batch)마다 오른쪽에 버튼 하나.
 * (처음엔 [실행 취소] 도 있었는데 둘이 있으니 헷갈린다고 해서 뺐다. 서버의 mode='undo' 는 남겨 둔다.)
 *   [이 변경 전으로] 그 저장 **직전** 상태로 냉장고 전체를 — 그 뒤의 저장도 함께 되돌아간다
 *   (「이 버전으로 복원」 은 '그 변경이 반영된 뒤' 로 읽혀서, 뺀 기록에서 누르면 빈 냉장고가 된다 — 헷갈려 이름을 바꿈)
 * 누르면 확인 팝업을 띄우고, 되돌린 것도 기록에 한 줄로 남는다(그 줄을 다시 취소할 수 있다).
 * 하지도 않은 「40개 뺌」이 기록된 사고(2026-10-19) 뒤 사용자 요청.
 */

type Item = {
  id: number;
  actor_user_id: number;
  actor_nickname: string | null;
  batch_id: string;
  action: 'add' | 'remove' | 'move' | 'update';
  name: string;
  box: string | null;
  from_box: string | null;
  detail: string | null;
  source: string | null;
  ref_batch?: string | null;
  created_at: string;
};

type Line = {
  key: string;
  batch: string;
  refBatch: string | null;
  actorId: number;
  actor: string;
  action: Item['action'];
  source: string | null;
  names: string[];
  box: string | null;
  from_box: string | null;
  detail: string | null;
  at: string;
};

const BOX: Record<string, string> = { frozen: '냉동', fridge: '냉장', room: '실온' };
const boxName = (b: string | null) => (b && BOX[b]) || '';

/** 담음·뺌은 같은 저장(batch)끼리 한 줄로, 옮김·바꿈은 재료마다 한 줄. */
function toLines(items: Item[], myId: number): Line[] {
  const lines: Line[] = [];
  const byKey = new Map<string, Line>();
  for (const it of items) {
    const groupable = it.action === 'add' || it.action === 'remove';
    const key = groupable ? `${it.batch_id}:${it.action}` : `i${it.id}`;
    const found = byKey.get(key);
    if (found) {
      found.names.push(it.name);
      // 한 번에 담은 것이 여러 칸에 걸치면 칸 이름은 보이지 않는다
      if (found.box !== it.box) found.box = null;
      continue;
    }
    const line: Line = {
      key,
      batch: it.batch_id,
      refBatch: it.ref_batch || null,
      actorId: it.actor_user_id,
      actor: it.actor_user_id === myId ? '나' : it.actor_nickname || '나간 식구',
      action: it.action,
      source: it.source,
      names: [it.name],
      box: it.box,
      from_box: it.from_box,
      detail: it.detail,
      at: it.created_at,
    };
    byKey.set(key, line);
    lines.push(line);
  }
  return lines;
}

/** "expiry:2026-10-20>2026-10-26" → "유통기한 10/20 → 10/26" */
function dateChange(detail: string | null): string {
  if (!detail) return '';
  const [key, rest] = detail.split(':');
  const [a, b] = (rest || '').split('>');
  const md = (s: string) => (s ? s.slice(5).replace('-', '/') : '없음');
  return `${key === 'expiry' ? '유통기한' : '구매일'} ${md(a)} → ${md(b)}`;
}

function headline(l: Line): string {
  const n = l.names.length;
  const what = n === 1 ? l.names[0] : `${n}개`;
  if (l.source === 'undo' || l.source === 'restore') {
    const how = l.source === 'undo' ? '실행 취소' : '복원';
    if (l.action === 'add') return `${how}로 ${what} 되살림`;
    if (l.action === 'remove') return `${how}로 ${what} 뺌`;
    if (l.action === 'move') return `${how}로 ${what} 옮김`;
    return `${how}로 ${what} 날짜 바꿈`;
  }
  if (l.source === 'household') {
    // 식구 그룹 만들기·참여(재료 합치기)·나가기로 바뀐 것
    if (l.action === 'add') return `식구 그룹 냉장고 합치며 ${what} 담음`;
    if (l.action === 'remove') return `식구 그룹 정리로 ${what} 뺌`;
  }
  if (l.action === 'add') {
    const how = l.source === 'photo' ? '사진으로 ' : l.source === 'shopping' ? '장보기에서 ' : '';
    return `${how}${what} 담음`;
  }
  if (l.action === 'remove') return l.source === 'cooked' ? `요리하고 ${what} 다 씀` : `${what} 뺌`;
  if (l.action === 'move') return `${what} 옮김`;
  return `${what} 날짜 바꿈`;
}

function subline(l: Line): string {
  if (l.action === 'move') return `${boxName(l.from_box)} → ${boxName(l.box)}${l.detail ? ` · ${dateChange(l.detail)}` : ''}`;
  if (l.action === 'update') return dateChange(l.detail);
  const where = boxName(l.box);
  if (l.names.length > 1) return l.names.join(', ') + (where ? ` · ${where}` : '');
  return where;
}

const dayKey = (iso: string) => iso.slice(0, 10);
function dayLabel(key: string): string {
  const today = new Date();
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (key === ymd(today)) return '오늘';
  if (key === ymd(yest)) return '어제';
  const d = new Date(key + 'T12:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
}
function timeLabel(iso: string): string {
  const h = Number(iso.slice(11, 13));
  const m = iso.slice(14, 16);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

/** 같은 저장(batch)의 줄들 — 버튼은 저장 단위로 한 벌 */
type Entry = { batch: string; lines: Line[]; at: string };

const smallBtn: React.CSSProperties = {
  height: 26, padding: '0 9px', borderRadius: 9999, border: '1px solid var(--line-200)',
  background: 'var(--surface)', color: 'var(--ink-700, #3A3A40)', fontSize: 11.5, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const FridgeHistorySheet: React.FC<{
  open: boolean; onClose: () => void; userId: number;
  /** 되돌리기가 끝나면 — 내냉장고 화면이 서버 목록을 다시 받아 온다 */
  onReverted?: () => void | Promise<void>;
}> = ({
  open, onClose, userId, onReverted,
}) => {
  const [reload, setReload] = React.useState(0);
  const [confirm, setConfirm] = React.useState<{ entry: Entry; mode: 'undo' | 'restore'; later: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  /** 확인 팝업 미리보기 — 되돌리면 재료가 몇 개가 되나(서버 dry_run) */
  const [preview, setPreview] = React.useState<
    { before_count: number; after_count: number; by_source: Record<string, number> } | 'loading' | 'error' | null
  >(null);
  React.useEffect(() => {
    if (!confirm) { setPreview(null); return; }
    let alive = true;
    setPreview('loading');
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(`${API_BASE_URL}/api/users/${userId}/ingredients/history/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch_id: confirm.entry.batch, mode: confirm.mode, dry_run: true }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => alive && setPreview({ before_count: d.before_count, after_count: d.after_count, by_source: d.by_source || {} }))
      .catch(() => alive && setPreview('error'));
    return () => { alive = false; };
  }, [confirm, userId]);
  const [state, setState] = React.useState<
    { status: 'loading' } | { status: 'error' } |
    { status: 'ok'; items: Item[]; shared: boolean; keepDays: number; restoreDays: number; memberIds: number[] }
  >({ status: 'loading' });

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setState({ status: 'loading' });
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(`${API_BASE_URL}/api/users/${userId}/ingredients/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => {
        if (!alive) return;
        setState({
          status: 'ok', items: d.items || [], shared: !!d.shared,
          keepDays: d.keep_days || 90, restoreDays: d.restore_days || 14, memberIds: d.member_ids || [userId],
        });
      })
      .catch(() => alive && setState({ status: 'error' }));
    return () => { alive = false; };
  }, [open, userId, reload]);

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const runRevert = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const r = await fetch(`${API_BASE_URL}/api/users/${userId}/ingredients/history/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ batch_id: confirm.entry.batch, mode: confirm.mode }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || '되돌리지 못했어요. 잠시 뒤 다시 해 주세요.');
      setNotice(d.changed ? '되돌렸어요' : '이미 그 상태예요');
      setConfirm(null);
      setReload(n => n + 1);
      await onReverted?.();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '되돌리지 못했어요.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const { days, entries, atOf, undone } = React.useMemo(() => {
    const empty = { days: [] as { key: string; entries: Entry[] }[], entries: [] as Entry[],
                    atOf: new Map<string, string>(), undone: new Set<string>() };
    if (state.status !== 'ok') return empty;
    const entries: Entry[] = [];
    for (const l of toLines(state.items, userId)) {
      const last = entries[entries.length - 1];
      if (last && last.batch === l.batch) last.lines.push(l);
      else entries.push({ batch: l.batch, lines: [l], at: l.at });
    }
    const days: { key: string; entries: Entry[] }[] = [];
    for (const e of entries) {
      const k = dayKey(e.at);
      const last = days[days.length - 1];
      if (last && last.key === k) last.entries.push(e);
      else days.push({ key: k, entries: [e] });
    }
    const atOf = new Map(entries.map(e => [e.batch, e.at]));
    // 실행 취소된 저장 — 「취소됨」 표시. 최근 것부터 보며, 취소한 줄 자체가 다시 취소됐으면 원래대로 둔다.
    const undone = new Set<string>();
    for (const e of entries) {
      const l = e.lines[0];
      if (l.source === 'undo' && l.refBatch && !undone.has(e.batch)) undone.add(l.refBatch);
    }
    return { days, entries, atOf, undone };
  }, [state, userId]);

  const ask = (entry: Entry, mode: 'undo' | 'restore') =>
    setConfirm({ entry, mode, later: entries.findIndex(e => e.batch === entry.batch) });

  /** 다른 화면에서 생긴 냉장고 변경 — "장보기 2개·요리 완료 1개". 그 화면의 체크·기록은 그대로 남는다 */
  const otherSources = (p: typeof preview): string => {
    if (!p || typeof p === 'string') return '';
    const label: Record<string, string> = { shopping: '장보기', cooked: '요리 완료', household: '식구 그룹' };
    return Object.entries(p.by_source)
      .filter(([k, n]) => label[k] && n > 0)
      .map(([k, n]) => `${label[k]} ${n}개`)
      .join('·');
  };

  const when = (iso: string) => `${dayLabel(dayKey(iso))} ${timeLabel(iso)}`;

  /**
   * 「이 변경 전으로」 가 몇 시 상태인지 — "직전" 이라는 말이 헷갈려서(2026-10-19) 시각으로 보여 준다.
   * 바로 앞 기록이 있으면 그 시각의 상태와 같으니 "오전 12:20 상태로", 없으면 "오전 12:28 이전 상태로".
   */
  const targetLabel = (entry: Entry) => {
    const i = entries.findIndex(x => x.batch === entry.batch);
    const prev = i >= 0 ? entries[i + 1] : undefined;
    return prev ? `${when(prev.at)} 상태로` : `${when(entry.at)} 이전 상태로`;
  };

  return (
    <Sheet open={open} onClose={onClose} title="재료 기록" maxHeight="80dvh">
      {state.status === 'loading' && (
        <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '12px 0' }}>불러오는 중…</div>
      )}
      {state.status === 'error' && (
        <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '12px 0' }}>
          기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </div>
      )}
      {state.status === 'ok' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', margin: '0 0 6px', lineHeight: 1.5 }}>
            {state.shared ? '우리 식구 냉장고' : '내 냉장고'} 최근 {Math.round(state.keepDays / 30)}달 기록이에요.<br />
            최근 {state.restoreDays}일 변경은 되돌릴 수 있어요.
          </div>
          {days.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '16px 0', lineHeight: 1.6 }}>
              아직 기록이 없어요. 이제부터 재료를 담고, 빼고, 옮기면 여기에 남아요.
            </div>
          )}
          {days.map(day => (
            <div key={day.key}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1E', margin: '12px 0 2px' }}>
                {dayLabel(day.key)}
              </div>
              {day.entries.map(e => {
                const isUndone = undone.has(e.batch);
                return (
                  <div key={e.batch} style={{ display: 'flex', gap: 10, padding: '9px 0',
                                              borderTop: '1px solid var(--line-200)',
                                              opacity: isUndone ? 0.55 : 1 }}>
                    <span aria-hidden style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: state.memberIds.includes(e.lines[0].actorId)
                        ? colorForUser(e.lines[0].actorId, state.memberIds) : 'var(--ink-300)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {e.lines.map(l => (
                        <div key={l.key} style={{ marginBottom: 2 }}>
                          <div style={{ fontSize: 13.5, color: '#1A1A1E', lineHeight: 1.45 }}>
                            {state.shared && <b style={{ fontWeight: 700, marginRight: 4 }}>{l.actor}</b>}
                            {headline(l)}
                            {/* 사람이 직접 한 게 아니라 기기가 서버와 맞추며 바꾼 것 — "내가 안 했는데?" 를 구분하게(2026-10-19) */}
                            {l.source === 'sync' && (
                              <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
                                             height: 18, padding: '0 7px', borderRadius: 9999, verticalAlign: 1,
                                             background: '#EEF2FF', color: '#4F5BD5', fontSize: 10.5, fontWeight: 700 }}>
                                <span aria-hidden style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                                기기 동기화
                              </span>
                            )}
                            {isUndone && l === e.lines[0] && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-500)' }}>취소됨</span>
                            )}
                          </div>
                          {subline(l) && (
                            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1, lineHeight: 1.5,
                                          wordBreak: 'keep-all' }}>
                              {subline(l)}
                            </div>
                          )}
                        </div>
                      ))}
                      {e.lines[0].refBatch && atOf.get(e.lines[0].refBatch) && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 1 }}>
                          ↩ {when(atOf.get(e.lines[0].refBatch) as string)} 기록을 {e.lines[0].source === 'undo' ? '취소' : '기준으로 복원'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5,
                                  flexShrink: 0 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
                        {timeLabel(e.at)}
                      </span>
                      {/* 버튼은 하나만 — 실행 취소와 둘이 있으니 헷갈린다(2026-10-19 사용자 요청).
                          최근 restoreDays(14일) 기록에만 단다 — 서버 RESTORE_DAYS 설명 참고 */}
                      {Date.now() - new Date(e.at).getTime() < state.restoreDays * 86400000 && (
                      <button type="button" style={{ ...smallBtn, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              onClick={() => ask(e, 'restore')}
                              aria-label={`${when(e.at)} 변경 전 상태로 복원`}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                        이 변경 전으로
                      </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
      {notice && (
        <div role="status" style={{ position: 'sticky', bottom: 8, margin: '12px auto 0', width: 'fit-content',
                                    padding: '8px 14px', borderRadius: 9999, background: 'rgba(26,26,30,0.88)',
                                    color: '#fff', fontSize: 12.5 }}>
          {notice}
        </div>
      )}
      {/* 확인 팝업 — 짧게(2026-10-19 요청): 몇 시 상태로 돌아가는지 + 재료가 몇 개가 되는지만 */}
      <Dialog
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        nested
        width={320}
        title="이 시점으로 되돌릴까요?"
        actions={[
          { label: '취소', onClick: () => setConfirm(null), variant: 'outline' },
          { label: busy ? '되돌리는 중…' : '되돌리기', onClick: runRevert, variant: 'primary' },
        ]}
      >
        {confirm && (
          <div style={{ fontSize: 13, color: 'var(--ink-700, #3A3A40)', lineHeight: 1.55, wordBreak: 'keep-all',
                        textAlign: 'center' }}>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--line-100, #F4F4F6)',
                          marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>{targetLabel(confirm.entry)}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>
                {preview === 'loading' ? (
                  <span style={{ color: 'var(--ink-500)' }}>재료 수 계산 중…</span>
                ) : preview === 'error' || !preview ? (
                  <span style={{ color: 'var(--ink-500)' }}>재료 수를 불러오지 못했어요</span>
                ) : (
                  <>재료 {preview.before_count}개 → <b style={{ color: '#1A1A1E' }}>{preview.after_count}개</b></>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
              {`변경 ${confirm.later + 1}건이 되돌아가요`}
              {otherSources(preview) && <> · <b style={{ color: 'var(--ink-700, #3A3A40)' }}>{otherSources(preview)} 포함</b></>}
              {state.status === 'ok' && state.shared ? ' (식구 것 포함)' : ''}.<br />
              되돌린 것도 기록에 남아요.
            </div>
          </div>
        )}
      </Dialog>
    </Sheet>
  );
};

export default FridgeHistorySheet;
