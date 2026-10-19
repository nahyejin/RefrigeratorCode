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
 * 히스토리 관리 (2026-10-19): 저장 한 번(batch)마다 오른쪽에 두 버튼.
 *   [실행 취소]    그 저장 하나만 거꾸로 — 그 뒤에 바꾼 재료는 그대로
 *   [이전으로 복원] 그 저장 **직전** 상태로 냉장고 전체를 — 그 뒤의 저장도 함께 되돌아간다
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

function summary(lines: Line[]): string {
  return lines.map(headline).join(' · ');
}

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
  const [state, setState] = React.useState<
    { status: 'loading' } | { status: 'error' } |
    { status: 'ok'; items: Item[]; shared: boolean; keepDays: number; memberIds: number[] }
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
          keepDays: d.keep_days || 90, memberIds: d.member_ids || [userId],
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
      setNotice(d.changed ? (confirm.mode === 'undo' ? '실행 취소했어요' : '그 시점 이전으로 복원했어요') : '이미 그 상태예요');
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

  const when = (iso: string) => `${dayLabel(dayKey(iso))} ${timeLabel(iso)}`;

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
          <div style={{ fontSize: 12, color: 'var(--ink-500)', margin: '0 0 6px' }}>
            {state.shared ? '우리 식구 냉장고' : '내 냉장고'} · 최근 {Math.round(state.keepDays / 30)}달
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
                const newest = e.batch === entries[0]?.batch;
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
                      <button type="button" style={smallBtn} onClick={() => ask(e, 'undo')}
                              aria-label={`${when(e.at)} 변경 실행 취소`}>
                        실행 취소
                      </button>
                      {/* 가장 최근 저장이면 「이전으로 복원」 은 실행 취소와 같다 — 하나만 보인다 */}
                      {!newest && (
                        <button type="button" style={smallBtn} onClick={() => ask(e, 'restore')}
                                aria-label={`${when(e.at)} 변경 이전으로 복원`}>
                          이전으로 복원
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
      <Dialog
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        nested
        width={360}
        title={confirm?.mode === 'undo' ? '이 변경을 실행 취소할까요?' : '이 변경 이전으로 복원할까요?'}
        actions={[
          { label: '닫기', onClick: () => setConfirm(null), variant: 'outline' },
          { label: busy ? '되돌리는 중…' : (confirm?.mode === 'undo' ? '실행 취소' : '복원하기'),
            onClick: runRevert, variant: 'primary' },
        ]}
      >
        {confirm && (
          <div style={{ fontSize: 13, color: 'var(--ink-700, #3A3A40)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--line-100, #F4F4F6)',
                          marginBottom: 10 }}>
              <b>{when(confirm.entry.at)}</b><br />{summary(confirm.entry.lines)}
            </div>
            {confirm.mode === 'undo' ? (
              <p style={{ margin: '0 0 8px' }}>이 변경만 거꾸로 되돌려요. 그 뒤에 바꾼 재료는 그대로 둬요.</p>
            ) : (
              <p style={{ margin: '0 0 8px' }}>
                냉장고 전체를 이 변경 <b>직전</b> 상태로 되돌려요.
                {confirm.later > 0 && <> 그 뒤에 한 변경 <b>{confirm.later}건</b>도 함께 되돌아가요.</>}
                {state.status === 'ok' && state.shared && <> 식구가 바꾼 것도 포함돼요.</>}
              </p>
            )}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-500)' }}>
              지금 냉장고가 바뀌며 원래대로 되돌리기 어려울 수 있어요. 되돌린 내용은 재료 기록에 남아서,
              그 줄의 [실행 취소]로 다시 돌릴 수 있어요. 날짜가 기록되지 않은 예전 재료는 이름과 보관 칸만 돌아와요.
            </p>
          </div>
        )}
      </Dialog>
    </Sheet>
  );
};

export default FridgeHistorySheet;
