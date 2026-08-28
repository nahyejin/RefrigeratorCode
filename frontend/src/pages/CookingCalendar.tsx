import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProxiedImageUrl } from '../utils/imageUtils';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarEntry {
  day: string; // YYYY-MM-DD
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

const CalendarIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3v3.4M16 3v3.4" />
  </svg>
);

/**
 * 요리 캘린더 — 완료한 레시피를 날짜별로 돌아보는 화면.
 *
 * 마이페이지 "완료한 레시피" 섹션의 데이터를 다른 방식(달력)으로 보여주는
 * 것이라 별도 하단 탭을 만들지 않고, 마이페이지에서 들어오는 하위 화면으로
 * 둔다. 그룹에 속해 있으면(공유 설정한 멤버 기준) 날짜별로 누가 뭘
 * 완료했는지 배지가 붙고, 상단 요약에 인원별 완료 횟수가 함께 뜬다.
 */
const CookingCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user: authUser, loading: authLoading } = useAuth();

  const [viewMode, setViewMode] = React.useState<ViewMode>('month');
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [entries, setEntries] = React.useState<CalendarEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<string>(() => toDateKey(new Date()));
  const [isInHousehold, setIsInHousehold] = React.useState(false);

  // 항상 anchorDate가 속한 "달" 전체를 불러온다 — 일/주 보기로 전환해도
  // 같은 달 안에서는 다시 불러올 필요가 없다.
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);

  React.useEffect(() => {
    if (!isLoggedIn || !authUser?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const apiUrl = getApiUrl();

        const meRes = await fetch(`${apiUrl}/api/households/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const me = meRes.ok ? await meRes.json() : null;
        if (!cancelled) setIsInHousehold(!!me?.in_household);

        const params = new URLSearchParams({
          start: toDateKey(monthStart),
          end: toDateKey(monthEnd),
        });
        const res = await fetch(`${apiUrl}/api/households/me/completed-calendar?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setEntries(data.entries || []);
        }
      } catch (e) {
        console.warn('[CookingCalendar] 조회 실패:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, authUser?.id, monthStart.getTime(), monthEnd.getTime()]);

  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const list = map.get(e.day) || [];
      list.push(e);
      map.set(e.day, list);
    }
    return map;
  }, [entries]);

  // 화면에 보이는 범위(달/주/일)에 맞춰 요약을 다시 계산한다.
  const visibleRange = React.useMemo(() => {
    if (viewMode === 'day') return { start: selectedDay, end: selectedDay };
    if (viewMode === 'week') {
      const ws = startOfWeek(new Date(selectedDay));
      return { start: toDateKey(ws), end: toDateKey(addDays(ws, 6)) };
    }
    return { start: toDateKey(monthStart), end: toDateKey(monthEnd) };
  }, [viewMode, selectedDay, monthStart, monthEnd]);

  const summary = React.useMemo(() => {
    const byNickname = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      if (e.day < visibleRange.start || e.day > visibleRange.end) continue;
      total += 1;
      byNickname.set(e.nickname, (byNickname.get(e.nickname) || 0) + 1);
    }
    return { total, byNickname: Array.from(byNickname.entries()).sort((a, b) => b[1] - a[1]) };
  }, [entries, visibleRange]);

  const goToday = () => {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDay(toDateKey(today));
  };

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

  // 월 그리드: 그 달 1일이 있는 주의 일요일부터 시작해, 6주(42칸)를 채운다.
  const gridStart = startOfWeek(monthStart);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <CalendarIcon size={18} />
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1E' }}>요리 캘린더</span>
      </div>

      {/* 퀵버튼: 일/주/월 전환 */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
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
        <button
          type="button"
          onClick={goToday}
          style={{ height: 32, padding: '0 12px', borderRadius: 9999, fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--ink-500)', border: '1px solid var(--line-200)', cursor: 'pointer', marginLeft: 'auto' }}
        >
          오늘
        </button>
      </div>

      {/* 이전/다음 + 현재 범위 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
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

      {/* 요약 */}
      <div style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-sub)', fontSize: 13, color: 'var(--ink-700)' }}>
        {summary.total === 0 ? (
          <span style={{ color: 'var(--ink-500)' }}>이 기간엔 완료한 레시피가 없어요.</span>
        ) : isInHousehold ? (
          <span>
            총 {summary.total}회 · {summary.byNickname.map(([name, count]) => `${name} ${count}회`).join(' · ')}
          </span>
        ) : (
          <span>이 기간에 {summary.total}개 완료했어요.</span>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-500)', fontSize: 13 }}>불러오는 중...</div>}

      {/* 월 보기 */}
      {viewMode === 'month' && (
        <div style={{ padding: '12px 16px 0' }}>
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
                    gap: 2,
                    cursor: 'pointer',
                    opacity: inMonth ? 1 : 0.35,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: '#1A1A1E' }}>{d.getDate()}</span>
                  {dayEntries.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#1A1A1E',
                        background: 'var(--brand)',
                        borderRadius: 9999,
                        padding: '0 5px',
                        lineHeight: '14px',
                      }}
                    >
                      {dayEntries.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 주 보기 */}
      {viewMode === 'week' && (
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                {dayEntries.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', borderRadius: 9999, padding: '2px 8px', flexShrink: 0 }}>
                    {dayEntries.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 일 보기 */}
      {viewMode === 'day' && (
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  {isInHousehold && (
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{e.nickname}님이 완료</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CookingCalendar;
