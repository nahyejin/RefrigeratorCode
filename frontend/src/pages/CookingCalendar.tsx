import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ExpiryAlert from '../components/ExpiryAlert';
import { loadIngredientCategoryMap, lookupShelfLifeDays, estimateExpiry, type CategoryMap, type StorageKind } from '../utils/shelfLife';
import type { FridgeItem } from '../utils/expiry';
import {
  loadPlan, clearAllPlans,
  fetchHouseholdMealPlans, deleteMealPlanFor, clearAllHouseholdMealPlans,
  type PlannedMeal,
} from '../utils/mealPlan';
import { openCookMode } from '../utils/cookMode';
import { getProxiedImageUrl } from '../utils/imageUtils';
import BottomNavBar from '../components/BottomNavBar';
import PullToRefresh from '../components/PullToRefresh';
import DatePickerField from '../components/DatePickerField';
import Sheet from '../components/ui/Sheet';
import Dialog from '../components/ui/Dialog';
import Button from '../components/ui/Button';
import { removeRecipeActionFromDB, removeRecipeFromLocalStorage } from '../utils/recipeStorage';
import { useUsage } from '../components/UsageMeter';
import { useAuth } from '../context/AuthContext';
import { resolveCoupangUrl } from '../utils/coupangLink';
import { getMyIngredients } from '../utils/recipeUtils';
import { track } from '../utils/track';
import GuideOverlay from '../components/GuideOverlay';
import { markUsageGuideFinished, usageGuideTotalSteps, USAGE_GUIDE_STEPS } from '../utils/onboardingPrompts';

type ViewMode = 'day' | 'week' | 'month';
/** 보기 **방식**. 기간(일/주/월)과 다른 층이다 — 목록은 기간이 아니다. */
type Mode = 'calendar' | 'list';
/**
 * **누구 것을 볼지** — 달력·목록 어느 화면에서도 똑같이 적용되는 범위.
 *
 * "화면 방식"(Mode)과는 다른 축인데, 예전엔 [달력][내 요리][우리 식구 요리]
 * 세 탭을 한 줄에 나란히 둬서 이 둘이 섞여 보였다 — "달력 보다가 내 요리로
 * 넘어가면 방금 보던 달력 얘기인 줄 알았는데 완전히 다른 화면(전체 기간
 * 목록)이 나온다"는 지적(2026-09-15). 화면 방식과 무관한 공용 토글로 뺀다.
 * 처음엔 "목록에서만" 두려 했는데, "달력도 똑같이 내 것만/가족 전체를
 * 고를 수 있어야 하지 않냐"는 후속 지적으로 둘 다에 적용한다.
 */
type Scope = 'mine' | 'household';

interface CalendarEntry {
  day: string; // YYYY-MM-DD
  created_at: string; // ISO timestamp
  recipe_id: number | null;
  title: string;
  thumbnail: string;
  user_id: number;
  nickname: string;
  /** 'manual' 이면 앱이 추천하지 않은 요리를 직접 적어 둔 기록 — recipe_id/thumbnail이 없다.
   * 서버가 예전부터 주던 완료 기록에는 이 필드가 없으므로, 없으면 'recipe'로 본다. */
  entry_type?: 'recipe' | 'manual';
  manual_log_id?: number | null;
}

/** 계획도 이제 서버에 있어 그룹원 것이 섞여 보일 수 있어(2026-09-14),
 * 누구 것인지(userId/nickname)를 함께 들고 다닌다. */
interface DisplayPlannedMeal extends PlannedMeal {
  userId: number;
  nickname: string;
}

function getApiUrl(): string {
  return (
    (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    'https://refrigeratorcode-production.up.railway.app'
  );
}

/** 받침 유무로 "을"/"를" 을 고른다. 한글이 아니거나 빈 문자열이면 "(을)를" 로 둘 다 남겨 어색함을 줄인다. */
function eulReul(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return '(을)를';
  return (code - 0xAC00) % 28 !== 0 ? '을' : '를';
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

/**
 * 월 보기에서 **계획이 있는 날** 표식.
 *
 * `#FFF0A8` 하나만 깔아 뒀더니 흰 바탕에서 거의 안 보였다 — 식단을 반영하고
 * 캘린더에 왔는데 "반영이 안 됐다" 고 할 만큼. 채우기를 한 단계 진하게 하고
 * 테두리를 둘러 작은 칸에서도 눈에 걸리게 한다.
 */
const PLAN_MARK_FILL = '#FFE97A';
const PLAN_MARK_RING = '#C9A400';

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

/**
 * 주 단위 장보기 메모 한 장 — "지난 장보기" 히스토리에 쌓인다.
 *
 * 다이어리 조각을 모아 두면 좋겠다는 요청(2026-09-16) — 지금까지는
 * `weekBasket`이 **지금 보고 있는 주**만 서버에서 받아 오는 값이라, 주를
 * 벗어나면(달력을 넘기거나 화면을 나가면) 그 주의 목록·구매 여부가 전부
 * 사라졌다. 주가 바뀌어도 남도록 기기(localStorage)에 주 단위로 스냅샷을 쌓는다.
 */
interface ShoppingMemoEntry {
  /** 그 주의 일요일 날짜(YYYY-MM-DD) — 식별자 겸 정렬 기준. */
  weekKey: string;
  rangeLabel: string;
  items: string[];
  bought: string[];
  updatedAt: string;
}

const SHOPPING_MEMO_KEY = 'cooking_calendar_shopping_memos';
/** 너무 오래 쌓이면 히스토리 탭이 끝없이 길어지므로, 최근 16주(약 4개월)만 남긴다. */
const SHOPPING_MEMO_CAP = 16;

function loadShoppingMemoHistory(): Record<string, ShoppingMemoEntry> {
  try {
    const raw = localStorage.getItem(SHOPPING_MEMO_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveShoppingMemoHistory(data: Record<string, ShoppingMemoEntry>): Record<string, ShoppingMemoEntry> {
  const keys = Object.keys(data).sort((a, b) => b.localeCompare(a));
  const capped: Record<string, ShoppingMemoEntry> = {};
  keys.slice(0, SHOPPING_MEMO_CAP).forEach(k => { capped[k] = data[k]; });
  try {
    localStorage.setItem(SHOPPING_MEMO_KEY, JSON.stringify(capped));
  } catch {
    // 용량 초과 등 — 히스토리 저장만 실패, 화면 동작에는 지장 없음
  }
  return capped;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 그룹원을 색으로 구분하기 위한 팔레트. 인원이 적어(보통 2~4명) 이 정도면 충분하고,
// 브랜드 강조색(노랑)과 겹치지 않는 톤으로 골랐다.
const MEMBER_COLORS = ['#3B82F6', '#F97316', '#22C55E', '#A855F7', '#EF4444', '#06B6D4'];

/** 비로그인(게스트)일 때 기기 완료 기록의 주인으로 쓰는 자리 표시 id.
 * 실제 계정 id와 겹칠 일이 없게 음수로 둔다. */
const GUEST_USER_ID = -1;

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

/**
 * 장보기 메모 한 장 — 지금 보는 주와 지난 주 페이지가 **같은 모양**을 쓰도록
 * 공용 컴포넌트로 뺐다. 체크/링크 동작은 호출부가 넘겨준 콜백에 맡긴다 —
 * 그래야 "지금 주"든 "지난 주"든 같은 확인창(사셨나요) → 냉장고 반영 흐름을
 * 그대로 재사용할 수 있다.
 *
 * 처음엔 종이 다이어리처럼(크림색 배경 + 스프링 구멍 + 손글씨 폰트) 꾸몄는데,
 * "너무 옛날식 UI 같다"는 지적(2026-09-17) — 앱의 나머지 화면은 전부 흰
 * 배경·깔끔한 선·브랜드 노랑 포인트를 쓰는 현대적인 톤인데, 이 카드만 따로
 * 복고풍 종이 질감을 흉내 내고 있어 튀어 보였다. 종이 흉내(구멍·크림색·
 * 손글씨체)는 걷어내고, 앱의 다른 카드·버튼과 같은 언어(흰 배경, `var(--line-200)`
 * 구분선, 체크는 진한 먹색 채움 + 노란 체크, "사러 가기"는 브랜드 노랑 알약
 * 버튼)로 맞췄다. 이 컴포넌트는 이제 자기 배경·테두리를 갖지 않고, 호출부의
 * 흰 박스 안에 내용만 채운다(중첩된 카드 두 겹으로 보이지 않도록).
 */
const ShoppingMemoCard: React.FC<{
  titleNode: React.ReactNode;
  items: string[];
  boughtSet: Set<string>;
  onCheckboxClick: (name: string, currentlyBought: boolean) => void;
  onLinkClick: (name: string) => void;
}> = ({ titleNode, items, boughtSet, onCheckboxClick, onLinkClick }) => (
  <div>
    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-500)' }}>
      {titleNode}
    </div>
    <div style={{ marginTop: 8 }}>
      {items.map(name => {
        const url = resolveCoupangUrl(name);
        const bought = boughtSet.has(name);
        return (
          <div key={name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 2px', borderBottom: '1px solid var(--line-200)',
          }}>
            <button
              type="button"
              onClick={() => onCheckboxClick(name, bought)}
              aria-label={`${name} ${bought ? '샀음 표시 취소' : '샀어요로 표시'}`}
              style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, padding: 0,
                border: bought ? 'none' : '1.5px solid var(--line-300)',
                background: bought ? '#1A1A1E' : '#FFFFFF', color: '#FFD600',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {bought && <CheckIcon />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => onLinkClick(name)}
              style={{
                flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
                color: bought ? 'var(--ink-500)' : 'var(--ink-900)',
                textDecoration: bought ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {name}
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => onLinkClick(name)}
              style={{
                flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#1A1A1E',
                textDecoration: 'none', whiteSpace: 'nowrap',
                padding: '5px 10px', borderRadius: 8, background: '#FFD600',
              }}
            >
              사러 가기
            </a>
          </div>
        );
      })}
    </div>
  </div>
);

const PlusIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <path d="M12 4v16M4 12h16" />
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
function mergeLocalDone(
  server: CalendarEntry[], meId: number, meName: string, serverDoneIds?: Set<number>,
): CalendarEntry[] {
  let local: any[] = [];
  try {
    local = JSON.parse(localStorage.getItem('my_completed_recipes') || '[]');
  } catch {
    local = [];
  }
  if (!Array.isArray(local) || local.length === 0) return server;

  // 서버가 **이미 아는 레시피**면 기기 사본은 건너뛴다. 예전엔 "날짜+레시피" 가
  // 같아야만 겹친다고 봐서, 「완료일자 수정」으로 서버 날짜를 옮기거나 다른
  // 기기에서 지운 뒤에도 기기에 남은 **옛 날짜 사본이 다시 끼어들어** 고친 게
  // 반영 안 된 것처럼 보였다(2026-09-15). `serverDoneIds` 는 내 완료 전체 목록,
  // 못 받았으면 이번 응답에 든 내 완료로 판단한다.
  const known = serverDoneIds ?? new Set(
    server.filter(e => e.user_id === meId && e.recipe_id != null).map(e => Number(e.recipe_id)),
  );
  const extra: CalendarEntry[] = [];
  local.forEach(r => {
    if (!r || !r.id) return;
    const when = r.user_saved_at || r.created_at;
    if (!when || known.has(Number(r.id))) return;
    // 기기에서 누른 시각은 UTC(…Z)로 저장된다. 앞 10자만 자르면 한국 시각
    // 새벽 0~9시에 누른 완료가 **전날**로 찍혔다 — 이 기기 시간대로 날짜를 낸다.
    const parsed = new Date(String(when));
    const day = Number.isNaN(parsed.getTime()) ? String(when).slice(0, 10) : toDateKey(parsed);
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
  // 값을 손으로 적어 두면 반드시 낡는다 — 실제로 식단이 3 이 된 뒤에도
  // 여기만 `크레딧 2` 로 남아 있었다. 서버가 정한 값을 그대로 쓴다.
  const usageNow = useUsage();
  const planCost = (usageNow?.credits as any)?.plan ?? 3;
  const [categoryMap, setCategoryMap] = React.useState<CategoryMap>({});
  const boxes = React.useMemo(readFridgeBoxes, []);

  React.useEffect(() => {
    void loadIngredientCategoryMap().then(setCategoryMap).catch(() => {});
  }, []);

  return (
    <div style={{ margin: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ExpiryAlert boxes={boxes} categoryMap={categoryMap} onPick={() => onGo(false)} />
      {/* 나란히 둔다. **AI 가 먼저**다 — 가로로 긴 줄을 위아래로 두 개 쌓으면 둘 다 "주요 버튼"
          처럼 무거워지고, 무엇이 다른지는 오히려 안 보인다. 옆에 놓으면
          평범한 것과 노란 것이 한눈에 갈린다.

          '짜기' 를 안 쓴다 — 식단을 짜는 건 앱이 하는 일이고, 사람이 하는 건
          **추천을 받는 것**이다. 화면 제목도 `이번 주 식단 추천` 이다. */}
      <div style={{ display: 'flex', gap: 8 }} data-guide-target="weekly-plan-buttons">
        {/* 여기만 노란색·AI 배지·반짝임. 누르는 순간 크레딧이 나가지는 않고,
            조건을 적는 칸으로 데려간다 — 냉장고를 보기도 전에 돈이 나가면
            결과가 마음에 안 들 때 그대로 손해다. */}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', position: 'relative' }}>
          <button
            type="button"
            onClick={() => onGo(true)}
            className="ai-action"
            style={{
              width: '100%', height: 74, borderRadius: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              // `<button>` 은 기본이 가운데 정렬이다. 칸 자체는 flex-start 라
              // 왼쪽에 붙지만, 그 **안에서 두 줄이 서로 가운데로** 맞춰져
              // 짧은 줄이 들여쓴 것처럼 보였다.
              textAlign: 'left',
              justifyContent: 'center', gap: 3, padding: '0 12px',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
              이번 주 AI 식단 추천
            </span>
            {/* 두 줄을 **직접 나눠** 적는다.

                전에는 한 문장을 넣고 줄바꿈을 브라우저에 맡겼다. 그러면 폭에
                따라 1줄이 됐다 2줄이 됐다 하고, 옆의 무료 버튼은 늘 1줄이라
                둘의 글자 아랫단이 어긋나 보였다. 이제 두 버튼 모두
                `무엇을 보고 / 무엇을 해 주고 얼마` 두 줄로 같은 자리에서
                끊긴다. `nowrap` 이라 폭이 좁아져도 줄 수가 안 변한다.

                내용은 그대로다 — 이 버튼과 무료 버튼의 차이는 셋이고
                (냉장고 재료는 둘 다, 내가 적은 요청과 장보기 최소화는 AI만),
                그 둘을 첫 줄과 둘째 줄에 하나씩 놓았다. */}
            <span style={{ fontSize: 11, color: 'rgba(26,26,30,0.65)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
              냉장고 재료 + 내 요청
              <br />
              장보기 최소화 · 크레딧 {planCost}
            </span>
          </button>
          <span className="ai-fab-badge">AI</span>
        </span>

        <button
          type="button"
          onClick={() => onGo(false)}
          style={{
            flex: 1, minWidth: 0, height: 74, borderRadius: 12, cursor: 'pointer',
            border: '1px solid var(--line-200)', background: 'var(--surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            textAlign: 'left',   // 위 AI 버튼과 같은 이유
            justifyContent: 'center', gap: 3, padding: '0 12px',
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
            이번 주 식단 추천
          </span>
          {/* AI 쪽과 **같은 두 줄 구조**. 글자 크기도 11 로 맞춘다
              (전에는 11.5 라 나란히 놓으면 미묘하게 어긋나 보였다). */}
          <span style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
            냉장고 재료만 보고
            <br />
            일주일 식단 · 무료
          </span>
        </button>
      </div>
    </div>
  );
};

/**
 * 마이캘린더 — 완료한 레시피를 날짜별로 돌아보는 화면(탭 이름은 "마이캘린더" 다.
 * "요리 캘린더"였다가 마이페이지 최상단 로그인 배너와의 통일감을 위해
 * 2026-09-15 변경 — "마이페이지"처럼 붙여 쓴다. 컴포넌트·라우트 이름은 그대로 둔다).
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
    () => ((location.state as any)?.mode === 'list' ? 'list' : 'calendar'),
  );
  /** 달력·목록 공용 범위. 그룹 소속이면 기본이 "가족 전체" — 그룹 없으면
   * 어차피 내 것뿐이라 고를 것도 없다(2026-09-15, "그룹 없는 계정은 이
   * 선택 자체가 필요 없다"는 지적). 그룹 여부와 무관하게 이 값으로 초기화해도
   * 안전하다 — 그룹이 없으면 서버가 애초에 내 것만 내려주므로 필터링해도
   * 결과가 같다. */
  const [scope, setScope] = React.useState<Scope>('household');
  /** 목록에 쓰는 **전 기간** 완료 기록. 달력이 쓰는 `entries` 는 보고 있는 달뿐이다. */
  const [allEntries, setAllEntries] = React.useState<CalendarEntry[] | null>(null);
  /** 메모를 남긴 레시피. 완료와 함께 "내 요리 이력" 이라 같은 자리에서 본다. */
  const [recorded, setRecorded] = React.useState<any[] | null>(null);
  /** 그룹원 전체의 기록. 각 줄에 `acted_by`(누가 했는지 닉네임)가 붙어 온다. */
  const [householdRecorded, setHouseholdRecorded] = React.useState<any[] | null>(null);
  const [listKind, setListKind] = React.useState<'done' | 'write'>('done');
  /** `scope === 'household'`일 때 **내 것을 빼고** 볼지. 달력·목록 공용. */
  const [hideMine, setHideMine] = React.useState(false);
  /**
   * 목록에서 볼 기간. 기본은 전체다.
   *
   * 달력의 `< 2026년 9월 >` 을 그대로 가져오지 않는다. 그건 **한 달씩 넘기는**
   * 장치라 "여태 만든 것" 을 보러 온 자리와 안 맞는다. 여기서는 넓은 쪽에서
   * 좁히는 방식이 맞다.
   */
  const [span, setSpan] = React.useState<'all' | '90' | '365' | 'custom'>('all');
  /** 직접 지정한 기간. `span === 'custom'` 일 때만 쓴다. */
  const [range, setRange] = React.useState<{ from: string; to: string }>({ from: '', to: '' });
  /**
   * 아직 적용하지 않은 날짜.
   *
   * 고르는 족족 반영하면 시작일만 고른 순간 "그날부터 오늘까지" 로 한 번
   * 조회된다. 그 중간 결과는 아무도 원한 적이 없다.
   */
  const [draft, setDraft] = React.useState<{ from: string; to: string }>({ from: '', to: '' });
  React.useEffect(() => { setDraft(range); }, [range]);
  const dirty = draft.from !== range.from || draft.to !== range.to;
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [entries, setEntries] = React.useState<CalendarEntry[]>([]);
  // 그룹이 있으면 groupGoal(그룹 전체가 공유하는 하나의 값)을 쓰고,
  // 없으면 personalGoal(내 개인 목표)을 쓴다 — 개인별로 따로 두지 않는다.
  const [groupGoal, setGroupGoal] = React.useState<number | null>(null);
  const [personalGoal, setPersonalGoal] = React.useState<number>(20);
  const [householdSize, setHouseholdSize] = React.useState(1);
  const [memberIds, setMemberIds] = React.useState<number[]>([]);
  /** "완료 기록 추가"에서 "누가 한 요리인가요" 드롭다운에 쓰는 멤버 목록(닉네임 포함). */
  const [householdMembers, setHouseholdMembers] = React.useState<{ id: number; nickname: string }[]>([]);
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
  /** 완료 기록 삭제 확인창 — 잘못 등록한 걸 지우는 길이 조리 상세 시트
   * 안에만 있어 너무 숨어 있다는 지적(2026-09-13)으로, 이 카드에도 직접
   * 지우는 버튼을 둔다. 실수로 지우면 되돌릴 수 없어 확인을 한 번 거친다. */
  const [confirmingCompletedDelete, setConfirmingCompletedDelete] = React.useState<CalendarEntry | null>(null);
  const [deletingCompleted, setDeletingCompleted] = React.useState(false);
  /** 기록(메모) 삭제 확인창 — 목록 탭 "기록"에서 쓴다. 그룹 전체 보기에서는
   * 누가 남겼는지(레시피별로 여러 명일 수 있음) 서버가 아이디까지 주지
   * 않아 대리 삭제가 안 되므로, 내 기록일 때만("내 요리만" 보기) 띄운다. */
  const [confirmingRecordedDelete, setConfirmingRecordedDelete] = React.useState<{ id: number; title: string } | null>(null);
  const [deletingRecorded, setDeletingRecorded] = React.useState(false);

  /**
   * 앱이 추천 안 한 요리를 "오늘 이거 해 먹었다" 정도로만 짧게 남기는 수동
   * 기록. 레시피를 고르지 않고 날짜+제목만 적는다(실사용 요청, 2026-09-14).
   * 그룹 소속이면 다른 식구 몫으로도 남길 수 있어 드롭다운을 같이 둔다.
   */
  const [manualLogOpen, setManualLogOpen] = React.useState(false);
  const [manualLogDate, setManualLogDate] = React.useState('');
  const [manualLogTitle, setManualLogTitle] = React.useState('');
  const [manualLogForUserId, setManualLogForUserId] = React.useState<number | null>(null);
  const [savingManualLog, setSavingManualLog] = React.useState(false);

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);

  /**
   * 몇 번째 불러오기인가. 달 넘기기·당겨서 새로고침·시트에서 완료 해제·가족
   * 되돌리기가 겹치면 요청이 여러 개 동시에 돈다. 늦게 끝난 **옛 요청**이
   * 방금 받은 값을 덮어쓰면 보고 있는 달의 완료 목록이 비거나(다른 달 기준으로
   * 걸러져서) 방금 바꾼 목표가 옛 값으로 돌아갔다(2026-09-15). 최신 번호만 반영한다.
   */
  const loadSeqRef = React.useRef(0);
  /** 그룹 소속 여부를 서버에서 한 번이라도 받았는가 — 설정 저장 경로를 고를 때 쓴다. */
  const householdKnownRef = React.useRef(false);

  const loadCalendar = React.useCallback(async () => {
    // 게스트: 서버를 부르지 않고 기기(localStorage)에 쌓인 완료 기록만으로
    // 이 달 것만 추린다. 그룹·목표·절약액처럼 계정이 있어야 뜻이 있는 값은
    // 초기 기본값 그대로 둔다(아래 UI에서 이런 값의 편집은 로그인 뒤로 막아 둠).
    if (!isLoggedIn || !authUser?.id) {
      const seq = ++loadSeqRef.current;
      const from = toDateKey(monthStart);
      const to = toDateKey(monthEnd);
      setEntries(mergeLocalDone([], GUEST_USER_ID, myName).filter(e => e.day >= from && e.day <= to));
      setIsInHousehold(false);
      setMemberIds([]);
      setHouseholdMembers([]);
      setGroupGoal(null);
      setHouseholdSize(1);
      if (seq === loadSeqRef.current) setLoading(false);
      return;
    }
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const apiUrl = getApiUrl();
      const auth = { headers: { Authorization: `Bearer ${token}` } };

      // 셋을 **동시에** 받는다. 차례로 받으면 그만큼 요청이 겹칠 틈이 길어진다.
      const params = new URLSearchParams({ start: toDateKey(monthStart), end: toDateKey(monthEnd) });
      const [meRes, res, doneRes] = await Promise.all([
        fetch(`${apiUrl}/api/households/me`, auth),
        fetch(`${apiUrl}/api/households/me/completed-calendar?${params.toString()}`, auth),
        // 내 완료 전체(레시피 id) — 기기 사본을 합칠 때 서버가 이미 아는 것을 거른다.
        fetch(`${apiUrl}/api/users/${authUser.id}/completed-recipes`, auth).catch(() => null),
      ]);
      if (seq !== loadSeqRef.current) return;
      const me = meRes.ok ? await meRes.json() : null;
      if (seq !== loadSeqRef.current) return;
      if (meRes.ok) householdKnownRef.current = true;
      setIsInHousehold(!!me?.in_household);
      setMemberIds(me?.in_household ? (me.members || []).map((m: any) => m.id).sort((a: number, b: number) => a - b) : []);
      setHouseholdMembers(me?.in_household ? (me.members || []).map((m: any) => ({ id: m.id, nickname: m.nickname })) : []);

      let serverDoneIds: Set<number> | undefined;
      if (doneRes && doneRes.ok) {
        const d = await doneRes.json().catch(() => null);
        if (d && Array.isArray(d.recipes)) {
          serverDoneIds = new Set(d.recipes.map((r: any) => Number(r.id)));
        }
      }
      if (res.ok) {
        const data = await res.json();
        if (seq !== loadSeqRef.current) return;
        // 달력에도 **기기에만 있는 완료**를 합친다. 로그인 전에 눌렀거나 서버
        // 반영이 실패한 것은 기기에만 남는데, 그것도 내가 만든 요리다.
        // (보고 있는 달 밖의 것은 걸러 낸다 — 이 화면은 그 달을 그린다)
        const from = toDateKey(monthStart);
        const to = toDateKey(monthEnd);
        setEntries(mergeLocalDone(data.entries || [], Number(authUser.id), myName, serverDoneIds).filter(e => e.day >= from && e.day <= to));
        setGroupGoal(typeof data.group_goal === 'number' ? data.group_goal : null);
        setPersonalGoal(typeof data.my_personal_goal === 'number' ? data.my_personal_goal : 20);
        setHouseholdSize(data.household_size || 1);
        setFamilySize(typeof data.family_size === 'number' ? data.family_size : 1);
        setSavingsPerMeal(typeof data.savings_per_meal === 'number' ? data.savings_per_meal : ESTIMATED_SAVINGS_PER_MEAL_DEFAULT);
      }
    } catch (e) {
      console.warn('[CookingCalendar] 조회 실패:', e);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, authUser?.id, monthStart.getTime(), monthEnd.getTime()]);

  React.useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // 가족 알림 팝업(FamilyActionNotice)에서 "복구/취소"를 누르면, 이 화면이
  // 이미 떠 있어도 방금 바뀐 값이 바로 보이게 다시 불러온다(완료 기록 +
  // 요리 계획 둘 다 — planVersion 은 아래에서 선언되지만, 이 효과 콜백은
  // 렌더 뒤에 실행되므로 그때는 이미 값이 잡혀 있다).
  React.useEffect(() => {
    const onUndo = () => { loadCalendar(); setPlanVersion(v => v + 1); };
    window.addEventListener('family-action-undone', onUndo);
    return () => window.removeEventListener('family-action-undone', onUndo);
  }, [loadCalendar]);

  // 조리 시트(CookModeSheet)에서 완료·기록을 켜거나 끄면, 이 화면이 뒤에 떠
  // 있어도 바로 반영한다. 시트는 **서버 반영이 끝난 뒤** 이 이벤트를 보낸다 —
  // 그 전에 다시 불러오면 아직 안 지워진 서버 값이 다시 그려진다.
  React.useEffect(() => {
    const onSynced = (ev: Event) => {
      const type = (ev as CustomEvent).detail?.type;
      if (type !== 'done' && type !== 'write') return;
      setAllEntries(null);
      loadCalendar();
    };
    window.addEventListener('recipe-action-synced', onSynced);
    return () => window.removeEventListener('recipe-action-synced', onSynced);
  }, [loadCalendar]);

  /**
   * 레시피 카드(레시피 목록·인기·상세)의 완료 버튼은 시트를 거치지 않고
   * 바로 기기에 저장한 뒤 서버로 보낸다 — `recipe-action-synced`(서버 반영이
   * 끝난 뒤에만 오는 이벤트)를 안 보낸다. 목록 탭은 처음 열 때마다 새로
   * 불러와서 우연히 최신 상태로 보였지만, 달력 탭은 이 페이지에 이미 떠
   * 있는 동안은 다시 부를 계기가 없어 "목록엔 바로 뜨는데 달력엔 안 뜬다"는
   * 지적(2026-09-15)으로 이어졌다. 마이페이지가 즉시 반영되는 것도 같은
   * `localStorageChange`를 듣기 때문이다 — 기기 저장은 서버 응답을 기다리지
   * 않고 클릭 즉시 일어나므로, 이 이벤트가 가장 빠르다.
   */
  React.useEffect(() => {
    const onLocalChange = (ev: Event) => {
      const key = (ev as CustomEvent<{ key?: string }>).detail?.key;
      if (key !== 'my_completed_recipes' && key !== 'my_recorded_recipes') return;
      setAllEntries(null);
      loadCalendar();
    };
    window.addEventListener('localStorageChange', onLocalChange);
    return () => window.removeEventListener('localStorageChange', onLocalChange);
  }, [loadCalendar]);

  // 다른 앱·탭에 다녀오면 다시 불러온다. 식구가 그 사이 완료를 남기거나 목표·
  // 식구 수를 바꿨어도, 예전엔 달을 넘기거나 당겨서 새로고침해야만 보였다.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadCalendar();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadCalendar]);

  /**
   * 목록을 처음 열 때 **전 기간**을 한 번 불러온다.
   *
   * 달력이 쓰는 `entries` 는 보고 있는 달만 담는다. 그걸 그대로 목록에 썼더니
   * 이번 달에 완료한 게 없으면 "0건" 이 됐다 — 여태 만든 것을 보러 온 화면인데.
   */
  React.useEffect(() => {
    if (mode === 'calendar' || allEntries !== null) return;
    if (!isLoggedIn || !authUser?.id) {
      // 게스트: 서버에 물을 계정이 없으니 기기에 쌓인 것 전부를 그대로 쓴다.
      // `householdRecorded` 도 같은 값으로 채운다 — 아래 `listRecorded` 가
      // "우리 식구 전체" 범위일 때는 이 값을 읽는데, 게스트는 그룹 토글 자체가
      // 안 보여(scope 기본값 'household') 비워 두면 빈 목록으로 보인다.
      let localRecorded: any[] = [];
      try {
        localRecorded = JSON.parse(localStorage.getItem('my_recorded_recipes') || '[]');
      } catch {
        localRecorded = [];
      }
      setAllEntries(mergeLocalDone([], GUEST_USER_ID, myName));
      setRecorded(localRecorded);
      setHouseholdRecorded(localRecorded);
      return;
    }
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

    // 그룹 기록. 그룹이 아니면 서버가 내 것만 돌려주므로 그대로 써도 된다.
    fetch(`${getApiUrl()}/api/households/me/recorded-recipes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => setHouseholdRecorded(d.recipes || []))
      .catch(() => setHouseholdRecorded([]));
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
    if (scope === 'mine') out = out.filter(e => e.user_id === me);
    else if (hideMine) out = out.filter(e => e.user_id !== me);
    if (span === 'custom') {
      if (range.from) out = out.filter(e => e.day >= range.from);
      if (range.to) out = out.filter(e => e.day <= range.to);
    } else if (span !== 'all') {
      const from = toDateKey(addDays(new Date(), -Number(span)));
      out = out.filter(e => e.day >= from);
    }
    return out;
  }, [allEntries, scope, hideMine, span, range, authUser?.id]);

  /** 내 이름. 기기에만 있는 완료에 주인을 붙일 때 쓴다. */
  const myName = (authUser as any)?.nickname || (authUser as any)?.name || '나';

  /**
   * 지금 탭이 보여야 할 기록.
   *
   * `우리 식구 요리` 에서는 그룹 것을 본다. `내 요리는 빼고 보기` 는
   * **오직 나만 기록한 것**을 뺀다 — 나와 식구가 같이 기록한 레시피는 남긴다.
   * (기록은 레시피 한 장에 여러 사람이 묶여 오므로 `acted_by` 로 판단한다)
   */
  const listRecorded = React.useMemo(() => {
    if (scope !== 'household') return recorded;
    const src = householdRecorded;
    if (src === null) return null;
    if (!hideMine) return src;
    return src.filter((r: any) => {
      const by: string[] = Array.isArray(r.acted_by) ? r.acted_by : [];
      return by.some(n => n && n !== myName);
    });
  }, [scope, recorded, householdRecorded, hideMine, myName]);

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

  const handleDeleteCompleted = async () => {
    if (!confirmingCompletedDelete || deletingCompleted) return;
    setDeletingCompleted(true);
    try {
      const target = confirmingCompletedDelete;
      // 대상은 **이 카드의 주인**(target.user_id)이다 — 내가 아닌 식구의
      // 기록일 수도 있다(대리 삭제, 2026-09-14). 항상 내 id로 지우면 남의
      // 카드를 눌러도 내 목록만 지워지는 버그가 된다.
      // 게스트(계정 없음)는 서버에 지울 게 없다 — 기기 사본만 지운다.
      if (target.entry_type === 'manual' && target.manual_log_id != null) {
        if (authUser?.id) {
          const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          await fetch(`${getApiUrl()}/api/users/${target.user_id}/manual-cook-logs/${target.manual_log_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } else if (target.recipe_id != null) {
        if (authUser?.id) {
          await removeRecipeActionFromDB('done', target.user_id, target.recipe_id);
        }
        // 내 완료면 **기기 사본도** 지운다. 안 지우면 `mergeLocalDone` 이 기기에
        // 남은 완료를 다시 합쳐, 삭제를 확정해도 카드가 그대로 남아 있었다
        // (실사용 지적, 2026-09-15).
        if (!authUser?.id || target.user_id === Number(authUser.id)) {
          removeRecipeFromLocalStorage('done', target.recipe_id);
        }
      }
      setConfirmingCompletedDelete(null);
      // 목록(전 기간)도 다시 받게 비운다 — 달력만 새로 그리면 목록 탭엔 남는다.
      setAllEntries(null);
      await loadCalendar();
    } catch (e) {
      console.warn('[CookingCalendar] 완료 기록 삭제 실패:', e);
      alert('완료 기록 삭제 중 오류가 발생했어요.');
    } finally {
      setDeletingCompleted(false);
    }
  };

  /** 목록 탭 "기록 취소". 마이페이지·전체보기 목록의 기록 해제와 같은
   * 동작(서버 반영 + 기기 사본 정리)을 그대로 쓴다 — 게스트는 서버에
   * 지울 게 없어 기기 사본만 지운다. */
  const handleDeleteRecorded = async () => {
    if (!confirmingRecordedDelete || deletingRecorded) return;
    setDeletingRecorded(true);
    try {
      const { id } = confirmingRecordedDelete;
      if (authUser?.id) {
        await removeRecipeActionFromDB('write', Number(authUser.id), id);
      }
      removeRecipeFromLocalStorage('write', id);
      setConfirmingRecordedDelete(null);
      setRecorded(prev => (prev ? prev.filter((r: any) => r.id !== id) : prev));
      setHouseholdRecorded(prev => (prev ? prev.filter((r: any) => r.id !== id) : prev));
    } catch (e) {
      console.warn('[CookingCalendar] 기록 삭제 실패:', e);
      alert('기록 삭제 중 오류가 발생했어요.');
    } finally {
      setDeletingRecorded(false);
    }
  };

  const handleAddManualLog = async () => {
    if (!authUser?.id || savingManualLog) return;
    const title = manualLogTitle.trim();
    if (!title || !manualLogDate) return;
    const targetUserId = manualLogForUserId ?? Number(authUser.id);
    setSavingManualLog(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`${getApiUrl()}/api/users/${targetUserId}/manual-cook-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ log_date: manualLogDate, title }),
      });
      if (res.ok) {
        setManualLogOpen(false);
        setManualLogTitle('');
        await loadCalendar();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '기록 추가에 실패했어요.');
      }
    } catch (e) {
      console.warn('[CookingCalendar] 수동 기록 추가 실패:', e);
      alert('기록 추가 중 오류가 발생했어요.');
    } finally {
      setSavingManualLog(false);
    }
  };

  const nicknameById = React.useMemo(() => {
    const map = new Map<number, string>();
    // 빈 이름을 넣어 두면 `|| '?'` 가 안 걸려서 빈칸으로 보인다. 값이 있을 때만.
    for (const e of entries) if (e.nickname) map.set(e.user_id, e.nickname);
    if (authUser?.id) map.set(Number(authUser.id), myName);
    return map;
  }, [entries]);

  /** 위 `scope`(내 것만/가족 전체) + `hideMine`(가족 전체에서 내 것 빼고)을
   * 적용한 완료 기록. 달력이 그리는 모든 것(칸의 점, 요약, 일/주 보기 카드)이
   * 이 하나를 원본으로 쓴다 — 여기서 한 번만 거르면 아래가 다 맞게 따라온다. */
  const scopedEntries = React.useMemo(() => {
    const me = authUser?.id != null ? Number(authUser.id) : null;
    if (scope === 'mine') return entries.filter(e => e.user_id === me);
    if (hideMine) return entries.filter(e => e.user_id !== me);
    return entries;
  }, [entries, scope, hideMine, authUser?.id]);

  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of scopedEntries) {
      const list = map.get(e.day) || [];
      list.push(e);
      map.set(e.day, list);
    }
    return map;
  }, [scopedEntries]);

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
    for (const e of scopedEntries) {
      if (e.day < visibleRange.start || e.day > visibleRange.end) continue;
      total += 1;
      byUser.set(e.user_id, (byUser.get(e.user_id) || 0) + 1);
    }
    return { total, byUser };
  }, [scopedEntries, visibleRange]);

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
  /**
   * **목표를 다 채웠을 때**의 절약액.
   *
   * 지금까지 한 것만 보여 주면 "이번 달 6회 = 9만 6천원" 에서 끝난다.
   * 목표까지 채우면 얼마인지가 보여야 남은 횟수를 채울 이유가 생긴다.
   */
  const goalSavings = myGoal * savingsPerMeal * familySize;

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

  /**
   * 설정(목표·식구 수·한 끼 추정액)을 **그룹에 저장할지 내 계정에 저장할지.**
   *
   * `isInHousehold` 는 첫 불러오기가 끝나야 채워진다. 그 전에 저장하면 그룹
   * 소속인데도 개인 값에 저장돼, 그룹 값을 읽는 이 화면·식구 화면에서는
   * **바꾼 게 반영이 안 됐다**(2026-09-15). 아직 모르면 서버에 물어본다.
   */
  const resolveInHousehold = async (): Promise<boolean> => {
    if (householdKnownRef.current) return isInHousehold;
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const r = await fetch(`${getApiUrl()}/api/households/me`, { headers: { Authorization: `Bearer ${token}` } });
      const me = r.ok ? await r.json() : null;
      return !!me?.in_household;
    } catch {
      return isInHousehold;
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
      const inHousehold = await resolveInHousehold();
      const url = inHousehold
        ? `${getApiUrl()}/api/households/goal`
        : `${getApiUrl()}/api/users/${authUser.id}/monthly-goal`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monthly_cooking_goal: goal }),
      });
      if (res.ok) {
        if (inHousehold) setGroupGoal(goal);
        else setPersonalGoal(goal);
        // 서버 값으로 다시 맞춘다 — 저장 전에 떠난 불러오기가 옛 값을 덮어쓰지 않게.
        void loadCalendar();
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
      const inHousehold = await resolveInHousehold();
      const url = inHousehold
        ? `${getApiUrl()}/api/households/family-size`
        : `${getApiUrl()}/api/users/${authUser.id}/family-size`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ family_size: size }),
      });
      if (res.ok) { setFamilySize(size); void loadCalendar(); }
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
      const inHousehold = await resolveInHousehold();
      const url = inHousehold
        ? `${getApiUrl()}/api/households/savings-per-meal`
        : `${getApiUrl()}/api/users/${authUser.id}/savings-per-meal`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ savings_per_meal: amount }),
      });
      if (res.ok) { setSavingsPerMeal(amount); void loadCalendar(); }
    } catch (e) {
      console.warn('[CookingCalendar] 한 끼 추정액 저장 실패:', e);
    } finally {
      setEditingSavingsPerMeal(false);
    }
  };

  // ── 아래 훅들은 원래 로그인 분기(early return) **뒤**에 있었다. 인증 확인 중
  // (authLoading)에 한 번 그리고 나서 로그인 화면으로 넘어오면 훅 개수가 달라져
  // React 가 "Rendered more hooks than during the previous render" 로 화면을
  // 깨뜨렸다(새로고침 직후 캘린더가 안 뜨던 원인 중 하나, 2026-09-15). 모든
  // 훅은 분기보다 위에 둔다.
  /**
   * 짜 둔 식단 계획.
   *
   * 완료 기록(`entriesByDay`)과 **섞지 않는다.** 저건 실제로 만든 것이고 이건
   * 아직 계획이다. 같은 목록에 넣으면 "만들었다" 는 기록이 오염된다.
   */
  /**
   * **달마다 누가 몇 번 했는지.**
   *
   * 목표 카드는 이번 달 하나만 말한다. 지난달엔 얼마나 했는지, 식구 중 누가
   * 얼마나 했는지는 아무 데도 안 남아서, 목표를 세워 두는 의미가 "이번 달
   * 게이지" 로만 끝났다.
   */
  const [progressOpen, setProgressOpen] = React.useState(false);
  const [progress, setProgress] = React.useState<{
    goal: number;
    members: { user_id: number; nickname: string }[];
    months: { month: string; total: number; by: { user_id: number; nickname: string; n: number }[] }[];
  } | null>(null);
  React.useEffect(() => {
    if (!progressOpen || progress || !isLoggedIn) return;
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(`${getApiUrl()}/api/households/me/monthly-progress?months=12`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setProgress)
      .catch(() => setProgress({ goal: 0, members: [], months: [] }));
  }, [progressOpen, progress, isLoggedIn]);

  /** `planVersion` 을 바꾸면 계획을 다시 불러온다 — 로컬 변경(비로그인) 직후나
   * 서버 변경(로그인) 직후 화면에 바로 반영하려고 쓰는 리렌더 트리거. */
  const [planVersion, setPlanVersion] = React.useState(0);
  /** 서버가 준 그룹(또는 혼자면 나 혼자) 계획. 비로그인이면 null — 이 경우
   * 아래에서 로컬 저장소만 쓴다(예전 그대로, 비회원 지원). */
  const [householdPlans, setHouseholdPlans] = React.useState<HouseholdPlannedMeal[] | null>(null);

  React.useEffect(() => {
    if (!isLoggedIn) { setHouseholdPlans(null); return; }
    let alive = true;
    const start = toDateKey(new Date());
    const end = toDateKey(addDays(new Date(), 120));
    fetchHouseholdMealPlans(start, end).then(rows => { if (alive) setHouseholdPlans(rows); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, planVersion]);

  /**
   * 계획을 **누구 것인지(userId/nickname)까지 포함해** 보여준다.
   *
   * 로그인 상태면 서버(그룹원 전체)를 기준으로 삼고, 이 기기에만 있고 아직
   * 서버에 안 올라간 것(막 추가한 직후 등)은 놓치지 않게 로컬에서 채운다.
   * 비로그인이면 예전 그대로 로컬 저장소만 본다(2026-09-14, 그룹원끼리
   * "요리 계획 전체 삭제"에서 내 것만/그룹 전체를 고를 수 있어야 하는데,
   * 계획이 이 기기에만 있으면 그 구분 자체가 성립하지 않아서 서버에도
   * 두기 시작했다 — 위 utils/mealPlan.ts 설명 참고).
   */
  const meIdForPlans = authUser?.id != null ? Number(authUser.id) : null;
  const plans = React.useMemo(() => {
    const map = new Map<string, DisplayPlannedMeal[]>();
    // 완료 기록(scopedEntries)과 같은 기준으로 계획도 거른다 — "달력도
    // 내 것만/가족 전체를 똑같이 고를 수 있어야 한다"는 지적(2026-09-15).
    const push = (day: string, meal: DisplayPlannedMeal) => {
      if (scope === 'mine' && meal.userId !== meIdForPlans) return;
      if (scope === 'household' && hideMine && meal.userId === meIdForPlans) return;
      const list = map.get(day) || [];
      list.push(meal);
      map.set(day, list);
    };

    if (isLoggedIn && householdPlans !== null) {
      householdPlans.forEach(p => {
        push(p.day, {
          date: p.day, recipeId: p.recipe_id, title: p.title,
          link: p.link || undefined, thumbnail: p.thumbnail || undefined, why: p.why || undefined,
          userId: p.user_id, nickname: p.nickname,
        });
      });
      const onServer = new Set(
        householdPlans.filter(p => p.user_id === meIdForPlans).map(p => `${p.day}|${p.recipe_id}`)
      );
      loadPlan().forEach(m => {
        if (onServer.has(`${m.date}|${m.recipeId}`)) return;
        push(m.date, { ...m, userId: meIdForPlans ?? -1, nickname: myName });
      });
    } else {
      loadPlan().forEach(m => push(m.date, { ...m, userId: meIdForPlans ?? -1, nickname: myName }));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdPlans, isLoggedIn, planVersion, meIdForPlans, scope, hideMine]);
  /** 「계획 취소」를 눌렀을 때 정말 지울지 한 번 더 확인하는 대상. */
  const [confirmingPlan, setConfirmingPlan] = React.useState<DisplayPlannedMeal | null>(null);
  /** 「요리 계획 전체 삭제」 확인창을 띄우는 중인지. 실수로 다 지우면 되돌릴
   * 수 없어 한 번 더 확인한다(실사용 요청, 2026-09-14). */
  const [confirmingClearAllPlans, setConfirmingClearAllPlans] = React.useState(false);
  /** 전체 삭제 대상 — 내 것만(기본) / 우리 식구 전체. 그룹 소속일 때만 고를 수
   * 있다. 그룹 전체를 고르면 내가 아닌 식구 몫은 지워지면서 당사자에게
   * 알림이 간다(2026-09-14, "그룹 전체를 지울지 선택할 수 있어야 한다"는 요청). */
  const [clearAllScope, setClearAllScope] = React.useState<'mine' | 'household'>('mine');
  const [clearingAllPlans, setClearingAllPlans] = React.useState(false);

  /**
   * **이번 주에 사야 할 것.**
   *
   * 계획은 `{날짜, 레시피 id, 제목}` 만 기기에 들고 있어서 재료를 모른다.
   * 이번 주에 계획한 레시피의 재료를 한 번에 받아 와서, 냉장고에 있는 것을
   * 빼고 남은 것이 장바구니다. AI 식단이 하는 말과 같은 말인데, 그건 짤 때
   * 한 번 보고 끝이다 — 정작 장은 그 뒤에 본다.
   *
   * "이번 주"는 **실제 오늘이 속한 주**로 고정한다(`selectedDay`가 아니라
   * `new Date()` 기준). 예전엔 달력에서 지금 보고 있는 날짜(`selectedDay`)의
   * 주를 썼는데, 그러면 달력을 이리저리 넘길 때마다 "이번 주"의 의미가
   * 같이 바뀌어 버렸다 — 월 보기에서 달을 한 번 넘겼다 돌아오기만 해도
   * `selectedDay`가 그 달 1일 등으로 다시 잡히면서 전혀 다른 주를 가리키고,
   * 그래서 방금 전까지 있던 장보기 메모가 사라지는 등 "달력의 기간 선택과
   * 자꾸 엮여서 점점 이상해진다"는 지적을 받았다(2026-09-17) — 장보기
   * 목록은 "달력에서 지금 보고 있는 기간"이 아니라 **고정된 실제 이번 주**
   * 얘기이므로, 달력 탐색과 완전히 무관하게 분리한다. */
  const [weekBasket, setWeekBasket] = React.useState<string[] | null>(null);
  // `plans` 는 렌더마다 새로 읽으므로 useMemo 로 묶지 않는다. 대신 아래
  // 효과가 **아이디 문자열**을 보고 도니, 같은 주를 다시 그려도 안 부른다.
  const shoppingWeekFrom = toDateKey(startOfWeek(new Date()));
  const shoppingWeekTo = toDateKey(addDays(startOfWeek(new Date()), 6));
  // `plans`는 이미 scope(내 요리만/우리 식구 전체)·hideMine("내 것은 빼고")로
  // 걸러진 값이라, 여기서 다시 거를 필요는 없다 — 이 아이디 목록도 자연히
  // 지금 고른 범위를 따른다.
  const weekPlanIds = (() => {
    const ids = new Set<number>();
    plans.forEach((meals, day) => {
      if (day < shoppingWeekFrom || day > shoppingWeekTo) return;
      meals.forEach(m => { if (m.recipeId) ids.add(Number(m.recipeId)); });
    });
    return [...ids].sort((a, b) => a - b);
  })();
  const weekPlanKey = weekPlanIds.join(',');
  /** "이번 주"가 며칠부터 며칠인지 — "이번 주가 언제 기준인지 모르겠다"는
   * 지적(2026-09-14)으로 라벨 옆에 덧붙인다. MM/DD 로 짧게. */
  const shoppingWeekLabel = `${shoppingWeekFrom.slice(5).replace('-', '/')}~${shoppingWeekTo.slice(5).replace('-', '/')}`;

  /** 주 단위 장보기 메모 히스토리 — 지금 보는 주와 지난 주들의 "다이어리
   * 페이지"가 함께 읽고 쓰는 저장소. 취소선(구매 여부)도 여기 같이 들어
   * 있어, 이전엔 화면을 벗어나면 사라지던 "방금 이걸 샀다" 표시가 주가
   * 바뀌거나 앱을 다시 열어도 남는다.
   *
   * 처음엔 이걸 별도 탭("지난 장보기")으로 뺐는데, 실제로 보니 "달력·목록과
   * 같은 급의 화면 전환"이라기엔 너무 가벼운 정보(그냥 "아, 이런 걸
   * 샀었구나" 확인하는 용도)라는 지적(2026-09-16) — 탭을 없애고, 지금 보는
   * 주 카드 자체를 화살표로 앞뒤 페이지를 넘기는 다이어리로 바꿨다. 재료
   * 하나하나에 날짜를 따로 매기지 않고 **주 단위 페이지**로만 넘기는
   * 이유도 같은 지적: "재료 하나하나 언제 샀는지 계산하게 하지 말고, 그
   * 주에 있던 페이지를 통째로 보여줘라." */
  const [memoHistory, setMemoHistory] = React.useState<Record<string, ShoppingMemoEntry>>(() => loadShoppingMemoHistory());

  /** 어느 주에 대해 갓 계산한 장보기 목록을 메모 한 장으로 저장(또는, 목록이
   * 비면 그 주의 옛 메모를 지운다). 이미 산 걸로 체크했던 재료가 새 목록에
   * 없으면(계획이 바뀌었거나 범위가 좁아짐) 자연히 빠지도록 교집합만 남긴다. */
  const upsertWeekMemo = React.useCallback((weekKey: string, rangeLabel: string, items: string[]) => {
    setMemoHistory(prev => {
      if (items.length === 0) {
        // 지금 이 범위(scope) 기준으로 살 게 없다 — 예전 범위에서 저장된
        // 메모가 남아 있으면 지운다. 안 지우면, 예전엔 "내 것"이 포함돼
        // 있었지만 지금은 "내 것은 빼고"로 걸러진 주를 다시 들여다볼 때
        // 그 옛 메모가 유령처럼 다시 나타난다(실사용 지적, 2026-09-16).
        if (!prev[weekKey]) return prev;
        const next = { ...prev };
        delete next[weekKey];
        return saveShoppingMemoHistory(next);
      }
      const prevBought = new Set(prev[weekKey]?.bought || []);
      const bought = items.filter(n => prevBought.has(n));
      const entry: ShoppingMemoEntry = { weekKey, rangeLabel, items, bought, updatedAt: new Date().toISOString() };
      const prevEntry = prev[weekKey];
      if (prevEntry && prevEntry.items.join(',') === entry.items.join(',') && prevEntry.bought.join(',') === entry.bought.join(',')) {
        return prev; // 내용이 그대로면 굳이 다시 저장하지 않는다(불필요한 리렌더 방지)
      }
      return saveShoppingMemoHistory({ ...prev, [weekKey]: entry });
    });
  }, []);

  React.useEffect(() => {
    // 이 주(weekKey)·라벨을 이 실행 시점의 값으로 붙잡아 둔다 — 저장은 항상
    // **이 fetch가 시작될 때 보고 있던 주**를 기준으로 해야 한다. 예전엔
    // "지금 보는 주가 바뀌면 저장한다"는 별도 효과가 있었는데, 주를 넘기는
    // 순간(재료 목록은 아직 이전 주 것)과 겹치면 **엉뚱한 주에 이전 주
    // 재료가 저장되는** 경합이 있었다(실사용 지적, 2026-09-16 — "가 본 적도
    // 없는 주에 다른 주 재료가 뜬다"). 이 효과 하나에서만 저장하면, 저장이
    // 항상 방금 실제로 계산한 목록과 짝을 이룬다.
    const thisWeekKey = shoppingWeekFrom;
    const thisRangeLabel = shoppingWeekLabel;
    if (weekPlanIds.length === 0) {
      setWeekBasket([]);
      upsertWeekMemo(thisWeekKey, thisRangeLabel, []);
      return;
    }
    let alive = true;
    fetch(`${getApiUrl()}/api/recipes/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: weekPlanIds }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (!alive) return;
        const have = new Set(getMyIngredients().map(x => String(x).trim()).filter(Boolean));
        const need = new Set<string>();
        (d.items || []).forEach((it: any) => {
          (it.ingredients || []).forEach((n: string) => {
            const name = String(n).trim();
            if (name && !have.has(name)) need.add(name);
          });
        });
        const list = [...need];
        setWeekBasket(list);
        upsertWeekMemo(thisWeekKey, thisRangeLabel, list);
      })
      .catch(() => { if (alive) setWeekBasket([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekPlanKey]);

  /**
   * 장보기 목록에서 링크를 타고 나갔다 돌아오면 "사셨나요" 를 묻고, 그렇다고
   * 하면 곧장 내 냉장고에 담는다(2026-09-16, 실사용 요청). 재료마다 보관
   * 방법(냉동/냉장/실온)은 재료 사전 분류로 짐작한다 — 사진 인식처럼 LLM을
   * 매번 부르지 않고도 대부분 맞는 답을 낼 수 있고, 틀려도 냉장고 화면에서
   * 다른 재료처럼 바로 고칠 수 있어 위험이 적다.
   */
  const [weekCategoryMap, setWeekCategoryMap] = React.useState<CategoryMap>({});
  React.useEffect(() => { void loadIngredientCategoryMap().then(setWeekCategoryMap).catch(() => {}); }, []);

  /** 어느 주(weekKey)의 어느 재료를 샀다/취소했다로 표시. 지금 보는 주는 아직
   * 위 저장 효과가 돌기 전(첫 렌더 직후)일 수도 있어, 그 경우엔 `weekBasket`
   * 으로 즉석에서 항목을 채워 넣는다 — 타이밍에 상관없이 항상 반영되게. */
  const setItemBought = React.useCallback((weekKey: string, name: string, bought: boolean) => {
    setMemoHistory(prev => {
      let entry = prev[weekKey];
      if (!entry && weekKey === shoppingWeekFrom && weekBasket && weekBasket.length > 0) {
        entry = { weekKey, rangeLabel: shoppingWeekLabel, items: weekBasket, bought: [], updatedAt: new Date().toISOString() };
      }
      if (!entry) return prev;
      const boughtSet = new Set(entry.bought);
      if (bought) boughtSet.add(name); else boughtSet.delete(name);
      const nextEntry: ShoppingMemoEntry = { ...entry, bought: [...boughtSet], updatedAt: new Date().toISOString() };
      return saveShoppingMemoHistory({ ...prev, [weekKey]: nextEntry });
    });
  }, [shoppingWeekFrom, shoppingWeekLabel, weekBasket]);

  /**
   * 장보기 메모는 달력·목록 카드와 아예 분리된 **자기만의 영역**(화면
   * 맨 아래, 제목이 따로 붙은 별도 박스)에 산다 — 그 카드 안에 있는 한
   * 어디에 두든 "그 탭·보기의 기간 얘기"처럼 읽힌다는 지적(2026-09-17)
   * 으로 아예 밖으로 뺐다. 완전히 분리됐으니, 화살표로 지난 주들을
   * 넘겨 보는 페이지네이션도 이제 안전하게 되살렸다 — 예전엔 이게
   * 달력의 날짜 탐색과 뒤섞여 "뭘 기준으로 넘기는 거냐"는 혼동을
   * 낳았지만, 지금은 이 박스 하나 안에서만 벌어지는 별개의 탐색이라
   * 그럴 일이 없다.
   *
   * 기본 페이지는 **실제 이번 주**(`shoppingWeekFrom`). 화살표로 다른
   * 주를 봐도 달력의 날짜 선택과는 무관하게 이 박스 혼자 움직인다.
   */
  const diaryWeekKeys = React.useMemo(() => {
    const keys = new Set(Object.keys(memoHistory));
    if (weekBasket && weekBasket.length > 0) keys.add(shoppingWeekFrom);
    return [...keys].sort();
  }, [memoHistory, weekBasket, shoppingWeekFrom]);
  const [diaryWeekKey, setDiaryWeekKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (diaryWeekKeys.length === 0) { setDiaryWeekKey(null); return; }
    setDiaryWeekKey(prev => {
      if (prev && diaryWeekKeys.includes(prev)) return prev; // 넘겨 보던 페이지는 그대로 유지
      return diaryWeekKeys.includes(shoppingWeekFrom) ? shoppingWeekFrom : diaryWeekKeys[diaryWeekKeys.length - 1];
    });
  }, [diaryWeekKeys, shoppingWeekFrom]);
  const diaryIndex = diaryWeekKey ? diaryWeekKeys.indexOf(diaryWeekKey) : -1;
  /** 실제 이번 주는 항상 방금 계산한 `weekBasket`을 그대로 믿는다(저장된
   * 메모로 안 넘어감) — 그래야 범위(scope)를 바꿔 이번 주 목록이 비면
   * 옛 저장 내용 대신 곧바로 "없음"으로 반영된다. 지난 주는 저장된
   * 메모를 그대로 쓴다. */
  const getDiaryEntry = React.useCallback((weekKey: string): { rangeLabel: string; items: string[]; bought: string[] } | null => {
    if (weekKey === shoppingWeekFrom) {
      if (!weekBasket || weekBasket.length === 0) return null;
      return { rangeLabel: shoppingWeekLabel, items: weekBasket, bought: memoHistory[weekKey]?.bought || [] };
    }
    const stored = memoHistory[weekKey];
    return stored ? { rangeLabel: stored.rangeLabel, items: stored.items, bought: stored.bought } : null;
  }, [memoHistory, weekBasket, shoppingWeekFrom, shoppingWeekLabel]);

  /** 링크를 누른 재료 — 탭에 돌아왔을 때 이 값이 있으면 "사셨나요" 를 묻는다.
   * 다른 이유로 탭을 벗어났다 돌아왔을 때는 물으면 안 되므로 ref 로 들고 있다가
   * 쓰고 나면 바로 비운다. 어느 **주**의 재료인지도 같이 들고 있어야
   * "지난 장보기" 탭에서 눌러도 그 주의 메모에 반영된다. */
  const pendingPurchaseRef = React.useRef<{ name: string; weekKey: string } | null>(null);
  const [confirmingPurchase, setConfirmingPurchase] = React.useState<{ name: string; weekKey: string } | null>(null);
  const [addingPurchase, setAddingPurchase] = React.useState(false);
  const [justAddedName, setJustAddedName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !pendingPurchaseRef.current) return;
      setConfirmingPurchase(pendingPurchaseRef.current);
      pendingPurchaseRef.current = null;
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  React.useEffect(() => {
    if (!justAddedName) return;
    const t = setTimeout(() => setJustAddedName(null), 2600);
    return () => clearTimeout(t);
  }, [justAddedName]);

  /** 사전 분류로 보관 방법을 짐작한다 — 냉장 → 실온 → 냉동 순으로, 그 방법
   * 자체가 정의돼 있는 첫 번째 것. 대부분의 장보기 재료(신선식품)는 냉장이라
   * 냉장을 먼저 본다. */
  const guessStorageKind = (name: string): StorageKind => {
    const cat = weekCategoryMap[name];
    if (lookupShelfLifeDays(cat, 'fridge', name) != null) return 'fridge';
    if (lookupShelfLifeDays(cat, 'room', name) != null) return 'room';
    if (lookupShelfLifeDays(cat, 'frozen', name) != null) return 'frozen';
    return 'fridge';
  };

  const handleConfirmPurchase = async (bought: boolean) => {
    const pending = confirmingPurchase;
    if (!pending) return;
    const { name, weekKey } = pending;
    setConfirmingPurchase(null);
    if (!bought) return;
    setAddingPurchase(true);
    try {
      const kind = guessStorageKind(name);
      const today = new Date();
      const purchase = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
      const estimated = estimateExpiry(name, kind, purchase, weekCategoryMap);
      const boxes = readFridgeBoxes();
      const next: Record<StorageKind, FridgeItem[]> = {
        frozen: boxes.frozen || [], fridge: boxes.fridge || [], room: boxes.room || [],
      };
      const already = [...next.frozen, ...next.fridge, ...next.room].some(it => it.name === name);
      if (!already) {
        const newItem: FridgeItem = { id: `${name}-${Date.now()}`, name, purchase };
        if (estimated) newItem.estimatedExpiry = estimated;
        next[kind] = [...next[kind], newItem];
        try { localStorage.setItem('myfridge_ingredients', JSON.stringify(next)); } catch { /* 용량 초과 등 — 무시 */ }
        if (authUser?.id) {
          try {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            await fetch(`${getApiUrl()}/api/users/${authUser.id}/ingredients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ingredients: next }),
            });
          } catch (e) {
            console.warn('[CookingCalendar] 구매 반영(서버) 실패 — 기기에는 남음:', e);
          }
        }
      }
      setItemBought(weekKey, name, true);
      setJustAddedName(name);
    } finally {
      setAddingPurchase(false);
    }
  };

  // ── 사용 가이드 14·15단계 ─────────────────────────────────────
  // 냉장고요리 가이드 마지막(13단계, AI 챗봇)에서 `?fromGuide=true` 로 넘어온다.
  // 아래 로그인 여부 분기(early return)보다 **위**에 둔다 — 두 화면 모두
  // 14단계(식단 추천 버튼)가 있고, 훅은 분기 뒤에 둘 수 없다.
  const [showGuide, setShowGuide] = React.useState(false);
  const [guideStep, setGuideStep] = React.useState(0);
  const guideStartedRef = React.useRef(false);
  const calendarGuideSteps = React.useMemo(() => [
    {
      targetSelector: '[data-guide-target="weekly-plan-buttons"]',
      message: '냉장고 재료와 유통기한을 따져서\n일주일 식단을 알뜰하게 짜 드려요.\n필요한 장보기 목록도 함께 만들어져요.',
      position: 'bottom' as const,
    },
    // 월 목표·달력은 로그인해야 있는 화면이다.
    ...(isLoggedIn ? [{
      targetSelector: '[data-guide-target="calendar-goal-area"]',
      message: '이번 달 요리 목표를 세우고\n완료한 요리를 한눈에 모아 보세요.\n목표를 채우면 아낄 수 있는 금액도\n대략 계산해 드려요.\n\n가족 그룹이라면\n식구들과 함께 목표와 현황을\n공유할 수 있어요.',
      position: 'bottom' as const,
    }] : []),
  ], [isLoggedIn]);

  React.useEffect(() => {
    if (authLoading || guideStartedRef.current) return;
    if (new URLSearchParams(location.search).get('fromGuide') !== 'true') return;
    guideStartedRef.current = true;
    // 주소에서 표시를 지운다(새로고침해도 가이드가 또 뜨지 않게). 라우터 상태는
    // 건드리지 않아 이 효과가 다시 돌며 타이머를 끊는 일이 없다.
    window.history.replaceState({}, '', '/cooking-calendar');
    // 정리 함수로 타이머를 취소하지 않는다 — 한 번만 시작하도록 ref 로 막아 둬서,
    // StrictMode 가 효과를 두 번 돌리면 취소된 뒤 다시 걸 기회가 없다.
    setTimeout(() => { setGuideStep(0); setShowGuide(true); }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  /** 로그인했으면 마이페이지(16~18단계)로 잇고, 아니면 여기서 끝낸다. */
  const finishCalendarGuide = (goNext: boolean) => {
    setShowGuide(false);
    if (goNext && isLoggedIn) {
      setTimeout(() => navigate('/my-page?fromGuide=true'), 300);
      return;
    }
    markUsageGuideFinished();
  };

  const guideOverlay = (
    <GuideOverlay
      visible={showGuide}
      currentStep={guideStep}
      onPrevious={() => setGuideStep((s) => Math.max(0, s - 1))}
      onNext={() => {
        if (guideStep < calendarGuideSteps.length - 1) setGuideStep(guideStep + 1);
        else finishCalendarGuide(true);
      }}
      onClose={() => finishCalendarGuide(false)}
      steps={calendarGuideSteps}
      isLastStepConfirm={!isLoggedIn}
      totalSteps={usageGuideTotalSteps(isLoggedIn)}
      startStepOffset={USAGE_GUIDE_STEPS.myFridge + USAGE_GUIDE_STEPS.recipeList}
    />
  );

  if (authLoading) return null;

  // 비로그인이어도 달력·목록(일/주/월)은 **기기에 쌓인 완료·기록**만으로
  // 그대로 보여준다(2026-09-15, "크레딧으로 이미 막아 둔 AI와 달리 달력
  // 자체는 열어도 되지 않냐"는 지적). 그룹·목표·절약액처럼 계정이 있어야만
  // 뜻이 있는 기능만 아래에서 각각 로그인 유도로 남겨 둔다 — 화면 전체를
  // 막는 대신, 계정이 필요한 자리에서만 조용히 안내한다.

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

  /* 장보기 메모 — 달력·목록이 담긴 카드와는 **완전히 다른 박스**로,
   * 제목("계획한 요리 장보기 메모")을 따로 달아 그 카드의 일부가 아니라
   * 화면의 독립된 한 구획임을 분명히 한다(2026-09-17, "박스 자체를
   * 분리하고 제목도 따로 달아야 한다"는 지적). 화면 맨 아래
   * (`<BottomNavBar>` 바로 위)에 **탭/보기 방식과 무관하게** 한 번만
   * 그린다. 안쪽 메모지에는 "계획한 요리 장보기"를 따로 안 적는다 —
   * 이 박스 제목과 겹쳐 보인다는 지적(2026-09-17)으로, 안쪽엔 실제
   * 날짜 범위·개수만 남긴다. */
  const diaryCardNode = (() => {
    if (!diaryWeekKey) return null;
    const entry = getDiaryEntry(diaryWeekKey);
    if (!entry || entry.items.length === 0) return null;
    const boughtSet = new Set(entry.bought);
    const canGoOlder = diaryIndex > 0;
    const canGoNewer = diaryIndex >= 0 && diaryIndex < diaryWeekKeys.length - 1;
    return (
      <div style={{
        margin: '16px 14px 14px', borderRadius: 14,
        border: '1px solid var(--line-200)', background: '#FFFFFF',
        padding: '14px 14px 16px',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E', marginBottom: 10 }}>
          계획한 요리 장보기 메모
        </div>
        {/* `key`를 페이지가 바뀔 때마다 바꿔서(주마다 다른 문자열) 리액트가
            이 div를 새로 만들게 한다 — 그래야 `memo-page-in` 애니메이션이
            페이지를 넘길 때마다 매번 재생된다. 이 박스가 달력과 완전히
            분리된 덕에, 화살표로 지난 주를 넘겨 보는 페이지네이션을 다시
            안전하게 쓸 수 있다(2026-09-17, "좌우로 넘길 수 있게 해 달라"). */}
        <div key={diaryWeekKey} className="memo-page-in">
          <ShoppingMemoCard
            titleNode={(
              <>
                {entry.rangeLabel}
                <span> · {entry.items.length}개</span>
                {boughtSet.size > 0 && <span> · {boughtSet.size}개 샀어요</span>}
              </>
            )}
            items={entry.items}
            boughtSet={boughtSet}
            onCheckboxClick={(name, currentlyBought) => {
              if (currentlyBought) setItemBought(diaryWeekKey, name, false);
              else setConfirmingPurchase({ name, weekKey: diaryWeekKey });
            }}
            onLinkClick={(name) => {
              track('coupang_click', name);
              pendingPurchaseRef.current = { name, weekKey: diaryWeekKey };
            }}
          />
        </div>
        {/* 페이지네이션 — 저장된 주가 둘 이상일 때만 화살표를 보여준다
            (한 장뿐이면 넘길 데가 없다). 달력 자체의 이전/다음(위쪽 일/주/월
            내비게이션)과 같은 화살표 아이콘 버튼 모양으로 맞춰, 앱 전체에서
            "이전/다음"이 같은 생김새로 읽히게 한다(2026-09-17, 디자인 개선
            요청). */}
        {diaryWeekKeys.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => canGoOlder && setDiaryWeekKey(diaryWeekKeys[diaryIndex - 1])}
              disabled={!canGoOlder}
              aria-label="이전 주 장보기 메모"
              style={{
                width: 32, height: 32, border: 'none', background: 'transparent',
                cursor: canGoOlder ? 'pointer' : 'default', opacity: canGoOlder ? 1 : 0.3,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span style={{ fontSize: 11, color: 'var(--ink-500)', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'center' }}>
              {diaryIndex + 1} / {diaryWeekKeys.length}
            </span>
            <button
              type="button"
              onClick={() => canGoNewer && setDiaryWeekKey(diaryWeekKeys[diaryIndex + 1])}
              disabled={!canGoNewer}
              aria-label="다음 주 장보기 메모"
              style={{
                width: 32, height: 32, border: 'none', background: 'transparent',
                cursor: canGoNewer ? 'pointer' : 'default', opacity: canGoNewer ? 1 : 0.3,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 7, lineHeight: 1.5, padding: '0 2px' }}>
          계획한 요리 재료 중 냉장고에 없는 것 · 체크하거나 사고 돌아오면 냉장고에 바로 담아 드려요 · 쿠팡 파트너스 수수료를 받을 수 있어요
        </div>
      </div>
    );
  })();

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 72, paddingBottom: 84 }}>
      {/* 다른 그룹원이 완료·기록·즐겨찾기를 하면 이 화면 내용이 바뀌는데, 그걸
          보려면 예전엔 탭을 벗어났다 돌아오는 수밖에 없었다 — 당겨서
          새로고침으로 그 자리에서 바로 다시 불러올 수 있게 한다. */}
      <PullToRefresh onRefresh={loadCalendar}>
      {/* 비로그인 배너 — 마이페이지 최상단의 "로그인이 필요합니다" 배너와
          같은 모양(자리·여백·글자 크기·버튼)을 그대로 쓴다. 화면마다 문구·
          버튼이 제각각이면 "이 앱이 계정 얘기를 하고 있다"는 인식 자체가
          약해진다는 지적(2026-09-15) — 문구만 이 화면(달력·요리 계획) 얘기로
          바꾸고 나머지는 마이페이지와 통일한다. 한 번 보여 주고 끝내지
          않는다 — 이 기기에만 남는 기록이라 다른 기기로 바꾸면 사라진다는
          사실은 들어올 때마다 알아야 해서 접거나 닫지 않는다. */}
      {!isLoggedIn && (
        <section style={{
          margin: '0 14px 12px', padding: '18px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--surface-sub)', borderRadius: 14,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>로그인이 필요합니다</div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.45 }}>
              달력·요리 계획을 안전하게 관리하려면
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
            로그인
          </Button>
        </section>
      )}
      <FridgeToPlan onGo={withAi => navigate(withAi ? '/plan?ai=1' : '/plan')} />
      {/* 계획 목록을 여기 또 두지 않는다.
          바로 아래가 달력인데 그 위에 같은 내용을 줄로 늘어놓으면, 같은 것을
          두 번 읽게 되고 정작 달력은 화면 밖으로 밀린다. 계획은 달력 안에서
          — 월 보기는 도장, 주 보기는 카드, 일 보기는 그 날 카드로 — 보여 준다.
          (비로그인도 달력을 그대로 쓴다 — 위 배너로 계정이 없다는 것만
          알려 준다) */}

      {/* 월 목표는 **어느 탭에서 보든 같은 이야기**다. 목록 탭에서 감췄더니
          탭을 옮길 때마다 화면 윗동강이 통째로 사라졌다 — 무엇을 보든 이번 달
          목표는 이번 달 목표다. 아래 목록이 다른 기간을 볼 수 있다는 혼란은
          카드 제목이 `2026년 9월 목표` 라고 못 박아서 막는다. */}
      {/* 사용 가이드 15단계가 **월 목표 + 달력·목록 카드 전체**를 한 번에
          가리키려고 둘을 감싼다(모양에는 영향 없음). */}
      <div data-guide-target="calendar-goal-area">
      {(<>
      {/* 월 목표는 "이번 달" 이라는 더 큰 단위 얘기라, 일/주/월 중 무엇을 보고
          있든 항상 같은 값이어야 맞다 — 그래서 일/주/월 전환 버튼보다 위,
          가장 먼저 오는 자리에 두고 "몇 월 목표"인지 숫자로 못 박아 둔다.
          (전에는 이 아래 있어서 "왜 주간 보기에서도 월 목표가 나오지" 라는
          혼란이 있었음) */}
      <div style={{ margin: '0 14px', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-sub)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>
              {anchorDate.getFullYear()}년 {anchorDate.getMonth() + 1}월 목표
            </span>
            {/* 지난 달들을 들여다보는 구멍. 목표는 이번 달 하나만 말하는데,
                쌓인 것을 못 보면 목표를 세워 둔 보람이 없다. */}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => setProgressOpen(true)}
                style={{
                  height: 22, padding: '0 8px', borderRadius: 9999,
                  border: '1px solid var(--line-300)', background: 'var(--surface)',
                  fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer',
                }}
              >
                기록
              </button>
            )}
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
              {/* 목표 저장은 계정에 묶인 값이다(households/users 테이블) — 게스트는
                  고쳐도 저장할 곳이 없으니, 수정 버튼 대신 로그인 유도로 바꾼다. */}
              {isLoggedIn ? (
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
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{ height: 24, padding: '0 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', background: '#FFFFFF', border: '1px solid var(--line-300)', cursor: 'pointer' }}
                >
                  로그인하고 설정
                </button>
              )}
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
        {/* 아직 한 번도 안 했어도 **목표를 채우면 얼마인지**는 보여 준다.
            0원만 띄우고 마는 건 아무 말도 안 하는 것과 같다. */}
        {(monthlyTotal > 0 || myGoal > 0) && (
          <div style={{ marginTop: 10 }}>
            {monthlyTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)' }}>
              {/* 이모지(💰)는 기기·OS마다 그림체가 달라 앱의 다른 검정 선
                  아이콘과 톤이 안 맞는다는 지적을 받아, SectionIcon과 같은
                  선 아이콘 스타일(24 뷰박스, strokeWidth 1.7)로 통일했다. */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                <ellipse cx="12" cy="17" rx="7" ry="3" />
                <ellipse cx="12" cy="12" rx="7" ry="3" />
                <path d="M5 12v5M19 12v5" />
              </svg>
              이번달 절약액 약 {formatWon(estimatedSavings)}원
            </div>
            )}
            {/* 목표까지 가면 얼마인지. 지금까지 한 것만 보여 주면 남은
                횟수를 채울 이유가 화면에 없다. */}
            {myGoal > monthlyTotal && (
              <div style={{
                fontSize: monthlyTotal > 0 ? 11.5 : 12.5,
                fontWeight: monthlyTotal > 0 ? 400 : 600,
                color: monthlyTotal > 0 ? 'var(--ink-500)' : 'var(--ink-700)',
                marginTop: monthlyTotal > 0 ? 3 : 0, lineHeight: 1.5,
              }}>
                이번달 목표 {myGoal}회를 다 채우면 약 <b style={{ color: '#1A1A1E' }}>{formatWon(goalSavings)}원</b>
              </div>
            )}
          </div>
        )}
        {/* 안내 문구(매월 1일 초기화, 공동 목표 여부)만 접어 둔다 — 인원별
            범례는 게이지가 보여주는 핵심 정보라 항상 위에 노출한다(위 참고).

            알약 배지로 뒀더니 **본문보다 눈에 띄었다.** 여기 담기는 건
            부수적인 안내라, 그만한 무게를 가질 자리가 아니다. 테두리를 빼고
            흐린 글자로 둔다 — 찾는 사람만 찾으면 된다. */}
        <button
          type="button"
          onClick={() => setGoalCardExpanded((v) => !v)}
          aria-expanded={goalCardExpanded}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            height: 24,
            padding: 0,
            marginTop: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--ink-500)',
          }}
        >
          {goalCardExpanded ? '자세히 접기' : '자세히 보기'}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-500)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: goalCardExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {goalCardExpanded && (
          <div style={{ marginTop: 10 }}>
            {/* 계산식과 값 고치기는 **접어 둔다.** 매번 읽을 문장이 아니고,
                한 끼 추정액·식구 수는 한 번 정해 두면 다시 손댈 일이 드물다.
                늘 펴 두면 정작 금액보다 이 줄이 길어서 눈이 그쪽으로 간다. */}
            {monthlyTotal > 0 && (
              <>
                {/* 어느 숫자가 어디서 왔는지 한 줄로 못 박는다. `× 6회` 만
                    적혀 있으면 목표 횟수인지 실제 횟수인지 알 수 없다. */}
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.7 }}>
                  <b style={{ color: 'var(--ink-700)' }}>지금까지</b> 1인 한 끼 {formatWon(savingsPerMeal)}원 × 실제 완료 {monthlyTotal}회 × 식구 {familySize}명
                  {' = '}{formatWon(estimatedSavings)}원
                  {myGoal > 0 && (
                    <>
                      <br />
                      <b style={{ color: 'var(--ink-700)' }}>목표까지</b> 1인 한 끼 {formatWon(savingsPerMeal)}원 × 목표 {myGoal}회 × 식구 {familySize}명
                      {' = '}{formatWon(goalSavings)}원
                    </>
                  )}
                  <br />
                  외식·배달 대비 아낀 것으로 어림잡은 값이에요.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 10px' }}>
              {editingSavingsPerMeal ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 4px 0 10px', borderRadius: 9999, background: 'var(--surface)', border: '1px solid var(--brand)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>1인 한 끼</span>
                  <input
                    type="number"
                    value={savingsPerMealInput}
                    onChange={(e) => setSavingsPerMealInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSavingsPerMeal();
                      if (e.key === 'Escape') setEditingSavingsPerMeal(false);
                    }}
                    // 칸을 벗어나면 그대로 저장한다. 체크 버튼을 찾아 눌러야만
                    // 반영되면, 고쳐 놓고 딴 데를 눌렀을 때 말없이 사라진다.
                    // (버튼은 그대로 둔다 — 누르는 사람도 있다)
                    onBlur={() => handleSaveSavingsPerMeal()}
                    autoFocus
                    style={{ width: 56, height: 20, borderRadius: 5, border: '1px solid var(--line-300)', textAlign: 'center', fontSize: 11, padding: 0 }}
                  />
                  <button
                    type="button"
                    // blur 가 먼저 나가면 버튼이 사라져 클릭이 씹힌다.
                    onMouseDown={e => e.preventDefault()}
                    onClick={handleSaveSavingsPerMeal}
                    style={{ height: 22, padding: '0 8px', borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: 'pointer' }}
                  >
                    <CheckIcon />
                    저장
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  // 한 끼 추정액도 계정(개인·그룹)에 저장되는 값이다. 게스트는
                  // 고쳐도 저장이 안 되니, 누르면 바로 로그인으로 보낸다.
                  onClick={() => {
                    if (!isLoggedIn) { navigate('/login'); return; }
                    setSavingsPerMealInput(String(savingsPerMeal));
                    setEditingSavingsPerMeal(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', background: 'var(--surface)', border: '1px solid var(--line-300)', cursor: 'pointer' }}
                >
                  1인 한 끼 {formatWon(savingsPerMeal)}원
                  {isLoggedIn && <span aria-hidden style={{ color: 'var(--ink-500)', display: 'inline-flex' }}><PencilIcon /></span>}
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
                      if (e.key === 'Escape') setEditingFamilySize(false);
                    }}
                    onBlur={() => handleSaveFamilySize()}
                    autoFocus
                    style={{ width: 36, height: 20, borderRadius: 5, border: '1px solid var(--line-300)', textAlign: 'center', fontSize: 11, padding: 0 }}
                  />
                  <button
                    type="button"
                    // blur 가 먼저 나가면 버튼이 사라져 클릭이 씹힌다.
                    onMouseDown={e => e.preventDefault()}
                    onClick={handleSaveFamilySize}
                    style={{ height: 22, padding: '0 8px', borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: 'pointer' }}
                  >
                    <CheckIcon />
                    저장
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!isLoggedIn) { navigate('/login'); return; }
                    setFamilySizeInput(String(familySize));
                    setEditingFamilySize(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', background: 'var(--surface)', border: '1px solid var(--line-300)', cursor: 'pointer' }}
                >
                  식구 {familySize}명
                  {isLoggedIn && <span aria-hidden style={{ color: 'var(--ink-500)', display: 'inline-flex' }}><PencilIcon /></span>}
                </button>
              )}
                </div>
              </>
            )}
            <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.5 }}>
              {isInHousehold
                ? '매월 1일에 0%로 돌아가요. 그룹 공용 목표라 누가 바꿔도 모두에게 적용돼요.'
                : '매월 1일에 0%로 돌아가요.'}
            </div>
          </div>
        )}
      </div>

      </>)}

      {/* 목표 카드와 명확히 분리된 별도 카드에 캘린더를 담아, 모바일 화면에서
          두 영역이 붙어 보이지 않고 한 화면에 같이 들어오게 했다. */}
      <div style={{ margin: '14px 14px 0', borderRadius: 14, border: '1px solid var(--line-200)', background: '#FFFFFF', overflow: 'hidden' }}>
        {/* 화면을 **가르는** 자리라 탭으로 그린다.
            알약으로 뒀더니 아래 일/주/월 알약과 같아 보여서, 화면을 바꾸는
            것인지 결과를 좁히는 필터인지 구분이 안 됐다. 탭은 밑줄로 "지금
            여기 있다" 를 말한다.

            예전엔 여기에 [달력][내 요리][우리 식구 요리] 세 개가 나란히
            있었다. "달력→내 요리로 넘어가면 방금 보던 달력 얘기인 줄
            알았는데 완전히 다른 화면이 나온다"는 지적(2026-09-15)으로,
            "화면 방식"(달력/목록)과 "범위"(내 것/가족 전체)를 분리했다 —
            범위는 아래 별도 줄의 공용 토글로 옮김. */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line-200)',
                      padding: '0 4px' }}>
          {([
            { key: 'calendar', label: '달력' },
            { key: 'list', label: '목록' },
          ] as const).map(({ key, label }) => {
            const on = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                style={{
                  minHeight: 42, padding: '13px 14px', background: 'transparent',
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

        {/* "누구 것을 볼지" — 달력이든 목록이든 공용. 그룹 소속일 때만
            보인다(혼자면 고를 게 없다).
            처음엔 [일][주][월]과 똑같은 낱개 알약 두 개로 만들었는데, 그
            아래 [일][주][월] 알약 세 개까지 겹쳐 "알약 버튼이 너무 많다"는
            지적(2026-09-15). 아래 완료·기록 토글과 같은 **미끄러지는
            테두리 상자** 모양으로 바꿔, 낱개 알약(기간 선택)과 시각적으로
            구분되게 했다. "내 것은 빼고" 체크박스도 줄바꿈 없이 같은 줄
            오른쪽에 두고, 옆의 건수 안내문("식구들이 한 게 아직 없어요" 등)은
            군더더기라 뺐다 — 체크박스 이름만으로 충분히 읽힌다. */}
        {isInHousehold && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 0' }}>
            <div
              role="group"
              aria-label="범위 고르기"
              style={{
                // 두 칸을 **같은 폭**으로(1fr 1fr). 칸 폭이 글자 길이를 따르면
                // "내 요리만"과 "우리 식구 전체"의 폭이 달라, 50% 폭으로 미끄러지는
                // 검은 판이 글자와 어긋나 깨져 보였다(실사용 지적, 2026-09-15).
                position: 'relative', display: 'inline-grid', gridTemplateColumns: '1fr 1fr', flexShrink: 0,
                padding: 3, borderRadius: 10, background: 'var(--surface-sub)',
                border: '1px solid var(--line-200)',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute', top: 3, bottom: 3, left: 3, width: 'calc(50% - 3px)',
                  borderRadius: 8, background: 'var(--ink-900)',
                  transform: scope === 'household' ? 'translateX(100%)' : 'none',
                  transition: 'transform .2s cubic-bezier(.4,0,.2,1)',
                }}
              />
              {([
                { key: 'mine', label: '내 요리만' },
                { key: 'household', label: '우리 식구 전체' },
              ] as const).map(({ key, label }) => {
                const on = scope === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setScope(key); if (key === 'household') setListKind('done'); }}
                    style={{
                      position: 'relative', zIndex: 1, height: 28, padding: '0 12px',
                      border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer',
                      color: on ? '#FFFFFF' : 'var(--ink-500)',
                      fontSize: 12.5, fontWeight: on ? 700 : 500,
                      whiteSpace: 'nowrap', transition: 'color .2s ease',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {scope === 'household' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                              fontSize: 12.5, color: 'var(--ink-700)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hideMine}
                  onChange={e => setHideMine(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>내 것은 빼고</span>
              </label>
            )}
          </div>
        )}

        {/* 기간은 달력일 때만 고른다. 목록은 전 기간이다.
            수동 기록 추가는 일/주/월 어디서 보고 있든 같은 자리에서 누를 수
            있어야 한다는 지적(2026-09-14)으로, 일 보기 안에 숨겨 뒀던 것을
            이 줄로 끌어올려 [일][주][월]과 같은 높이·오른쪽에 둔다. */}
        <div style={{ display: mode === 'calendar' ? 'flex' : 'none', alignItems: 'center',
                      justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '8px 14px 0' }}>
          <div style={{ display: 'flex', gap: 6 }}>
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
                    minHeight: 30,
                    padding: '7px 14px',
                    boxSizing: 'border-box',
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
          <button
            type="button"
            onClick={() => {
              // 수동 기록도 서버(계정)에 남긴다 — 게스트는 로그인부터 안내한다.
              if (!isLoggedIn) { navigate('/login'); return; }
              setManualLogDate(selectedDay);
              setManualLogTitle('');
              setManualLogForUserId(authUser?.id ? Number(authUser.id) : null);
              setManualLogOpen(true);
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px',
              borderRadius: 9999, border: '1px solid var(--line-300)', background: 'var(--surface-sub)',
              fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <PlusIcon /> 수동으로 기록 추가
          </button>
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

        {/* 그룹 요약 + 인원별 색 범례.
            **달력일 때만** 보인다 — 여기 말하는 "이 기간"은 지금 보고 있는
            일/주/월 범위(`visibleRange`)인데, 목록 탭은 그런 범위 개념이
            없다(전체 기간 + 기간 필터). 예전엔 `mode` 와 무관하게 그려서,
            목록 탭에도 이 박스가 뜨고 바로 아래 목록 자체의 "아직 만든 요리가
            없어요" 와 겹쳐 "안내문이 두 개"로 보였다(실사용 지적, 2026-09-15).
            같은 지적으로, 기록이 아예 없을 때는 달력에서도 이 박스를 뺀다 —
            일 보기 카드의 "이 날은 완료한 레시피가 없어요" 같은 빈 상태
            안내가 이미 따로 있어서, 0을 한 번 더 말할 필요가 없다. */}
        {mode === 'calendar' && summary.total > 0 && (
          <div style={{ margin: '8px 14px 0', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-sub)', fontSize: 13, color: 'var(--ink-700)' }}>
            <span>총 {summary.total}회</span>
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
        )}

        {loading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-500)', fontSize: 13 }}>불러오는 중...</div>}

        {/* 월 보기 */}
        {mode === 'calendar' && viewMode === 'month' && (
          <div style={{ padding: '12px 14px 14px' }}>
          {/* 표시가 무슨 뜻인지는 짧게만. 길게 설명할수록 오히려 안 읽힌다.
              전체 삭제는 이 줄 오른쪽에 둔다 — 달력 바로 위, 계획이 있을 때만
              보인다(실사용 요청: "하나씩 취소하는 건 너무 번거롭다", 2026-09-14). */}
          {plans.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-500)' }}>
                <span aria-hidden style={{
                  width: 15, height: 15, flexShrink: 0,
                  borderRadius: '50%', background: PLAN_MARK_FILL,
                  boxShadow: `inset 0 0 0 1.5px ${PLAN_MARK_RING}`,
                }} />
                요리 계획 있는 날 — 눌러서 무슨 요리인지 보기
              </span>
              {/* 줄글 링크로 바꿨더니 "이게 뭔지, 누를 수 있는 건지 모르겠다"는
                  지적(2026-09-16)으로 버튼 모양으로 되돌린다. 다만 빨간
                  알약처럼 위험해 보이지는 않게 — "삭제" 위험성은 눌렀을 때
                  뜨는 확인창(빨간 버튼)이 이미 말해 주므로, 트리거 자체는
                  다른 보조 버튼과 같은 테두리 알약이면 충분하다. */}
              <button
                type="button"
                onClick={() => { setClearAllScope('mine'); setConfirmingClearAllPlans(true); }}
                style={{
                  flexShrink: 0, height: 24, padding: '0 8px', borderRadius: 9999,
                  border: '1px solid var(--line-300)', background: 'var(--surface)',
                  fontSize: 11, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                요리 계획 전체 삭제
              </button>
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
                        borderRadius: '50%', background: PLAN_MARK_FILL,
                        boxShadow: `inset 0 0 0 1.5px ${PLAN_MARK_RING}`,
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

      {/* 달마다 누가 몇 번 했는지. 게이지 하나로는 "이번 달" 밖에 못 말한다. */}
      <Sheet
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        title="월별 기록"
        maxHeight="80dvh"
        dismissLabel="닫기"
      >
        {progress === null ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-500)' }}>
            불러오는 중...
          </div>
        ) : progress.months.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13.5,
                        color: 'var(--ink-500)', lineHeight: 1.7 }}>
            아직 완료한 요리가 없어요.
            <br />
            레시피 카드의 <b>완료</b> 를 누르면 여기 쌓여요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {progress.months.map(m => {
              const goal = progress.goal || 0;
              const pct = goal > 0 ? Math.min(100, Math.round((m.total / goal) * 100)) : 0;
              const hit = goal > 0 && m.total >= goal;
              const [yy, mm] = m.month.split('-');
              return (
                <div key={m.month} style={{
                  border: '1px solid var(--line-200)', borderRadius: 12, padding: '11px 12px',
                  background: 'var(--surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E' }}>
                      {Number(yy)}년 {Number(mm)}월
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>
                      <b style={{ color: hit ? '#3A6B2E' : '#1A1A1E', fontSize: 15 }}>{m.total}</b>
                      {goal > 0 && <> / {goal}회 · {pct}%</>}
                      {hit && <span style={{ color: '#3A6B2E', fontWeight: 700 }}> 달성</span>}
                    </span>
                  </div>

                  {/* 누가 얼마나 했는지를 **한 줄 막대**에 색으로 나눠 담는다.
                      숫자만 늘어놓으면 누가 많이 했는지 한눈에 안 들어온다. */}
                  {goal > 0 && (
                    <div style={{ display: 'flex', height: 8, borderRadius: 9999, marginTop: 7,
                                  background: 'var(--line-200)', overflow: 'hidden' }}>
                      {m.by.map((p, i) => (
                        <span
                          key={p.user_id}
                          style={{
                            width: `${Math.min(100, (p.n / goal) * 100)}%`,
                            background: MEMBER_COLORS[i % MEMBER_COLORS.length],
                            borderRight: i < m.by.length - 1 ? '1px solid var(--surface)' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 7 }}>
                    {m.by.map((p, i) => (
                      <span key={p.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                                                     fontSize: 11.5, color: 'var(--ink-700)' }}>
                        <span aria-hidden style={{
                          width: 8, height: 8, borderRadius: 9999,
                          background: MEMBER_COLORS[i % MEMBER_COLORS.length],
                        }} />
                        {p.nickname || '이름 없음'} {p.n}회
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 있는 그대로 말한다. 지난달 목표를 저장하지 않으므로, 지난달
                달성률은 **지금 목표** 로 셈한 참고값이다. */}
            <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.6, padding: '2px 2px 0' }}>
              지난 달들도 <b>지금 목표({progress.goal}회)</b> 기준으로 셈했어요.
              그때 목표가 달랐다면 참고만 해 주세요.
            </div>
          </div>
        )}
      </Sheet>

      {confirmingClearAllPlans && (
        <Dialog
          open
          onClose={() => setConfirmingClearAllPlans(false)}
          title="요리 계획을 전부 삭제할까요?"
          width={320}
          dismissLabel="아니요"
          actions={[{
            label: clearingAllPlans ? '삭제 중' : '전체 삭제',
            variant: 'danger',
            onClick: async () => {
              if (clearingAllPlans) return;
              setClearingAllPlans(true);
              try {
                if (clearAllScope === 'household') {
                  await clearAllHouseholdMealPlans();
                } else {
                  clearAllPlans();
                }
                setPlanVersion(v => v + 1);
                setConfirmingClearAllPlans(false);
              } finally {
                setClearingAllPlans(false);
              }
            },
          }]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 그룹 소속일 때만 고를 수 있다 — 혼자면 "내 것만"뿐이라 물을
                이유가 없다(2026-09-14, "그룹 전체를 지울지 선택하게 해 달라"는 요청). */}
            {isInHousehold && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {([
                  { key: 'mine', label: '내 것만' },
                  { key: 'household', label: '우리 식구 전체' },
                ] as const).map(({ key, label }) => {
                  const on = clearAllScope === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setClearAllScope(key)}
                      style={{
                        minHeight: 36, padding: '8px 14px', boxSizing: 'border-box',
                        borderRadius: 9999, fontSize: 13, fontWeight: on ? 700 : 500,
                        cursor: 'pointer',
                        background: on ? 'var(--ink-900)' : 'var(--surface)',
                        color: on ? '#FFFFFF' : 'var(--ink-700)',
                        border: `1px solid ${on ? 'var(--ink-900)' : 'var(--line-300)'}`,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <span style={{ wordBreak: 'keep-all' }}>
              {clearAllScope === 'household'
                ? '우리 식구 전체의 앞으로의 요리 계획을 지워요. 내가 한 게 아닌 몫은 그 사람에게 알림이 가서, 직접 되돌릴 수도 있어요.'
                : '앞으로 만들기로 한 내 요리 계획을 지워요. 되돌릴 수 없어요.'}
            </span>
          </div>
        </Dialog>
      )}

      {/* 주 보기 — 아래 여백을 준다. 마지막 요일 카드가 상자 테두리에 딱
          붙어 있으면 더 있는지 없는지 알 수 없고, 손가락으로 집기도 어렵다. */}
      {mode === 'calendar' && viewMode === 'week' && (
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(selectedDay)), i)).map((d) => {
            const key = toDateKey(d);
            const dayEntries = entriesByDay.get(key) || [];
            const isToday = key === toDateKey(new Date());
            const dayPlans = plans.get(key) || [];
            // 완료 기록이 없는 날만 **카드 모양**으로 크게 보여 준다 — 그 줄은
            // 통째로 "할 것" 이기 때문이다. 기록이 있는 날은 기록이 주인공이고,
            // 계획은 그 아래 한 줄로 덧붙인다.
            //
            // 전에는 기록이 하나라도 있으면 그 날 계획을 **아예 안 보여 줬다.**
            // "했다" 와 "할 것" 은 다른 이야기인데, 아침에 뭘 하나 만들어 두면
            // 저녁으로 짜 둔 것이 그대로 사라졌다.
            const planned = dayEntries.length === 0 ? dayPlans[0] : undefined;
            // 일 보기에는 있는 「계획 취소」·「완료 취소」가 주 보기에는
            // 없었다("일별에선 되는데 주별로 넘어가면 없어진다" — 실사용
            // 지적, 2026-09-15). 이 줄은 하루를 **한 줄로 요약**해서 보여주는
            // 자리라 여러 건이 섞여 있으면 어느 것을 취소하는 건지 모호하다
            // — 그래서 "무엇을 취소하는지 뻔한" 경우에만 버튼을 단다:
            // 계획 카드가 뜬 날은 그 계획, 완료 기록이 정확히 하나뿐인
            // 날은 그 기록. 그보다 많으면(하루 여러 건) 일 보기로 들어가야
            // 하나씩 고를 수 있다.
            const singleEntry = !planned && dayEntries.length === 1 ? dayEntries[0] : undefined;
            const singleEntryIsMine = singleEntry != null
              && authUser?.id != null && singleEntry.user_id === Number(authUser.id);
            const canCancelSingleEntry = singleEntry != null
              && (!authUser?.id || singleEntryIsMine || isInHousehold);
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  // 점선 = 아직 안 한 것. 실선(완료 기록)과 눈으로 바로 갈린다.
                  border: planned ? '1px dashed #C9A400' : '1px solid var(--line-200)',
                  background: planned ? '#FFFDF2' : (isToday ? 'var(--surface-sub)' : '#FFFFFF'),
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(key);
                    setViewMode('day');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                    border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
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
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: 12.5,
                        color: dayEntries.length ? 'var(--ink-700)' : 'var(--ink-500)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {dayEntries.length > 0
                          ? dayEntries.map((e) => e.title).join(', ')
                          : '기록 없음'}
                      </span>
                      {dayPlans.length > 0 && (
                        <span style={{
                          display: 'block', fontSize: 11, color: '#7A5C00', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          만들기로 한 것: {dayPlans[0].title}
                          {dayPlans.length > 1 && ` 외 ${dayPlans.length - 1}개`}
                        </span>
                      )}
                    </span>
                  )}
                  {dayEntries.length > 0 && renderDayDots(dayEntries)}
                </button>
                {planned && (
                  <button
                    type="button"
                    onClick={() => setConfirmingPlan(planned)}
                    aria-label={`${planned.title} 계획 취소`}
                    style={{
                      flexShrink: 0, height: 28, padding: '0 10px', borderRadius: 9999,
                      border: '1px solid #D8C27A', background: '#FFFFFF',
                      fontSize: 11.5, fontWeight: 700, color: '#7A5C00', cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    계획 취소
                  </button>
                )}
                {canCancelSingleEntry && singleEntry && (
                  <button
                    type="button"
                    onClick={() => setConfirmingCompletedDelete(singleEntry)}
                    aria-label={singleEntryIsMine || !authUser?.id ? '완료 취소' : `${singleEntry.nickname}님 완료 취소`}
                    style={{
                      flexShrink: 0, height: 28, padding: '0 10px', borderRadius: 9999,
                      border: '1px solid var(--line-300)', background: 'var(--surface-sub)',
                      fontSize: 11.5, fontWeight: 700, color: '#B03A28', cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    완료 취소
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 목록 보기 — 여태 만든 것을 최신순으로 죽 훑는다. 전 기간이다. */}
      {mode === 'list' && (
        <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 줄이 끝없이 이어지면 이 화면을 벗어나는 데만 한참 걸린다.
              머리(고르개)는 고정하고 **목록만** 정해진 높이 안에서 스크롤한다. */}
          {/* 완료와 기록은 둘 다 "요리 이력" 이지만 다른 것이다 —
              완료는 만든 사실, 기록은 남긴 메모. 같은 자리에서 갈라 본다. */}
          {/* 한 상자 안에서 **미끄러지는** 토글. 알약 두 개로 뒀더니 화면 어디를
              봐도 알약이라 지루했고, 둘이 한 쌍이라는 것도 안 보였다. 여기서는
              둘 중 하나를 고르는 것이므로 테두리를 같이 쓰는 편이 맞다. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 2px' }}>
            <div
              role="group"
              aria-label="완료·기록 고르기"
              style={{
                // 두 칸을 **같은 폭**으로(1fr 1fr). 칸 폭이 글자 길이를 따르면
                // "내 요리만"과 "우리 식구 전체"의 폭이 달라, 50% 폭으로 미끄러지는
                // 검은 판이 글자와 어긋나 깨져 보였다(실사용 지적, 2026-09-15).
                position: 'relative', display: 'inline-grid', gridTemplateColumns: '1fr 1fr', flexShrink: 0,
                padding: 3, borderRadius: 10, background: 'var(--surface-sub)',
                border: '1px solid var(--line-200)',
              }}
            >
              {/* 미끄러지는 판. 버튼마다 배경을 켜고 끄면 툭 끊기는데,
                  판 하나가 옮겨 다니면 "여기서 저기로 옮겼다" 가 보인다. */}
              <span
                aria-hidden
                style={{
                  position: 'absolute', top: 3, bottom: 3, left: 3, width: 'calc(50% - 3px)',
                  borderRadius: 8, background: 'var(--ink-900)',
                  transform: listKind === 'write' ? 'translateX(100%)' : 'none',
                  transition: 'transform .2s cubic-bezier(.4,0,.2,1)',
                }}
              />
              {([
                { key: 'done', label: '완료', n: listEntries?.length },
                { key: 'write', label: '기록', n: listRecorded?.length },
              ] as const).map(({ key, label, n }) => {
                const on = listKind === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setListKind(key)}
                    aria-pressed={on}
                    style={{
                      position: 'relative', zIndex: 1, minWidth: 62, height: 28,
                      padding: '0 12px', border: 'none', background: 'transparent',
                      borderRadius: 8, cursor: 'pointer',
                      color: on ? '#FFFFFF' : 'var(--ink-500)',
                      fontSize: 12.5, fontWeight: on ? 700 : 500,
                      transition: 'color .2s ease',
                    }}
                  >
                    {label}{typeof n === 'number' ? ` ${n}` : ''}
                  </button>
                );
              })}
            </div>

            {/* 기간은 **오른쪽 끝**에. 왼쪽은 무엇을 보는지(완료·기록)이고
                이쪽은 얼마나 넓게 보는지다. */}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {([
                { key: 'all', label: '전체' },
                { key: '365', label: '1년' },
                { key: '90', label: '3개월' },
                { key: 'custom', label: '직접' },
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

          {/* 직접 고르는 자리. 퀵 버튼으로 안 되는 구간(작년 여름 같은)이 있다.
              고친 값은 **[적용]** 을 눌러야 반영된다 — 시작일만 고른 순간
              "그날부터 오늘까지" 로 한 번 조회되는 중간 결과는 아무도 원한 적 없다. */}
          {span === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 8px',
                          flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)' }}>기간</span>
              <DatePickerField
                value={draft.from}
                onChange={v => setDraft(d => ({ ...d, from: v }))}
                placeholder="시작일"
                style={{ flex: 1, minWidth: 96 }}
              />
              <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>~</span>
              <DatePickerField
                value={draft.to}
                onChange={v => setDraft(d => ({ ...d, to: v }))}
                placeholder="종료일"
                style={{ flex: 1, minWidth: 96 }}
              />
              <button
                type="button"
                disabled={!dirty}
                onClick={() => setRange(draft)}
                style={{
                  minHeight: 34, padding: '9px 12px', borderRadius: 8, border: 'none',
                  background: dirty ? '#1A1A1E' : 'var(--line-200)',
                  color: dirty ? '#FFFFFF' : 'var(--ink-500)',
                  fontSize: 12.5, fontWeight: 700, cursor: dirty ? 'pointer' : 'default',
                }}
              >
                적용
              </button>
              {dirty && (
                <span style={{ fontSize: 11.5, color: '#B4780A', fontWeight: 600 }}>
                  아직 적용 안 됐어요
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', padding: '0 2px 4px' }}>
            {span === 'all' ? '전 기간'
              : span === '365' ? '최근 1년'
              : span === '90' ? '최근 3개월'
              : (range.from || range.to)
                ? `${range.from || '처음'} ~ ${range.to || '오늘'}`
                : '기간을 골라 주세요'}
            {' 기준이에요.'}
          </div>

          {/* 범위(내 것만/가족 전체) + "내 것은 빼고" 는 이제 위쪽 탭 바로
              아래 공용 토글로 옮겼다(2026-09-15) — 여기 따로 두면 같은
              선택이 두 군데 있는 꼴이라 없앤다. */}
          {/* 줄이 끝없이 이어지면 이 화면을 벗어나는 데만 한참 걸린다.
              머리(고르개)는 고정하고 목록만 정해진 높이 안에서 스크롤한다. */}
          {/* 아래쪽에 여백을 준다. 마지막 카드가 스크롤 경계에 딱 붙어 있으면
              더 있는지 없는지 알 수가 없고, 손가락으로 집기도 어렵다. */}
          <div style={{ maxHeight: '58vh', overflowY: 'auto', display: 'flex',
                        flexDirection: 'column', gap: 8, paddingRight: 2,
                        paddingBottom: 14 }}>
          {listKind === 'write' ? (
            listRecorded === null ? (
              <div style={{ padding: '24px 4px', textAlign: 'center',
                            fontSize: 13, color: 'var(--ink-500)' }}>
                불러오는 중이에요...
              </div>
            ) : listRecorded.length === 0 ? (
              <div style={{ padding: '24px 4px', textAlign: 'center',
                            fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.7 }}>
                {scope === 'household' ? '식구들의 기록은 아직 모으지 않아요.' : '아직 기록한 레시피가 없어요.'}
                <br />
                레시피에서 <b>기록</b>을 누르면 여기 쌓여요.
              </div>
            ) : (
              listRecorded.map((r: any) => {
                // 그룹 전체 보기에서는 이 기록을 누가 남겼는지(레시피 하나에
                // 여러 명일 수 있음) 서버가 개인별 id까지는 안 준다 —
                // "내 요리만" 볼 때만(그러면 이 목록 자체가 전부 내 것) 지울 수
                // 있게 한다(위 handleDeleteRecorded 주석 참고).
                const canDeleteRecorded = !isInHousehold || scope === 'mine';
                return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 12px', borderRadius: 12,
                    border: '1px solid var(--line-200)', background: '#FFFFFF',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openCookMode({ id: r.id, title: r.title, link: r.link })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                      border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
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
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: 13, color: '#1A1A1E', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.title}</span>
                      {/* 누구 기록인지 안 적으면 식구 탭에서 내 것인지 남의 것인지
                          구분이 안 된다. */}
                      {scope === 'household' && Array.isArray(r.acted_by) && r.acted_by.length > 0 && (
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
                          {r.acted_by.join(', ')}
                        </span>
                      )}
                    </span>
                  </button>
                  {canDeleteRecorded && (
                    <button
                      type="button"
                      onClick={() => setConfirmingRecordedDelete({ id: r.id, title: r.title })}
                      aria-label={`${r.title} 기록 취소`}
                      style={{
                        flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 9999,
                        border: '1px solid var(--line-300)', background: 'var(--surface-sub)',
                        fontSize: 11, fontWeight: 700, color: '#B03A28', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      기록 취소
                    </button>
                  )}
                </div>
                );
              })
            )
          ) : listEntries === null ? (
            <div style={{ padding: '24px 4px', textAlign: 'center',
                          fontSize: 13, color: 'var(--ink-500)' }}>
              불러오는 중이에요...
            </div>
          ) : listEntries.length === 0 ? (
            <div style={{ padding: '24px 4px', textAlign: 'center',
                          fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.7 }}>
              {scope === 'household' && hideMine ? (
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
                // 일 보기와 같은 규칙 — 내 것이거나, 같은 그룹이면 대신
                // 취소할 수 있다(당사자 알림 + 복구 가능, 서버 처리).
                const isMine = authUser?.id != null && e.user_id === Number(authUser.id);
                const canCancel = !authUser?.id || isMine || isInHousehold;
                return (
                  <div key={e.day + '-' + e.recipe_id + '-' + i}>
                    {first && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)',
                                    margin: i === 0 ? '0 0 6px' : '10px 0 6px', padding: '0 2px' }}>
                        {e.day}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '9px 12px', borderRadius: 12,
                        border: '1px solid var(--line-200)', background: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openCookMode({ id: e.recipe_id, title: e.title })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                          border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
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
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setConfirmingCompletedDelete(e)}
                          aria-label={isMine || !authUser?.id ? '완료 취소' : `${e.nickname}님 완료 취소`}
                          style={{
                            flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 9999,
                            border: '1px solid var(--line-300)', background: 'var(--surface-sub)',
                            fontSize: 11, fontWeight: 700, color: '#B03A28', cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          완료 취소
                        </button>
                      )}
                    </div>
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
          {/* "만들기로 한 요리" 카드를 볼 수 있는 곳엔 취소도 있어야 한다.
              예전엔 계획을 지우려면 그 레시피 상세(`PlanThisDay`)로 다시
              들어가 날짜를 다시 눌러야 했는데, 여기(캘린더)에서 계획이
              보이는데 정작 여기서는 못 지웠다("취소하는 기능이 어디에도
              없다" — 실사용 지적, 2026-09-12). */}
          {(plans.get(selectedDay) || []).map((planned) => {
            const isMinePlan = planned.userId === meIdForPlans;
            return (
              <div
                key={`${planned.recipeId}-${planned.userId}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 12, border: '1px dashed #C9A400', background: '#FFFDF2',
                }}
              >
                <button
                  type="button"
                  onClick={() => openCookMode({
                    id: planned.recipeId, title: planned.title, link: planned.link,
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
                    border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#7A5C00' }}>
                      만들기로 한 요리
                      {/* 계획도 이제 서버에 있어 그룹원 것이 섞여 보일 수 있다 —
                          누구 것인지 밝힌다(2026-09-14). 이름만 글자로 붙어 있어
                          다른 화면(완료 기록 등)의 색 배지와 안 맞는다는
                          지적(2026-09-16) — 같은 `colorForUser` 점을 붙여
                          한눈에 "이 사람 색이구나" 알아볼 수 있게 맞춘다. */}
                      {isInHousehold && !isMinePlan && (
                        <>
                          <span aria-hidden style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: colorForUser(planned.userId, memberIds),
                          }} />
                          {planned.nickname}
                        </>
                      )}
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
                {/* 완료 기록과 같은 이유로, 같은 그룹이면 서로의 계획도 대신
                    취소할 수 있다(2026-09-14, 당사자에게 알림 + 복구 가능). */}
                <button
                  type="button"
                  onClick={() => setConfirmingPlan(planned)}
                  aria-label={`${planned.title} 계획 취소`}
                  style={{
                    flexShrink: 0, height: 28, padding: '0 10px', borderRadius: 9999,
                    border: '1px solid #D8C27A', background: '#FFFFFF',
                    fontSize: 11.5, fontWeight: 700, color: '#7A5C00', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  계획 취소
                </button>
              </div>
            );
          })}


          {(entriesByDay.get(selectedDay) || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-500)', fontSize: 13 }}>
              이 날은 완료한 레시피가 없어요.
            </div>
          ) : (
            (entriesByDay.get(selectedDay) || []).map((e, i) => {
              const isManual = e.entry_type === 'manual';
              const dateKey = isManual ? `manual-${e.manual_log_id}` : `${e.recipe_id}-${e.user_id}`;
              const isMine = authUser?.id != null && e.user_id === Number(authUser.id);
              // 완료·수동 기록 모두, **같은 그룹이면 대신 지울 수 있다**(대리
              // 삭제 + 당사자 알림, 2026-09-14). 날짜 수정은 내 것만(그대로).
              // 게스트(계정 없음)는 그룹이 있을 수 없으니 `isMine`이 항상
              // false다 — 그렇다고 취소 버튼 자체를 못 보게 하면 안 된다.
              // 기기에 남은 완료는 전부 이 게스트 것이므로 무조건 취소 가능.
              const canManage = !authUser?.id || isMine || isInHousehold;
              const isEditing = editingDateKey === dateKey;
              return (
              <div
                key={`${dateKey}-${i}`}
                // 고치는 중에는 날짜칸 + 저장 + 취소가 한 줄에 다 들어가지 않는다.
                // 셋을 오른쪽에 밀어 넣으면 가운데 칸이 눌려 **닉네임이 줄바꿈**된다.
                // 줄바꿈을 허용해 편집칸을 통째로 아랫줄로 내린다(아래 flexBasis).
                style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line-200)' }}
              >
                {isManual ? (
                  // 수동 기록은 원문이 없어 썸네일이 없다 — 같은 자리를 옅은
                  // 채우기로 채워 목록 정렬이 흔들리지 않게 한다.
                  <div style={{
                    width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                    background: 'var(--surface-sub)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--ink-500)', fontSize: 10, fontWeight: 700,
                  }}>
                    직접 기록
                  </div>
                ) : (
                <img
                  src={getProxiedImageUrl(e.thumbnail || '')}
                  alt=""
                  style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'var(--surface-sub)' }}
                />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {isInHousehold && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: colorForUser(e.user_id, memberIds), flexShrink: 0 }} />
                    )}
                    {/* 닉네임이 길어도 두 줄이 되지 않게. 칸이 좁아지면 말줄임한다 —
                        시간과 이름이 위아래로 갈라지면 한 사람의 정보로 안 읽힌다. */}
                    <span style={{ fontSize: 12, color: 'var(--ink-500)', minWidth: 0,
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatTime(e.created_at)}
                      {isInHousehold ? ` · ${e.nickname}` : ''}
                    </span>
                  </div>
                </div>
                {/* 완료 버튼을 실제로 요리한 날 바로 안 누르면 캘린더에 엉뚱한
                    날짜로 찍힌다 — 내가 완료한 기록만 날짜를 고칠 수 있게 한다.
                    삭제는 **같은 그룹이면 서로 대신할 수 있다** — 식구가
                    로그인을 안 해 뒀어도 완료 기록을 남기거나 잘못된 걸 지워
                    줄 수 있어야 한다는 요청(2026-09-14). 대신 지우면 당사자에게
                    알림이 가고 복구할 수 있다(서버 처리). */}
                {canManage && (
                  isEditing ? (
                    <div style={{
                      // 한 줄을 통째로 쓴다 — 위 칸(제목·닉네임)을 건드리지 않는다.
                      display: 'flex', alignItems: 'center', gap: 6,
                      flexBasis: '100%', justifyContent: 'flex-end', marginTop: -4,
                    }}>
                      {/* 시스템 달력 대신 우리 달력 */}
                      <DatePickerField
                        value={dateInput}
                        onChange={setDateInput}
                        maxDate={new Date()}
                        placeholder="날짜"
                        style={{ height: 28, borderRadius: 6, border: '1px solid var(--brand)', fontSize: 12 }}
                      />
                      {/* 체크 표시만 있는 노란 사각형은 **아무 말도 하지 않는다.**
                          날짜를 고른 뒤 "이걸 누르면 저장되는가" 를 짐작하게
                          만들면 안 된다 — 무엇을 하는 버튼인지 글자로 적는다. */}
                      <button
                        type="button"
                        onClick={() => handleSaveCompletedDate(e)}
                        disabled={savingDate}
                        style={{ height: 26, padding: '0 10px', borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#1A1A1E', background: 'var(--brand)', border: 'none', cursor: savingDate ? 'default' : 'pointer', opacity: savingDate ? 0.6 : 1 }}
                      >
                        <CheckIcon />
                        {savingDate ? '저장 중' : '저장'}
                      </button>
                      {/* 잘못 눌러 편집으로 들어온 사람에게 나갈 길을 준다.
                          저장 말고는 빠져나올 방법이 없으면, 고칠 마음이 없어도
                          아무 날짜나 저장하게 된다. */}
                      <button
                        type="button"
                        onClick={() => setEditingDateKey(null)}
                        style={{ height: 26, padding: '0 8px', borderRadius: 6, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {isMine && !isManual && (
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
                      )}
                      {/* 잘못 등록한 완료 기록을 지우는 길이 조리 상세 시트
                          안에만 있어 너무 숨어 있다는 지적(2026-09-13) —
                          이 카드에 바로 둔다. 아이콘만 있던 휴지통 버튼을
                          "계획 취소"와 같은 글자 버튼(명칭 "완료 취소")으로
                          통일 — 달력·목록 어디서 봐도 같은 말로 읽힌다
                          (실사용 지적, 2026-09-15). */}
                      <button
                        type="button"
                        onClick={() => setConfirmingCompletedDelete(e)}
                        aria-label={isMine || !authUser?.id ? '완료 취소' : `${e.nickname}님 완료 취소`}
                        style={{
                          flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 9999,
                          border: '1px solid var(--line-300)', background: 'var(--surface-sub)',
                          fontSize: 11, fontWeight: 700, color: '#B03A28', cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        완료 취소
                      </button>
                    </div>
                  )
                )}
              </div>
              );
            })
          )}

        </div>
        )}

        {/* 장보기 링크 타고 나갔다 돌아왔을 때 뜨는 "사셨나요" — 위 장보기
            목록에서 링크를 누르면 새 탭이 열리고 이 탭은 그대로 있다가,
            탭이 다시 보이는(visibilitychange) 순간 뜬다. */}
        {confirmingPurchase && (
          <Dialog
            open
            onClose={() => handleConfirmPurchase(false)}
            title={`${confirmingPurchase.name} 사셨나요?`}
            width={300}
            dismissLabel="아니요"
            actions={[{
              label: addingPurchase ? '담는 중' : '네, 샀어요',
              onClick: () => handleConfirmPurchase(true),
            }]}
          >
            <span style={{ wordBreak: 'keep-all' }}>
              오늘 날짜로 내 냉장고에 바로 담아요.
              <br />
              보관 방법은 재료에 맞춰 정할게요.
            </span>
          </Dialog>
        )}
        {justAddedName && (
          <div style={{
            position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)',
            zIndex: 'var(--z-toast)' as any, background: '#1A1A1E', color: '#FFD600',
            padding: '10px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 700,
            whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,.25)',
          }}>
            {justAddedName}이(가) 내 냉장고에 추가되었어요
          </div>
        )}

        {/* 계획·완료·기록 삭제 확인창 — 일 보기뿐 아니라 주 보기·목록 탭에서도
            "계획 취소"/"완료 취소"/"기록 취소" 버튼으로 띄운다. 예전엔 이
            다이얼로그들이 일 보기 블록 안에 있어서 다른 화면에서 누르면
            상태만 켜지고 아무것도 안 뜨는 문제가 있었다(바로 아래 "수동으로
            기록 추가"와 같은 원인, 2026-09-15) — viewMode·mode 와 무관하게
            항상 렌더되도록 밖으로 뺐다. */}
        {confirmingPlan && (
          <Dialog
            open
            onClose={() => setConfirmingPlan(null)}
            title="계획을 취소할까요?"
            width={320}
            dismissLabel="아니요"
            actions={[{
              label: '취소하기',
              variant: 'danger',
              onClick: async () => {
                // **이 계획 자신의 날짜**로 지운다 — 예전엔 `selectedDay`(일
                // 보기가 지금 보여주는 날)를 썼는데, 주 보기에서 그 날로
                // 들어가지 않고 바로 "계획 취소"를 누르면 엉뚱한 날짜의
                // 계획이 지워질 뻔했다(2026-09-15, 주 보기에도 취소 버튼을
                // 다는 과정에서 발견).
                await deleteMealPlanFor(confirmingPlan.userId, confirmingPlan.date, confirmingPlan.recipeId);
                setPlanVersion(v => v + 1);
                setConfirmingPlan(null);
              },
            }]}
          >
            <span style={{ wordBreak: 'keep-all' }}>
              <b>{confirmingPlan.title}</b>{eulReul(confirmingPlan.title)} 만들기로 한 계획을 지워요.
              {/* 게스트는 `meIdForPlans` 가 null이라 항상 "다른 사람 것" 으로
                  잘못 판정돼(-1 !== null) 본인 계획인데도 "나님에게 알림이…"
                  라고 뜰 뻔했다(2026-09-15) — 로그인 상태에서만 이 문구를 본다. */}
              {' '}{!!authUser?.id && confirmingPlan.userId !== meIdForPlans && `${confirmingPlan.nickname}님에게 알림이 가고, 되돌릴 수 있어요.`}
            </span>
          </Dialog>
        )}

        {confirmingCompletedDelete && (
          <Dialog
            open
            onClose={() => setConfirmingCompletedDelete(null)}
            title="완료 기록을 삭제하시겠습니까?"
            width={320}
            dismissLabel="아니요"
            actions={[{
              label: deletingCompleted ? '삭제 중' : '삭제하기',
              variant: 'danger',
              onClick: handleDeleteCompleted,
            }]}
          >
            <span style={{ wordBreak: 'keep-all' }}>
              <b>{confirmingCompletedDelete.title}</b>
              {eulReul(confirmingCompletedDelete.title)}
              {' '}{confirmingCompletedDelete.entry_type === 'manual' ? '기록을' : '완료한 기록을'} 지워요.
              {' '}{!authUser?.id || confirmingCompletedDelete.user_id === Number(authUser.id)
                ? '되돌릴 수 없어요.'
                : `${confirmingCompletedDelete.nickname}님에게 알림이 가고, 되돌릴 수 있어요.`}
            </span>
          </Dialog>
        )}

        {confirmingRecordedDelete && (
          <Dialog
            open
            onClose={() => setConfirmingRecordedDelete(null)}
            title="기록을 삭제하시겠습니까?"
            width={320}
            dismissLabel="아니요"
            actions={[{
              label: deletingRecorded ? '삭제 중' : '삭제하기',
              variant: 'danger',
              onClick: handleDeleteRecorded,
            }]}
          >
            <span style={{ wordBreak: 'keep-all' }}>
              <b>{confirmingRecordedDelete.title}</b>
              {eulReul(confirmingRecordedDelete.title)} 남긴 기록을 지워요. 되돌릴 수 없어요.
            </span>
          </Dialog>
        )}

        {/* "수동으로 기록 추가" 팝업 — 일/주/월 어디서든 누를 수 있는 버튼(위
            [일][주][월] 옆)인데, 이 팝업이 일 보기 블록 안에 갇혀 있어서
            주/월 보기에서 누르면 **아무 일도 안 일어났다**(실사용 지적,
            2026-09-15). viewMode 와 무관하게 항상 렌더되도록 밖으로 뺐다. */}
        {manualLogOpen && (
          <Dialog
            open
            onClose={() => setManualLogOpen(false)}
            title="완료 기록 추가"
            width={320}
            dismissLabel="취소"
            actions={[{
              label: savingManualLog ? '추가 중' : '추가하기',
              onClick: handleAddManualLog,
            }]}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', wordBreak: 'keep-all' }}>
                앱에 없던 요리도, 만든 것을 텍스트로 짧게 기록해놔요.
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 6 }}>날짜</div>
                <DatePickerField
                  value={manualLogDate}
                  onChange={setManualLogDate}
                  maxDate={new Date()}
                  placeholder="날짜"
                  style={{ height: 40, borderRadius: 8, border: '1px solid var(--line-300)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 6 }}>무엇을 만들었나요</div>
                <input
                  type="text"
                  value={manualLogTitle}
                  onChange={ev => setManualLogTitle(ev.target.value)}
                  placeholder="예: 김치찌개"
                  maxLength={100}
                  style={{ height: 40, borderRadius: 8, border: '1px solid var(--line-300)', fontSize: 13, width: '100%', boxSizing: 'border-box', padding: '0 10px' }}
                />
              </div>
              {/* 그룹 소속일 때만 — 요리는 식구가 했는데 로그인은 다른 사람이
                  해 뒀을 수 있다(실사용 요청, 2026-09-14). 본인 몫이 아니면
                  당사자에게 알림이 간다. */}
              {isInHousehold && householdMembers.length > 1 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 6 }}>누가 한 요리인가요</div>
                  <select
                    value={manualLogForUserId ?? ''}
                    onChange={ev => setManualLogForUserId(Number(ev.target.value))}
                    style={{ height: 40, borderRadius: 8, border: '1px solid var(--line-300)', fontSize: 13, width: '100%', boxSizing: 'border-box', padding: '0 10px', background: 'var(--surface)' }}
                  >
                    {householdMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {authUser?.id != null && m.id === Number(authUser.id) ? `${m.nickname}(나)` : m.nickname}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Dialog>
        )}

        {/* 장보기 메모 — 달력·목록 탭이 담긴 카드 밖, 화면 맨 끝에 탭/보기
            방식과 무관하게 항상 하나만 둔다. 위 `diaryCardNode` 설명 참고
            (2026-09-17, "달력의 기간 선택 영역 안에 있으니 자꾸 그것과
            엮여 보인다"는 지적). */}
        {diaryCardNode}
      </div>
      </div>
      </PullToRefresh>

      <BottomNavBar activeTab="cooking-calendar" />
      {guideOverlay}
    </div>
  );
};

export default CookingCalendar;
