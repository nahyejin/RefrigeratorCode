import * as React from 'react';
import Sheet from './ui/Sheet';
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
  created_at: string;
};

type Line = {
  key: string;
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

const FridgeHistorySheet: React.FC<{ open: boolean; onClose: () => void; userId: number }> = ({
  open, onClose, userId,
}) => {
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
  }, [open, userId]);

  const days = React.useMemo(() => {
    if (state.status !== 'ok') return [];
    const out: { key: string; lines: Line[] }[] = [];
    for (const l of toLines(state.items, userId)) {
      const k = dayKey(l.at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.lines.push(l);
      else out.push({ key: k, lines: [l] });
    }
    return out;
  }, [state, userId]);

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
              {day.lines.map(l => (
                <div key={l.key} style={{ display: 'flex', gap: 10, padding: '9px 0',
                                          borderTop: '1px solid var(--line-200)' }}>
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                    background: state.memberIds.includes(l.actorId)
                      ? colorForUser(l.actorId, state.memberIds) : 'var(--ink-300)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: '#1A1A1E', lineHeight: 1.45 }}>
                      {state.shared && <b style={{ fontWeight: 700, marginRight: 4 }}>{l.actor}</b>}
                      {headline(l)}
                    </div>
                    {subline(l) && (
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1, lineHeight: 1.5,
                                    wordBreak: 'keep-all' }}>
                        {subline(l)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-500)', flexShrink: 0, marginTop: 2 }}>
                    {timeLabel(l.at)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
};

export default FridgeHistorySheet;
