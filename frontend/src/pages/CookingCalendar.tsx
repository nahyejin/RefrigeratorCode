import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { getProxiedImageUrl } from '../utils/imageUtils';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarEntry {
  day: string; // YYYY-MM-DD
  created_at: string; // ISO timestamp
  recipe_id: number;
  title: string;
  thumbnail: string;
  user_id: number;
  nickname: string;
}

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay());
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 그룹원을 색으로 구분하기 위한 팔레트. 인원이 적어(보통 2~4명) 이 정도면 충분하고,
// 브랜드 강조색(노랑)과 겹치지 않는 톤으로 골랐다.
const MEMBER_COLORS = ['#3B82F6', '#F97316', '#22C55E', '#A855F7', '#EF4444', '#06B6D4'];

function colorForUser(userId: number, orderedIds: number[]): string {
  const idx = orderedIds.indexOf(userId);
  return MEMBER_COLORS[idx % MEMBER_COLORS.length];
}

/**
 * 요리 캘린더 — 완료한 레시피를 날짜별로 돌아보는 화면.
 *
 * 처음엔 마이페이지 하위 화면으로 뒀는데, 기능이 생각보다 커져서(일/주/월,
 * 그룹원별 통계, 월 목표) 하단 탭으로 옮겼다. 그룹에 속해 있으면(공유
 * 설정한 멤버 기준) 날짜별로 누가 뭘 완료했는지 멤버별 색으로 구분해 보여주고,
 * 이번 달 목표 대비 달성률도 함께 보여준다.
 */
const CookingCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user: authUser, loading: authLoading } = useAuth();

  const [viewMode, setViewMode] = React.useState<ViewMode>('month');
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [entries, setEntries] = React.useState<CalendarEntry[]>([]);
  const [goals, setGoals] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<string>(() => toDateKey(new Date()));
  const [isInHousehold, setIsInHousehold] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState(false);
  const [goalInput, setGoalInput] = React.useState('');

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);

  const loadCalendar = React.useCallback(async () => {
    if (!isLoggedIn || !authUser?.id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const apiUrl = getApiUrl();

      const meRes = await fetch(`${apiUrl}/api/households/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = meRes.ok ? await meRes.json() : null;
      setIsInHousehold(!!me?.in_household);

      const params = new URLSearchParams({ start: toDateKey(monthStart), end: toDateKey(monthEnd) });
      const res = await fetch(`${apiUrl}/api/households/me/completed-calendar?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setGoals(data.goals || {});
      }
    } catch (e) {
      console.warn('[CookingCalendar] 조회 실패:', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, authUser?.id, monthStart.getTime(), monthEnd.getTime()]);

  React.useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const memberIds = React.useMemo(
    () => Object.keys(goals).map(Number).sort((a, b) => a - b),
    [goals]
  );
  const nicknameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const e of entries) map.set(e.user_id, e.nickname);
    return map;
  }, [entries]);

  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const list = map.get(e.day) || [];
      list.push(e);
      map.set(e.day, list);
    }
    return map;
  }, [entries]);

  const visibleRange = React.useMemo(() => {
    if (viewMode === 'day') return { start: selectedDay, end: selectedDay };
    if (viewMode === 'week') {
      const ws = startOfWeek(new Date(selectedDay));
      return { start: toDateKey(ws), end: toDateKey(addDays(ws, 6)) };
    }
    return { start: toDateKey(monthStart), end: toDateKey(monthEnd) };
  }, [viewMode, selectedDay, monthStart, monthEnd]);

  const summary = React.useMemo(() => {
    const byUser = new Map<number, number>();
    let total = 0;
    for (const e of entries) {
      if (e.day < visibleRange.start || e.day > visibleRange.end) continue;
      total += 1;
      byUser.set(e.user_id, (byUser.get(e.user_id) || 0) + 1);
    }
    return { total, byUser };
  }, [entries, visibleRange]);

  const myGoal = authUser?.id ? goals[String(authUser.id)] ?? 12 : 12;
  const myMonthCount = React.useMemo(() => {
    if (!authUser?.id) return 0;
    let count = 0;
    for (const e of entries) {
      if (String(e.user_id) === String(authUser.id)) count += 1;
    }
    return count;
  }, [entries, authUser?.id]);
  const myAchievementRate = myGoal > 0 ? Math.min(100, Math.round((myMonthCount / myGoal) * 100)) : 0;

  const shiftAnchor = (dir: 1 | -1) => {
    if (viewMode === 'month') {
      const next = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1);
      setAnchorDate(next);
      setSelectedDay(toDateKey(next));
    } else if (viewMode === 'week') {
      const next = addDays(new Date(selectedDay), dir * 7);
      setAnchorDate(next);
      setSelectedDay(toDateKey(next));
    } else {
      const next = addDays(new Date(selectedDay), dir);
      setAnchorDate(next);
      setSelectedDay(toDateKey(next));
    }
  };

  const handleSaveGoal = async () => {
    const goal = parseInt(goalInput, 10);
    if (Number.isNaN(goal) || goal < 0 || goal > 200 || !authUser?.id) {
      setEditingGoal(false);
      return;
    }
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      await fetch(`${getApiUrl()}/api/users/${authUser.id}/monthly-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monthly_cooking_goal: goal }),
      });
      setGoals((prev) => ({ ...prev, [String(authUser.id)]: goal }));
    } catch (e) {
      console.warn('[CookingCalendar] 목표 저장 실패:', e);
    } finally {
      setEditingGoal(false);
    }
  };

  if (authLoading) return null;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--ink-500)', marginBottom: 12 }}>로그인 후 볼 수 있어요.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ height: 40, padding: '0 16px', borderRadius: 10, background: 'var(--brand)', border: 'none', fontWeight: 700 }}
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  const gridStart = startOfWeek(monthStart);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // 하루 셀에 넣을 멤버별 점(최대 3명, 넘치면 +N)
  const renderDayDots = (dayEntries: CalendarEntry[]) => {
    const counts = new Map<number, number>();
    for (const e of dayEntries) counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1);
    const uids = Array.from(counts.keys());
    const shown = uids.slice(0, 3);
    const extra = uids.length - shown.length;
    return (
      <span style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
        {shown.map((uid) => (
          <span
            key={uid}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 12,
              height: 12,
              borderRadius: 6,
              padding: '0 2px',
              fontSize: 8,
              fontWeight: 700,
              color: '#FFFFFF',
              background: colorForUser(uid, memberIds),
            }}
          >
            {(counts.get(uid) || 0) > 1 ? counts.get(uid) : ''}
          </span>
        ))}
        {extra > 0 && <span style={{ fontSize: 9, color: 'var(--ink-500)' }}>+{extra}</span>}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 72, paddingBottom: 84 }}>
      {/* 월 목표는 "이번 달" 이라는 더 큰 단위 얘기라, 일/주/월 중 무엇을 보고
          있든 항상 같은 값이어야 맞다 — 그래서 일/주/월 전환 버튼보다 위,
          가장 먼저 오는 자리에 두고 "몇 월 목표"인지 숫자로 못 박아 둔다.
          (전에는 이 아래 있어서 "왜 주간 보기에서도 월 목표가 나오지" 라는
          혼란이 있었음) */}
      <div style={{ margin: '0 14px', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-sub)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>{anchorDate.getMonth() + 1}월 목표</span>
          {editingGoal ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                autoFocus
                style={{ width: 52, height: 26, borderRadius: 6, border: '1px solid var(--line-300)', textAlign: 'center', fontSize: 12 }}
              />
              <button type="button" onClick={handleSaveGoal} style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1E', background: 'none', border: 'none', cursor: 'pointer' }}>저장</button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setGoalInput(String(myGoal));
                setEditingGoal(true);
              }}
              style={{ fontSize: 12, color: 'var(--ink-500)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              목표 {myGoal}회 수정
            </button>
          )}
        </div>
        <div style={{ height: 8, borderRadius: 9999, background: 'var(--line-200)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${myAchievementRate}%`, background: 'var(--brand)', borderRadius: 9999, transition: 'width 0.2s ease' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>
          {myMonthCount}회 / {myGoal}회 달성 ({myAchievementRate}%)
        </div>
      </div>

      {/* 일/주/월 전환 — 목표(달 단위)보다 한 단계 아래, "지금 뭘 보고 있는지"를
          고르는 자리 */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 14px 0' }}>
        {([
          { key: 'day', label: '일' },
          { key: 'week', label: '주' },
          { key: 'month', label: '월' },
        ] as const).map(({ key, label }) => {
          const on = viewMode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                background: on ? 'var(--ink-900)' : 'var(--surface-sub)',
                color: on ? '#FFFFFF' : 'var(--ink-700)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 이전/다음 + 현재 범위 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
        <button type="button" onClick={() => shiftAnchor(-1)} aria-label="이전" style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>
          {viewMode === 'month' && `${anchorDate.getFullYear()}년 ${anchorDate.getMonth() + 1}월`}
          {viewMode === 'week' && `${visibleRange.start} ~ ${visibleRange.end}`}
          {viewMode === 'day' && selectedDay}
        </span>
        <button type="button" onClick={() => shiftAnchor(1)} aria-label="다음" style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {/* 그룹 요약 + 인원별 색 범례 */}
      <div style={{ margin: '10px 14px 0', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-sub)', fontSize: 13, color: 'var(--ink-700)' }}>
        {summary.total === 0 ? (
          <span style={{ color: 'var(--ink-500)' }}>이 기간엔 완료한 레시피가 없어요.</span>
        ) : (
          <span>총 {summary.total}회</span>
        )}
        {isInHousehold && summary.byUser.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {Array.from(summary.byUser.entries()).map(([uid, count]) => (
              <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorForUser(uid, memberIds), flexShrink: 0 }} />
                {nicknameById.get(uid) || '?'} {count}회
              </span>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-500)', fontSize: 13 }}>불러오는 중...</div>}

      {/* 월 보기 */}
      {viewMode === 'month' && (
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-500)', padding: '4px 0' }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {gridDays.map((d) => {
              const key = toDateKey(d);
              const inMonth = d.getMonth() === anchorDate.getMonth();
              const dayEntries = entriesByDay.get(key) || [];
              const isToday = key === toDateKey(new Date());
              const isSelected = key === selectedDay;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDay(key);
                    setViewMode('day');
                  }}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 10,
                    border: isSelected ? '2px solid var(--ink-900)' : '1px solid transparent',
                    background: isToday ? 'var(--surface-sub)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    cursor: 'pointer',
                    opacity: inMonth ? 1 : 0.35,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: '#1A1A1E' }}>{d.getDate()}</span>
                  {dayEntries.length > 0 && renderDayDots(dayEntries)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 주 보기 */}
      {viewMode === 'week' && (
        <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(selectedDay)), i)).map((d) => {
            const key = toDateKey(d);
            const dayEntries = entriesByDay.get(key) || [];
            const isToday = key === toDateKey(new Date());
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDay(key);
                  setViewMode('day');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--line-200)',
                  background: isToday ? 'var(--surface-sub)' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', width: 56, flexShrink: 0 }}>
                  {WEEKDAY_LABELS[d.getDay()]} {d.getDate()}
                </span>
                <span style={{ fontSize: 12.5, color: dayEntries.length ? 'var(--ink-700)' : 'var(--ink-500)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dayEntries.length === 0 ? '기록 없음' : dayEntries.map((e) => e.title).join(', ')}
                </span>
                {dayEntries.length > 0 && renderDayDots(dayEntries)}
              </button>
            );
          })}
        </div>
      )}

      {/* 일 보기 */}
      {viewMode === 'day' && (
        <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(entriesByDay.get(selectedDay) || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-500)', fontSize: 13 }}>
              이 날은 완료한 레시피가 없어요.
            </div>
          ) : (
            (entriesByDay.get(selectedDay) || []).map((e, i) => (
              <div
                key={`${e.recipe_id}-${e.user_id}-${i}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line-200)' }}
              >
                <img
                  src={getProxiedImageUrl(e.thumbnail || '')}
                  alt=""
                  style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'var(--surface-sub)' }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {isInHousehold && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: colorForUser(e.user_id, memberIds), flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      {formatTime(e.created_at)}
                      {isInHousehold ? ` · ${e.nickname}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <BottomNavBar activeTab="cooking-calendar" />
    </div>
  );
};

export default CookingCalendar;
