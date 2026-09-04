import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ExpiryAlert from '../components/ExpiryAlert';
import { loadIngredientCategoryMap, type CategoryMap, type StorageKind } from '../utils/shelfLife';
import type { FridgeItem } from '../utils/expiry';
import { planByDate, loadPlan, type PlannedMeal } from '../utils/mealPlan';
import { openCookMode } from '../utils/cookMode';
import { getProxiedImageUrl } from '../utils/imageUtils';
import BottomNavBar from '../components/BottomNavBar';
import PullToRefresh from '../components/PullToRefresh';
import { useAuth } from '../context/AuthContext';

type ViewMode = 'day' | 'week' | 'month';
/** 보기 **방식**. 기간(일/주/월)과 다른 층이다 — 목록은 기간이 아니다. */
type Mode = 'calendar' | 'mine' | 'household';

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

// ✓/✎ 같은 유니코드 기호 대신 SectionIcon과 같은 선 아이콘 스타일(24 뷰박스)로
// 그린다 — 유니코드 기호도 폰트/OS에 따라 이모지 스타일로 렌더될 수 있어
// "이모지는 최대한 쓰지 말아 달라"는 요청에 맞춰 전부 SVG로 통일했다.
const CheckIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4.4 12.6l5.2 5.2 10-11.6" />
  </svg>
);

const PencilIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20l.9-4.5L16.2 4.2a1.8 1.8 0 0 1 2.6 0l1 1a1.8 1.8 0 0 1 0 2.6L8.5 19.1z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);

// 절약액 추정치. 재료 가격 데이터가 없어 정확한 계산은 못 하지만, "외식/배달
// 한 끼 평균 비용 - 집밥 한 끼 평균 재료비" 정도의 대략적인 추정은 완료
// 횟수만으로도 낼 수 있다. 화면에는 반드시 "추정치"라고 밝혀서 실제 계산인
// 것처럼 오해하지 않게 한다. 한 끼당 절약액은 지역/식습관에 따라 체감이
// 달라 식구 수처럼 직접 조정 가능하다 — 이 값은 서버에서 안 내려온 동안(첫
// 로딩 중) 쓰는 기본값일 뿐, 실제 값은 households/users.savings_per_meal.
const ESTIMATED_SAVINGS_PER_MEAL_DEFAULT = 8000; // 원, 외식/배달 대비 집밥 한 끼당 대략적인 절약분

function formatWon(n: number): string {
  return n.toLocaleString('ko-KR');
}

/**
 * 내냉장고가 쓰는 그 자리에서 보관함 세 칸을 읽는다.
 * 키 이름을 새로 정하지 않는다 — 다르게 적으면 재료가 있는데도 안 뜬다.
 */
function readFridgeBoxes(): Partial<Record<StorageKind, FridgeItem[]>> {
  const empty = { frozen: [], fridge: [], room: [] };
  try {
    const raw = localStorage.getItem('myfridge_ingredients');
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const pick = (v: unknown) => (Array.isArray(v) ? (v as FridgeItem[]) : []);
    return { frozen: pick(data?.frozen), fridge: pick(data?.fridge), room: pick(data?.room) };
  } catch {
    return empty;
  }
}

/**
 * 서버 기록에 **기기에만 있는 완료**를 합친다.
 *
 * 완료는 로그인 전에 눌렀거나 서버 반영이 실패했으면 기기에만 남는다.
 * 서버 것만 그리면 분명히 눌렀는데 목록이 비어 보인다.
 */
function mergeLocalDone(server: CalendarEntry[], meId: number, meName: string): CalendarEntry[] {
  let local: any[] = [];
  try {
    local = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]');
  } catch {
    local = [];
  }
  if (!Array.isArray(local) || local.length === 0) return server;

  const seen = new Set(server.map(e => `${e.day}|${e.recipe_id}`));
  const extra: CalendarEntry[] = [];
  local.forEach(r => {
    const when = r.user_saved_at || r.created_at;
    if (!r || !r.id || !when) return;
    const day = String(when).slice(0, 10);
    if (seen.has(`${day}|${r.id}`)) return;
    extra.push({
      day,
      created_at: String(when),
      recipe_id: r.id,
      title: r.title || '',
      thumbnail: r.thumbnail || '',
      // 주인을 안 붙이면 인원별 범례에서 "? 3회" 로 뜬다 — 닉네임을 못 찾아서다.
      // 기기에 남은 완료는 **이 사람 것**이다.
      user_id: meId,
      nickname: meName,
    });
  });
  return [...server, ...extra];
}

/**
 * 곧 상하는 재료 + 이번 주 식단을 **한 묶음**으로.
 *
 * 왜 붙여 두나: 두 개가 하나의 이야기다 — "이게 곧 상해요 → 그럼 이걸로 식단을
 * 짜요". 떨어뜨려 놓으면 알림은 잔소리로만 남고, 식단은 왜 지금 짜야 하는지
 * 이유가 없어진다.
 *
 * 왜 로그인 벽 **앞**에도 두나: 둘 다 냉장고 재료(로컬)만 있으면 되는 기능이다.
 * 로그인이 필요한 건 캘린더(내 요리 이력)뿐이다.
 */
const FridgeToPlan: React.FC<{ onGo: (withAi?: boolean) => void }> = ({ onGo }) => {
  const [categoryMap, setCategoryMap] = React.useState<CategoryMap>({});
  const boxes = React.useMemo(readFridgeBoxes, []);

  React.useEffect(() => {
    void loadIngredientCategoryMap().then(setCategoryMap).catch(() => {});
  }, []);

  return (
    <div style={{ margin: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ExpiryAlert boxes={boxes} categoryMap={categoryMap} onPick={() => onGo(false)} />
      {/* 그냥 짜기 — **무료**다. 노란색도 AI 배지도 안 쓴다.
          한때 이 버튼 하나가 노란색 + AI 배지 + 반짝임을 달고 있었는데, 눌러 봐야
          그냥 페이지가 열렸다. 시각 신호가 거짓말을 하면 정작 크레딧을 쓰는
          자리에서도 사람이 안 멈춘다. */}
      <button
        type="button"
        onClick={() => onGo(false)}
        style={{
          width: '100%', height: 48, borderRadius: 12, cursor: 'pointer',
          border: '1px solid var(--line-200)', background: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1A1A1E' }}>
          이번 주 식단 짜기
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>
          냉장고 재료로 · 장보기 목록까지 ›
        </span>
      </button>

      {/* AI 로 짜기 — 여기만 노란색·AI 배지·반짝임을 쓴다.
          다만 **누르는 순간 크레딧이 나가지는 않는다.** 냉장고를 보기도 전에,
          "아이 먹을 것 위주로" 같은 조건을 적기도 전에 돈이 나가면 결과가
          마음에 안 들 때 그대로 손해다. AI 칸으로 데려다 주고 거기서 쓴다. */}
      <span style={{ display: 'flex', position: 'relative' }}>
        <button
          type="button"
          onClick={() => onGo(true)}
          className="ai-action"
          style={{
            width: '100%', height: 48, borderRadius: 12,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 16px',
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1A1A1E' }}>
            AI 로 짜기
          </span>
          <span style={{ fontSize: 12.5, color: 'rgba(26,26,30,0.6)' }}>
            "아이 먹을 것 위주로" 처럼 ›
          </span>
        </button>
        <span className="ai-fab-badge">AI</span>
      </span>
    </div>
  );
};

/**
 * 짜 둔 식단 계획 목록.
 *
 * 로그인 벽 **앞에도** 둔다. 계획은 기기에 저장되는 것이라 로그인이 필요 없는데,
 * 벽 뒤에만 두면 **비회원이 식단을 반영해 놓고 볼 곳이 없다.**
 */
const PlannedList: React.FC = () => {
  const meals = React.useMemo(() => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // 7 이 아니라 10 — 하루에 두세 끼가 올 수 있어서, 7 로 자르면
    // 한 주가 다 안 보인다.
    return loadPlan().filter(m => m.date >= key).slice(0, 10);
  }, []);

  if (meals.length === 0) return null;

  return (
    <div style={{ margin: '0 14px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', marginBottom: 8 }}>
        만들기로 한 요리
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {meals.map((m, i) => (
          <button
            key={m.date + '-' + m.recipeId}
            type="button"
            onClick={() => openCookMode({ id: m.recipeId, title: m.title, link: m.link })}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 12, border: '1px dashed #C9A400', background: '#FFFDF2',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            {/* 같은 날 두 번째 끼니부터는 날짜를 비운다 — 같은 날짜가 연달아
                찍히면 다른 날인 줄 알고 다시 읽게 된다. */}
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7A5C00', width: 62, flexShrink: 0 }}>
              {i > 0 && meals[i - 1].date === m.date ? '' : m.date.slice(5).replace('-', '/')}
            </span>
            {m.thumbnail && (
              <img
                src={getProxiedImageUrl(m.thumbnail)}
                alt=""
                loading="lazy"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <span style={{
              flex: 1, minWidth: 0, fontSize: 13, color: '#1A1A1E',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{m.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

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
  const location = useLocation();
  const { isLoggedIn, user: authUser, loading: authLoading } = useAuth();

  const [viewMode, setViewMode] = React.useState<ViewMode>('month');
  /**
   * 어느 탭으로 열지.
   *
   * 마이페이지의 `만든 요리 돌아보기` 로 들어오면 **그 탭이 열려 있어야** 한다.
   * 달력이 열리면 방금 누른 것과 다른 화면이 나와서 한 번 더 눌러야 했다.
   */
  const [mode, setMode] = React.useState<Mode>(
    () => ((location.state as any)?.mode === 'list' ? 'mine' : 'calendar'),
  );
  /** 목록에 쓰는 **전 기간** 완료 기록. 달력이 쓰는 `entries` 는 보고 있는 달뿐이다. */
  const [allEntries, setAllEntries] = React.useState<CalendarEntry[] | null>(null);
  /** 메모를 남긴 레시피. 완료와 함께 "내 요리 이력" 이라 같은 자리에서 본다. */
  const [recorded, setRecorded] = React.useState<any[] | null>(null);
  const [listKind, setListKind] = React.useState<'done' | 'write'>('done');
  /** 우리 식구 요리에서 **내 것을 빼고** 볼지. */
  const [hideMine, setHideMine] = React.useState(false);
  /**
   * 목록에서 볼 기간. 기본은 전체다.
   *
   * 달력의 `< 2026년 9월 >` 을 그대로 가져오지 않는다. 그건 **한 달씩 넘기는**
   * 장치라 "여태 만든 것" 을 보러 온 자리와 안 맞는다. 여기서는 넓은 쪽에서
   * 좁히는 방식이 맞다.
   */
  const [span, setSpan] = React.useState<'all' | '90' | '365'>('all');
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [entries, setEntries] = React.useState<CalendarEntry[]>([]);
  // 그룹이 있으면 groupGoal(그룹 전체가 공유하는 하나의 값)을 쓰고,
  // 없으면 personalGoal(내 개인 목표)을 쓴다 — 개인별로 따로 두지 않는다.
  const [groupGoal, setGroupGoal] = React.useState<number | null>(null);
  const [personalGoal, setPersonalGoal] = React.useState<number>(20);
  const [householdSize, setHouseholdSize] = React.useState(1);
  const [memberIds, setMemberIds] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<string>(() => toDateKey(new Date()));
  const [isInHousehold, setIsInHousehold] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState(false);
  const [goalInput, setGoalInput] = React.useState('');
  // 절약액 계산에 곱하는 "실제 같이 먹는 식구 수". 연동 계정 수와 다를 수 있어
  // (아이가 있으면 계정 없이 같이 먹음) 그룹원이 직접 조정할 수 있게 뒀다.
  const [familySize, setFamilySize] = React.useState(1);
  const [editingFamilySize, setEditingFamilySize] = React.useState(false);
  const [familySizeInput, setFamilySizeInput] = React.useState('');
  // 한 끼당 절약액 추정치. 지역/식습관에 따라 체감이 달라 식구 수처럼
  // 그룹(또는 혼자면 개인)이 직접 조정할 수 있게 뒀다.
  const [savingsPerMeal, setSavingsPerMeal] = React.useState(ESTIMATED_SAVINGS_PER_MEAL_DEFAULT);
  const [editingSavingsPerMeal, setEditingSavingsPerMeal] = React.useState(false);
  const [savingsPerMealInput, setSavingsPerMealInput] = React.useState('');
  // 목표 카드가 인원별 범례·안내 문구까지 다 펼쳐지면 길어져서 달력이 한
  // 화면에 안 들어온다. 목표·달성률·절약액까지는 항상 보이고, 그 아래
  // 범례/안내 문구만 기본으로 접어 둔다.
  const [goalCardExpanded, setGoalCardExpanded] = React.useState(false);
  // 완료 버튼을 실제로 요리한 날 바로 안 누르면 캘린더에 엉뚱한 날짜로
  // 찍힌다 — 일 보기에서 내가 완료한 기록만 날짜를 직접 고칠 수 있게 한다.
  // 키는 "recipe_id-user_id" (완료 기록은 user_id+recipe_id로 유일함).
  const [editingDateKey, setEditingDateKey] = React.useState<string | null>(null);
  const [dateInput, setDateInput] = React.useState('');
  const [savingDate, setSavingDate] = React.useState(false);

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
      setMemberIds(me?.in_household ? (me.members || []).map((m: any) => m.id).sort((a: number, b: number) => a - b) : []);

      const params = new URLSearchParams({ start: toDateKey(monthStart), end: toDateKey(monthEnd) });
      const res = await fetch(`${apiUrl}/api/households/me/completed-calendar?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // 달력에도 **기기에만 있는 완료**를 합친다. 로그인 전에 눌렀거나 서버
        // 반영이 실패한 것은 기기에만 남는데, 그것도 내가 만든 요리다.
        // (보고 있는 달 밖의 것은 걸러 낸다 — 이 화면은 그 달을 그린다)
        const from = toDateKey(monthStart);
        const to = toDateKey(monthEnd);
        setEntries(mergeLocalDone(data.entries || [], Number(authUser.id), myName).filter(e => e.day >= from && e.day <= to));
        setGroupGoal(typeof data.group_goal === 'number' ? data.group_goal : null);
        setPersonalGoal(typeof data.my_personal_goal === 'number' ? data.my_personal_goal : 20);
        setHouseholdSize(data.household_size || 1);
        setFamilySize(typeof data.family_size === 'number' ? data.family_size : 1);
        setSavingsPerMeal(typeof data.savings_per_meal === 'number' ? data.savings_per_meal : ESTIMATED_SAVINGS_PER_MEAL_DEFAULT);
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

  /**
   * 목록을 처음 열 때 **전 기간**을 한 번 불러온다.
   *
   * 달력이 쓰는 `entries` 는 보고 있는 달만 담는다. 그걸 그대로 목록에 썼더니
   * 이번 달에 완료한 게 없으면 "0건" 이 됐다 — 여태 만든 것을 보러 온 화면인데.
   */
  React.useEffect(() => {
    if (mode === 'calendar' || allEntries !== null) return;
    if (!isLoggedIn || !authUser?.id) return;
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const params = new URLSearchParams({ start: '2000-01-01', end: toDateKey(addDays(new Date(), 366)) });
    fetch(`${getApiUrl()}/api/households/me/completed-calendar?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setAllEntries(mergeLocalDone(d.entries || [], Number(authUser.id), myName)))
      .catch(() => setAllEntries(mergeLocalDone([], Number(authUser.id), myName)));

    // 기록은 완료와 자료가 다르다(날짜별 이력이 아니라 레시피 목록).
    // 서버가 안 되면 기기에 있는 것으로라도 보여 준다 — 비어 있는 것보다 낫다.
    fetch(`${getApiUrl()}/api/users/${authUser.id}/recorded-recipes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setRecorded(d.recipes || []))
      .catch(() => {
        try {
          setRecorded(JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]'));
        } catch {
          setRecorded([]);
        }
      });
  }, [mode, allEntries, isLoggedIn, authUser?.id]);

  /**
   * 지금 탭이 보여야 할 완료 기록.
   *
   * 전에는 `내 요리` 인데도 **식구 것을 다 합쳐서** 보여 줬다. 서버가 그룹
   * 전체를 내려 주는데 그대로 그렸기 때문이다. 내 요리는 내 것이어야 한다.
   */
  const listEntries = React.useMemo(() => {
    if (allEntries === null) return null;
    const me = Number(authUser?.id);
    let out = allEntries;
    if (mode === 'mine') out = out.filter(e => e.user_id === me);
    else if (mode === 'household' && hideMine) out = out.filter(e => e.user_id !== me);
    if (span !== 'all') {
      const from = toDateKey(addDays(new Date(), -Number(span)));
      out = out.filter(e => e.day >= from);
    }
    return out;
  }, [allEntries, mode, hideMine, span, authUser?.id]);

  /** 식구 탭에서 **나 말고 다른 사람** 것이 몇 건인지. 체크박스 옆에 적는다. */
  const othersCount = React.useMemo(() => {
    if (allEntries === null) return 0;
    const me = Number(authUser?.id);
    return allEntries.filter(e => e.user_id !== me).length;
  }, [allEntries, authUser?.id]);

  const handleSaveCompletedDate = async (entry: CalendarEntry) => {
    if (!authUser?.id || !dateInput) return;
    setSavingDate(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/users/${authUser.id}/completed-recipes/${entry.recipe_id}/date`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ date: dateInput }),
        }
      );
      if (res.ok) {
        setEditingDateKey(null);
        await loadCalendar();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '완료 날짜 수정에 실패했어요.');
      }
    } catch (e) {
      console.warn('[CookingCalendar] 완료 날짜 수정 실패:', e);
      alert('완료 날짜 수정 중 오류가 발생했어요.');
    } finally {
      setSavingDate(false);
    }
  };

  /** 내 이름. 기기에만 있는 완료에 주인을 붙일 때 쓴다. */
  const myName = (authUser as any)?.nickname || (authUser as any)?.name || '나';

  const nicknameById = React.useMemo(() => {
    const map = new Map<number, string>();
    // 빈 이름을 넣어 두면 `|| '?'` 가 안 걸려서 빈칸으로 보인다. 값이 있을 때만.
    for (const e of entries) if (e.nickname) map.set(e.user_id, e.nickname);
    if (authUser?.id) map.set(Number(authUser.id), myName);
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

  // 그룹에 속해 있으면 groupGoal(그룹 전체 공동 목표)을, 아니면 개인 목표를 쓴다.
  const myGoal = isInHousehold ? groupGoal ?? 20 : personalGoal;

  // 목표는 "이 달" 단위 개념이라, 지금 일/주/월 중 뭘 보고 있는지와 무관하게
  // 이 달 전체(entries는 애초에 이 달 범위만 불러온 것) 기준으로 계산한다.
  // summary(위)는 반대로 지금 보고 있는 범위 기준이라 여기 쓰면 안 된다.
  const monthlyByUser = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const e of entries) map.set(e.user_id, (map.get(e.user_id) || 0) + 1);
    return map;
  }, [entries]);
  const monthlyTotal = entries.length;

  // 그룹이면 목표 게이지를 인원별로 색을 나눠 채운다 — 완료 횟수가 많은
  // 순서대로 앞에서부터 채우고, 합이 목표(100%)를 넘으면 시각적으로만 잘라낸다.
  const goalSegments = React.useMemo(() => {
    if (myGoal <= 0) return [];
    const sorted = Array.from(monthlyByUser.entries()).sort((a, b) => b[1] - a[1]);
    let used = 0;
    return sorted.map(([uid, count]) => {
      const rawPct = (count / myGoal) * 100;
      const pct = Math.max(0, Math.min(rawPct, 100 - used));
      used += pct;
      return { uid, count, pct };
    });
  }, [monthlyByUser, myGoal]);
  const groupAchievementRate = myGoal > 0 ? Math.min(100, Math.round((monthlyTotal / myGoal) * 100)) : 0;
  const estimatedSavings = monthlyTotal * savingsPerMeal * familySize;

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
      // 그룹에 속해 있으면 그룹 공동 목표를(households.monthly_cooking_goal,
      // 누가 바꾸든 모두에게 적용), 아니면 내 개인 목표를 갱신한다.
      const url = isInHousehold
        ? `${getApiUrl()}/api/households/goal`
        : `${getApiUrl()}/api/users/${authUser.id}/monthly-goal`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monthly_cooking_goal: goal }),
      });
      if (res.ok) {
        if (isInHousehold) setGroupGoal(goal);
        else setPersonalGoal(goal);
      }
    } catch (e) {
      console.warn('[CookingCalendar] 목표 저장 실패:', e);
    } finally {
      setEditingGoal(false);
    }
  };

  const handleSaveFamilySize = async () => {
    const size = parseInt(familySizeInput, 10);
    if (Number.isNaN(size) || size < 1 || size > 20 || !authUser?.id) {
      setEditingFamilySize(false);
      return;
    }
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const url = isInHousehold
        ? `${getApiUrl()}/api/households/family-size`
        : `${getApiUrl()}/api/users/${authUser.id}/family-size`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ family_size: size }),
      });
      if (res.ok) setFamilySize(size);
    } catch (e) {
      console.warn('[CookingCalendar] 식구 수 저장 실패:', e);
    } finally {
      setEditingFamilySize(false);
    }
  };

  const handleSaveSavingsPerMeal = async () => {
    const amount = parseInt(savingsPerMealInput, 10);
    if (Number.isNaN(amount) || amount < 0 || amount > 100000 || !authUser?.id) {
      setEditingSavingsPerMeal(false);
      return;
    }
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const url = isInHousehold
        ? `${getApiUrl()}/api/households/savings-per-meal`
        : `${getApiUrl()}/api/users/${authUser.id}/savings-per-meal`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ savings_per_meal: amount }),
      });
      if (res.ok) setSavingsPerMeal(amount);
    } catch (e) {
      console.warn('[CookingCalendar] 한 끼 추정액 저장 실패:', e);
    } finally {
      setEditingSavingsPerMeal(false);
    }
  };

  if (authLoading) return null;

  if (!isLoggedIn) {
    // 요리 캘린더는 냉장고/레시피 목록과 달리 보여줄 로컬(localStorage)
    // 데이터가 아예 없다 — 완료 기록·목표·절약액이 전부 서버 계정에
    // 묶여 있어서 그냥 "로그인 후 볼 수 있어요"라고만 하면 로그인해서
    // 뭘 얻는지 와닿지 않는다. 로그인하면 실제로 뭘 할 수 있는지(이력
    // 관리, 절약액 확인, 목표 설정)를 구체적으로 안내한다.
    return (
      <div className="min-h-screen w-full flex flex-col">
        {/* 식단은 냉장고 재료만 있으면 되는 기능이라 **로그인 벽 뒤에 가두지
            않는다.** 로그인해야만 쓸 수 있는 건 캘린더(내 요리 이력)뿐이다.
            그래서 **쓸 수 있는 것을 위**에 둔다 — 아래에 뒀더니 로그인 안내가
            화면을 꽉 채우고 이 버튼은 하단 탭에 가려져, 스크롤도 안 되는
            자리에 숨어 있었다. */}
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', paddingTop: 72 }}>
          <FridgeToPlan onGo={withAi => navigate(withAi ? '/plan?ai=1' : '/plan')} />
          <PlannedList />
        </div>

        <div className="flex-1 w-full flex items-center justify-center bg-white"
             style={{ paddingBottom: 100 }}>
          <div style={{ textAlign: 'center', padding: '0 32px' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E', marginBottom: 8 }}>
              로그인하면 요리 캘린더를 쓸 수 있어요
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6, wordBreak: 'keep-all', marginBottom: 20 }}>
              내가 완료한 요리 이력을 날짜별로 관리하고,
              <br />
              그동안 요리로 아낀 절약액을 확인하고,
              <br />
              이번 달 요리 목표도 설정할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ height: 40, padding: '0 16px', borderRadius: 10, background: 'var(--brand)', border: 'none', fontWeight: 700 }}
            >
              로그인
            </button>
          </div>
        </div>
        <BottomNavBar activeTab="cooking-calendar" />
      </div>
    );
  }

  const gridStart = startOfWeek(monthStart);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  /**
   * 짜 둔 식단 계획.
   *
   * 완료 기록(`entriesByDay`)과 **섞지 않는다.** 저건 실제로 만든 것이고 이건
   * 아직 계획이다. 같은 목록에 넣으면 "만들었다" 는 기록이 오염된다.
   */
  const plans = planByDate();

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
      {/* 다른 그룹원이 완료·기록·즐겨찾기를 하면 이 화면 내용이 바뀌는데, 그걸
          보려면 예전엔 탭을 벗어났다 돌아오는 수밖에 없었다 — 당겨서
          새로고침으로 그 자리에서 바로 다시 불러올 수 있게 한다. */}
      <PullToRefresh onRefresh={loadCalendar}>
      <FridgeToPlan onGo={withAi => navigate(withAi ? '/plan?ai=1' : '/plan')} />
      {/* 계획 목록을 여기 또 두지 않는다.
          바로 아래가 달력인데 그 위에 같은 내용을 줄로 늘어놓으면, 같은 것을
          두 번 읽게 되고 정작 달력은 화면 밖으로 밀린다. 계획은 달력 안에서
          — 월 보기는 도장, 주 보기는 카드, 일 보기는 그 날 카드로 — 보여 준다.
          (로그인 전 화면에는 달력이 없으므로 거기서는 목록을 그대로 쓴다) */}

      {/* 월 목표는 "이번 달" 이라는 더 큰 단위 얘기라, 일/주/월 중 무엇을 보고
          있든 항상 같은 값이어야 맞다 — 그래서 일/주/월 전환 버튼보다 위,
          가장 먼저 오는 자리에 두고 "몇 월 목표"인지 숫자로 못 박아 둔다.
          (전에는 이 아래 있어서 "왜 주간 보기에서도 월 목표가 나오지" 라는
          혼란이 있었음) */}
      <div style={{ margin: '0 14px', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-sub)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>
            {anchorDate.getFullYear()}년 {anchorDate.getMonth() + 1}월 목표
          </span>
          {editingGoal ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveGoal();
                }}
                autoFocus
                style={{ width: 56, height: 28, borderRadius: 6, border: '1px solid var(--line-300)', textAlign: 'center', fontSize: 13 }}
              />
              <button
                type="button"
                onClick={handleSaveGoal}
                style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: 'pointer' }}
              >
                적용
              </button>
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>목표 {myGoal}회</span>
              <button
                type="button"
                onClick={() => {
                  setGoalInput(String(myGoal));
                  setEditingGoal(true);
                }}
                style={{ height: 24, padding: '0 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', background: '#FFFFFF', border: '1px solid var(--line-300)', cursor: 'pointer' }}
              >
                목표수정
              </button>
            </span>
          )}
        </div>
        {/* 그룹이면 완료 횟수가 많은 사람부터 순서대로 색을 나눠 채운다.
            혼자면(그룹 아님) 단색 막대 그대로. */}
        <div style={{ display: 'flex', height: 8, borderRadius: 9999, background: 'var(--line-200)', overflow: 'hidden' }}>
          {isInHousehold ? (
            goalSegments.map((seg) => (
              <div
                key={seg.uid}
                style={{
                  height: '100%',
                  width: `${seg.pct}%`,
                  background: colorForUser(seg.uid, memberIds),
                  transition: 'width 0.2s ease',
                }}
              />
            ))
          ) : (
            <div style={{ height: '100%', width: `${groupAchievementRate}%`, background: 'var(--brand)', borderRadius: 9999, transition: 'width 0.2s ease' }} />
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>
          {monthlyTotal}회 / {myGoal}회 달성 ({groupAchievementRate}%)
        </div>
        {/* 인원별 색 범례 — 게이지 색과 같은 순서(완료 많은 순). 한때 "자세히
            보기" 접힘 영역 안에 넣었더니 "이건 게이지 바로 옆에 항상 붙어
            있어야지 숨기면 안 된다"는 지적을 받았다 — 누가 몇 회 했는지는
            게이지가 보여주는 핵심 정보의 일부라, 계산식 설명 문구와는 무게가
            다르다. 그래서 게이지 바로 아래, 항상 보이는 자리로 옮겼다. */}
        {isInHousehold && goalSegments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {goalSegments.map((seg) => (
              <span key={seg.uid} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-700)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorForUser(seg.uid, memberIds), flexShrink: 0 }} />
                {nicknameById.get(seg.uid) || '?'} {seg.count}회
              </span>
            ))}
          </div>
        )}
        {/* 절약액은 재료 가격 데이터가 없어 정확한 계산이 아니라 대략적인
            추정치다 — 그렇게 명시해서 실제 계산인 것처럼 오해하지 않게 한다.
            "목표를 달성하면 얼마인지"가 아니라 "이번 달 완료한 횟수 기준"
            이라는 게 헷갈린다는 지적을 받아 "이번달"을 헤드라인에 직접
            박아 뒀다(아래 계산식 줄의 × {monthlyTotal}회 도 같은 의미).
            한 끼 추정액도 1인 기준(식구 수를 곱하므로)임을 명시했다.
            계산식 문장 안에 수정 버튼을 끼워 넣었더니 문장이 이상한
            지점에서 줄바꿈되고 어수선해 보인다는 지적을 받아, 문장(읽기)과
            수정 조작(칩 버튼 2개)을 분리했다 — 문장은 그냥 텍스트로 온전히
            보여주고, 그 아래 알약 모양 칩으로 값만 눌러서 바로 고칠 수
            있게 했다. 목표·달성률·절약액까지는 카드를 접어도 항상 보인다. */}
        {monthlyTotal > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)' }}>
              {/* 이모지(💰)는 기기·OS마다 그림체가 달라 앱의 다른 검정 선
                  아이콘과 톤이 안 맞는다는 지적을 받아, SectionIcon과 같은
                  선 아이콘 스타일(24 뷰박스, strokeWidth 1.7)로 통일했다. */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                <ellipse cx="12" cy="17" rx="7" ry="3" />
                <ellipse cx="12" cy="12" rx="7" ry="3" />
                <path d="M5 12v5M19 12v5" />
              </svg>
              이번달 예상 절약액 약 {formatWon(estimatedSavings)}원
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.5 }}>
              외식·배달 대비 1인 한 끼 {formatWon(savingsPerMeal)}원 절약 추정 × {monthlyTotal}회 × 식구 {familySize}명
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {editingSavingsPerMeal ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 4px 0 10px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--brand)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>1인 한 끼</span>
                  <input
                    type="number"
                    value={savingsPerMealInput}
                    onChange={(e) => setSavingsPerMealInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSavingsPerMeal();
                    }}
                    autoFocus
                    style={{ width: 56, height: 20, borderRadius: 5, border: '1px solid var(--line-300)', textAlign: 'center', fontSize: 11, padding: 0 }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveSavingsPerMeal}
                    aria-label="1인 한 끼 추정액 적용"
                    style={{ height: 22, padding: '0 8px', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: 'pointer' }}
                  >
                    <CheckIcon />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSavingsPerMealInput(String(savingsPerMeal));
                    setEditingSavingsPerMeal(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', background: 'var(--surface)', border: '1px solid var(--line-300)', cursor: 'pointer' }}
                >
                  1인 한 끼 {formatWon(savingsPerMeal)}원
                  <span aria-hidden style={{ color: 'var(--ink-500)', display: 'inline-flex' }}><PencilIcon /></span>
                </button>
              )}
              {editingFamilySize ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 4px 0 10px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--brand)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>식구</span>
                  <input
                    type="number"
                    value={familySizeInput}
                    onChange={(e) => setFamilySizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFamilySize();
                    }}
                    autoFocus
                    style={{ width: 36, height: 20, borderRadius: 5, border: '1px solid var(--line-300)', textAlign: 'center', fontSize: 11, padding: 0 }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveFamilySize}
                    aria-label="식구 수 적용"
                    style={{ height: 22, padding: '0 8px', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: 'pointer' }}
                  >
                    <CheckIcon />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFamilySizeInput(String(familySize));
                    setEditingFamilySize(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', background: 'var(--surface)', border: '1px solid var(--line-300)', cursor: 'pointer' }}
                >
                  식구 {familySize}명
                  <span aria-hidden style={{ color: 'var(--ink-500)', display: 'inline-flex' }}><PencilIcon /></span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 안내 문구(매월 1일 초기화, 공동 목표 여부)만 접어 둔다 — 인원별
            범례는 게이지가 보여주는 핵심 정보라 항상 위에 노출한다(위 참고).
            눈에 잘 띄도록 텍스트+화살표가 있는 알약 버튼으로. */}
        <button
          type="button"
          onClick={() => setGoalCardExpanded((v) => !v)}
          aria-expanded={goalCardExpanded}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            padding: '0 10px',
            marginTop: 10,
            borderRadius: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--line-300)',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--ink-700)',
          }}
        >
          {goalCardExpanded ? '자세히 접기' : '자세히 보기'}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-700)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: goalCardExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {goalCardExpanded && (
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 10, lineHeight: 1.5 }}>
            {isInHousehold
              ? '매월 1일에 0%로 돌아가요. 그룹 공용 목표라 누가 바꿔도 모두에게 적용돼요.'
              : '매월 1일에 0%로 돌아가요.'}
          </div>
        )}
      </div>

      {/* 목표 카드와 명확히 분리된 별도 카드에 캘린더를 담아, 모바일 화면에서
          두 영역이 붙어 보이지 않고 한 화면에 같이 들어오게 했다. */}
      <div style={{ margin: '14px 14px 0', borderRadius: 14, border: '1px solid var(--line-200)', background: '#FFFFFF', overflow: 'hidden' }}>
        {/* 화면을 **가르는** 자리라 탭으로 그린다.
            알약으로 뒀더니 아래 일/주/월 알약과 같아 보여서, 화면을 바꾸는
            것인지 결과를 좁히는 필터인지 구분이 안 됐다. 탭은 밑줄로 "지금
            여기 있다" 를 말한다. */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line-200)',
                      padding: '0 4px' }}>
          {([
            { key: 'calendar', label: '달력' },
            // '목록' 은 **무엇의** 목록인지 말하지 않는다. 여기 담기는 건
            // 내가 완료했거나 기록한 요리다.
            { key: 'mine', label: '내 요리' },
            ...(isInHousehold ? [{ key: 'household' as const, label: '우리 식구 요리' }] : []),
          ] as const).map(({ key, label }) => {
            const on = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); if (key === 'household') setListKind('done'); }}
                style={{
                  // 폭을 나눠 갖지 않는다. 셋으로 쪼개 늘려 놓으면 글자보다
                  // 밑줄이 훨씬 길어져 둔해 보인다 — 밑줄은 **글자 밑**에만.
                  height: 42, padding: '0 14px', background: 'transparent',
                  border: 'none', marginBottom: -1,
                  fontSize: 14, fontWeight: on ? 700 : 500,
                  color: on ? '#1A1A1E' : 'var(--ink-500)', cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {label}
                {on && (
                  <span aria-hidden style={{
                    position: 'absolute', left: 14, right: 14, bottom: 0,
                    height: 2, borderRadius: 2, background: '#1A1A1E',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* 기간은 달력일 때만 고른다. 목록은 전 기간이다. */}
        <div style={{ display: mode === 'calendar' ? 'flex' : 'none', gap: 6, padding: '8px 14px 0' }}>
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
                  height: 30,
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

        {/* 이전/다음 + 현재 범위 표시. 목록은 전 기간이라 넘길 것이 없다. */}
        <div style={{ display: mode === 'calendar' ? 'flex' : 'none',
                      alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 0' }}>
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
        <div style={{ margin: '8px 14px 0', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-sub)', fontSize: 13, color: 'var(--ink-700)' }}>
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
        {mode === 'calendar' && viewMode === 'month' && (
          <div style={{ padding: '12px 14px 14px' }}>
          {/* 표시가 무슨 뜻인지는 짧게만. 길게 설명할수록 오히려 안 읽힌다. */}
          {plans.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                          fontSize: 11.5, color: 'var(--ink-500)' }}>
              <span aria-hidden style={{
                width: 15, height: 15, flexShrink: 0,
                borderRadius: '50%', background: '#FFF0A8',
              }} />
              요리 계획 있는 날
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-500)', padding: '4px 0' }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
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
                    position: 'relative',
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
                  {/* 계획이 있는 날에는 날짜 숫자를 정원으로 감싼다. 완료
                      기록(채워진 점)과 겹쳐도 서로 안 가린다 — 하나는 숫자를
                      감싸고 하나는 그 아래 줄에 있다. */}
                  {plans.has(key) && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: 26, height: 26, marginTop: dayEntries.length > 0 ? -8 : 0,
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%', background: '#FFF0A8',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  <span style={{
                    fontSize: 13, fontWeight: isToday || plans.has(key) ? 700 : 500,
                    color: '#1A1A1E', position: 'relative',
                  }}>{d.getDate()}</span>
                  {dayEntries.length > 0 && renderDayDots(dayEntries)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 주 보기 */}
      {mode === 'calendar' && viewMode === 'week' && (
        <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(selectedDay)), i)).map((d) => {
            const key = toDateKey(d);
            const dayEntries = entriesByDay.get(key) || [];
            const isToday = key === toDateKey(new Date());
            // 완료 기록이 없고 계획만 있는 날 — 이 줄은 "할 것" 이다.
            const dayPlans = dayEntries.length === 0 ? (plans.get(key) || []) : [];
            const planned = dayPlans[0];
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
                  // 점선 = 아직 안 한 것. 실선(완료 기록)과 눈으로 바로 갈린다.
                  border: planned ? '1px dashed #C9A400' : '1px solid var(--line-200)',
                  background: planned ? '#FFFDF2' : (isToday ? 'var(--surface-sub)' : '#FFFFFF'),
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 700, width: 56, flexShrink: 0,
                  color: planned ? '#7A5C00' : '#1A1A1E',
                }}>
                  {WEEKDAY_LABELS[d.getDay()]} {d.getDate()}
                </span>

                {/* 계획한 날은 목록 줄이 아니라 **카드처럼** 보여 준다.
                    제목만 한 줄로 적어 두면 무슨 요리인지 안 그려져서,
                    "이 날 뭐 해 먹기로 했지" 를 또 눌러 봐야 했다. */}
                {planned ? (
                  <>
                    {planned.thumbnail ? (
                      <img
                        src={getProxiedImageUrl(planned.thumbnail)}
                        alt=""
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover',
                                 flexShrink: 0, background: 'var(--surface-sub)' }}
                      />
                    ) : (
                      <span aria-hidden style={{
                        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                        background: 'var(--surface-sub)', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 15,
                      }}>🍽</span>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: 12.5, color: '#1A1A1E', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{planned.title}</span>
                      <span style={{ display: 'block', fontSize: 11, color: '#7A5C00', marginTop: 2 }}>
                        {/* 하루에 여러 끼면 그렇다고 말해 준다. 첫 줄만 보여
                            주고 입 다물면 나머지를 짜 둔 걸 잊는다. */}
                        만들기로 한 요리
                        {dayPlans.length > 1 && ` 외 ${dayPlans.length - 1}개`}
                      </span>
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 12.5, color: dayEntries.length ? 'var(--ink-700)' : 'var(--ink-500)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dayEntries.length > 0
                      ? dayEntries.map((e) => e.title).join(', ')
                      : '기록 없음'}
                  </span>
                )}
                {dayEntries.length > 0 && renderDayDots(dayEntries)}
              </button>
            );
          })}
        </div>
      )}

      {/* 목록 보기 — 여태 만든 것을 최신순으로 죽 훑는다. 전 기간이다. */}
      {(mode === 'mine' || mode === 'household') && (
        <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 줄이 끝없이 이어지면 이 화면을 벗어나는 데만 한참 걸린다.
              머리(고르개)는 고정하고 **목록만** 정해진 높이 안에서 스크롤한다. */}
          {/* 완료와 기록은 둘 다 "요리 이력" 이지만 다른 것이다 —
              완료는 만든 사실, 기록은 남긴 메모. 같은 자리에서 갈라 본다. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 2px' }}>
            {([
              { key: 'done', label: '완료', n: listEntries?.length },
              { key: 'write', label: '기록', n: recorded?.length },
            ] as const).map(({ key, label, n }) => {
              const on = listKind === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setListKind(key)}
                  style={{
                    height: 28, padding: '0 11px', borderRadius: 9999, cursor: 'pointer',
                    border: on ? 'none' : '1px solid var(--line-200)',
                    background: on ? 'var(--ink-900)' : 'var(--surface)',
                    color: on ? '#FFFFFF' : 'var(--ink-700)',
                    fontSize: 12.5, fontWeight: on ? 700 : 500,
                  }}
                >
                  {label}{typeof n === 'number' ? ` ${n}` : ''}
                </button>
              );
            })}

            {/* 기간은 **오른쪽 끝**에. 왼쪽은 무엇을 보는지(완료·기록)이고
                이쪽은 얼마나 넓게 보는지다. */}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {([
                { key: 'all', label: '전체' },
                { key: '365', label: '1년' },
                { key: '90', label: '3개월' },
              ] as const).map(({ key, label }) => {
                const on = span === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSpan(key)}
                    style={{
                      height: 26, padding: '0 8px', borderRadius: 8, cursor: 'pointer',
                      border: 'none', background: on ? 'var(--surface-sub)' : 'transparent',
                      fontSize: 11.5, fontWeight: on ? 700 : 500,
                      color: on ? '#1A1A1E' : 'var(--ink-500)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </span>
          </div>

          {/* 식구 탭에서만 — 내 것을 빼면 "다른 사람들이 뭘 했나" 가 보인다.
              몇 건이 남는지 미리 적어 둔다. 눌러 놓고 텅 비면 고장으로 읽힌다. */}
          {mode === 'household' && listKind === 'done' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 2px 6px',
                            fontSize: 12.5, color: 'var(--ink-700)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hideMine}
                onChange={e => setHideMine(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              내 요리는 빼고 보기
              <span style={{ color: 'var(--ink-500)' }}>
                (식구들 것 {othersCount}건)
              </span>
            </label>
          )}
          {/* 줄이 끝없이 이어지면 이 화면을 벗어나는 데만 한참 걸린다.
              머리(고르개)는 고정하고 목록만 정해진 높이 안에서 스크롤한다. */}
          <div style={{ maxHeight: '58vh', overflowY: 'auto', display: 'flex',
                        flexDirection: 'column', gap: 8, paddingRight: 2 }}>
          {listKind === 'write' ? (
            recorded === null ? (
              <div style={{ padding: '24px 4px', textAlign: 'center',
                            fontSize: 13, color: 'var(--ink-500)' }}>
                불러오는 중이에요...
              </div>
            ) : recorded.length === 0 ? (
              <div style={{ padding: '24px 4px', textAlign: 'center',
                            fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.7 }}>
                {mode === 'household' ? '식구들의 기록은 아직 모으지 않아요.' : '아직 기록한 레시피가 없어요.'}
                <br />
                레시피에서 <b>기록</b>을 누르면 여기 쌓여요.
              </div>
            ) : (
              recorded.map((r: any) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openCookMode({ id: r.id, title: r.title, link: r.link })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 12px', borderRadius: 12,
                    border: '1px solid var(--line-200)', background: '#FFFFFF',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {r.thumbnail ? (
                    <img
                      src={getProxiedImageUrl(r.thumbnail)}
                      alt=""
                      loading="lazy"
                      onError={ev => { (ev.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover',
                               flexShrink: 0, background: 'var(--surface-sub)' }}
                    />
                  ) : (
                    <span aria-hidden style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: 'var(--surface-sub)', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    }}>&#127869;</span>
                  )}
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 13, color: '#1A1A1E', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.title}</span>
                </button>
              ))
            )
          ) : listEntries === null ? (
            <div style={{ padding: '24px 4px', textAlign: 'center',
                          fontSize: 13, color: 'var(--ink-500)' }}>
              불러오는 중이에요...
            </div>
          ) : listEntries.length === 0 ? (
            <div style={{ padding: '24px 4px', textAlign: 'center',
                          fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.7 }}>
              {mode === 'household' && hideMine ? (
                <>식구들이 만든 요리가 아직 없어요.
                <br />
                지금까지의 완료는 전부 <b>내가</b> 한 거예요.</>
              ) : (
                <>아직 만든 요리가 없어요.
                <br />
                레시피에서 <b>완료</b>를 누르면 여기 쌓여요.</>
              )}
            </div>
          ) : (
            [...listEntries]
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
              .map((e, i, arr) => {
                // 같은 날이 이어지면 날짜를 한 번만 찍는다. 매 줄에 같은 날짜가
                // 박히면 다른 날인 줄 알고 다시 읽게 된다.
                const first = i === 0 || arr[i - 1].day !== e.day;
                return (
                  <div key={e.day + '-' + e.recipe_id + '-' + i}>
                    {first && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)',
                                    margin: i === 0 ? '0 0 6px' : '10px 0 6px', padding: '0 2px' }}>
                        {e.day}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openCookMode({ id: e.recipe_id, title: e.title })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '9px 12px', borderRadius: 12,
                        border: '1px solid var(--line-200)', background: '#FFFFFF',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      {e.thumbnail ? (
                        <img
                          src={getProxiedImageUrl(e.thumbnail)}
                          alt=""
                          loading="lazy"
                          onError={ev => { (ev.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                          style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover',
                                   flexShrink: 0, background: 'var(--surface-sub)' }}
                        />
                      ) : (
                        <span aria-hidden style={{
                          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                          background: 'var(--surface-sub)', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        }}>&#127869;</span>
                      )}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', fontSize: 13, color: '#1A1A1E', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{e.title}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
                          {formatTime(e.created_at)}
                          {isInHousehold && e.nickname ? ` · ${e.nickname}` : ''}
                        </span>
                      </span>
                      {isInHousehold && (
                        <span aria-hidden style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: colorForUser(e.user_id, memberIds),
                        }} />
                      )}
                    </button>
                  </div>
                );
              })
          )}
          </div>
        </div>
      )}

      {/* 일 보기 */}
      {mode === 'calendar' && viewMode === 'day' && (
        <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 이 날의 **계획**. 완료 기록과 섞지 않고 위에 따로 둔다 —
              "할 것" 과 "했다" 는 다른 이야기다. */}
          {(plans.get(selectedDay) || []).map((planned: PlannedMeal) => {
            return (
              <button
                key={planned.recipeId}
                type="button"
                onClick={() => openCookMode({
                  id: planned.recipeId, title: planned.title, link: planned.link,
                })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 12, border: '1px dashed #C9A400', background: '#FFFDF2',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {planned.thumbnail && (
                  <img
                    src={getProxiedImageUrl(planned.thumbnail)}
                    alt=""
                    loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A5C00' }}>
                    만들기로 한 요리
                  </span>
                  <span style={{
                    display: '-webkit-box', fontSize: 13.5, fontWeight: 600, color: '#1A1A1E',
                    lineHeight: 1.4, overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{planned.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#7A5C00', marginTop: 3 }}>
                    조리 순서 보기 ›
                  </span>
                </span>
              </button>
            );
          })}

          {(entriesByDay.get(selectedDay) || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-500)', fontSize: 13 }}>
              이 날은 완료한 레시피가 없어요.
            </div>
          ) : (
            (entriesByDay.get(selectedDay) || []).map((e, i) => {
              const dateKey = `${e.recipe_id}-${e.user_id}`;
              const isMine = authUser?.id != null && e.user_id === Number(authUser.id);
              const isEditing = editingDateKey === dateKey;
              return (
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
                {/* 완료 버튼을 실제로 요리한 날 바로 안 누르면 캘린더에 엉뚱한
                    날짜로 찍힌다 — 내가 완료한 기록만 날짜를 고칠 수 있게 한다
                    (다른 식구의 기록은 본인만 고칠 수 있음). */}
                {isMine && (
                  isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <input
                        type="date"
                        value={dateInput}
                        max={toDateKey(new Date())}
                        onChange={(ev) => setDateInput(ev.target.value)}
                        style={{ height: 28, borderRadius: 6, border: '1px solid var(--brand)', fontSize: 12, padding: '0 6px' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCompletedDate(e)}
                        disabled={savingDate}
                        aria-label="완료 날짜 적용"
                        style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: savingDate ? 'default' : 'pointer', opacity: savingDate ? 0.6 : 1 }}
                      >
                        <CheckIcon />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDateInput(e.day);
                        setEditingDateKey(dateKey);
                      }}
                      aria-label="완료일자 수정"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', borderRadius: 9999, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink-700)', background: 'var(--surface-sub)', border: '1px solid var(--line-300)', cursor: 'pointer' }}
                    >
                      <PencilIcon />
                      완료일자 수정
                    </button>
                  )
                )}
              </div>
              );
            })
          )}
        </div>
        )}
      </div>
      </PullToRefresh>

      <BottomNavBar activeTab="cooking-calendar" />
    </div>
  );
};

export default CookingCalendar;
