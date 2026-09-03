import React from 'react';
import {
  type Usage,
  getAuthToken,
  getCachedUsage,
  hasPendingRequest,
  isLow,
  refreshUsage,
  remainingRatio,
  requestMoreUsage,
  resetLabel,
  subscribeUsage,
} from '../utils/usage';

/**
 * AI 사용량 표시.
 *
 * 자리마다 성격이 다르다 (USAGE_QUOTA_PLAN.md 5절).
 *  - `badge` : 아이콘 모서리. **부족할 때만** 나온다
 *  - `line`  : 시트·챗 패널 헤더. 기능을 열었을 때 한 줄
 *  - `gauge` : 마이페이지. 막대 + 리셋 시각 + 추가 요청
 *
 * 값은 전부 서버(`/api/usage`)에서 온다. 프론트에서 다시 계산하지 않는다 —
 * 두 곳에서 세면 반드시 어긋난다.
 */

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

/**
 * 이 계정이 관리자인지. 관리자에게만 어드민 입구를 보여주기 위한 것이다.
 *
 * ⚠️ 이건 **화면 편의일 뿐 보안이 아니다.** 실제 권한은 서버가 `/api/admin/*`
 * 마다 DB 의 is_admin 을 확인한다. 여기서 참이 나와도 서버가 거부하면 못 본다.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const token = getAuthToken();
    if (!token) return;
    fetch(`${API_BASE_URL}/api/admin/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => alive && setIsAdmin(!!d?.is_admin))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return isAdmin;
}

/** 사용량을 구독한다. 화면 어디서 갱신되든 함께 바뀐다. */
export function useUsage(): Usage | null {
  const [usage, setUsage] = React.useState<Usage | null>(getCachedUsage());

  React.useEffect(() => {
    const unsubscribe = subscribeUsage(setUsage);
    if (!getCachedUsage()) void refreshUsage();
    return unsubscribe;
  }, []);

  return usage;
}

const YELLOW = '#FFD600';
const RED = '#D14343';

/** 남은 양에 따른 색. 빠듯할 때만 빨강으로 바뀐다. */
function toneOf(ratio: number): string {
  if (ratio <= 0.05) return RED;
  return YELLOW;
}

/**
 * 아이콘 모서리 배지.
 *
 * 평소에는 **아무것도 그리지 않는다.** 많이 남았을 때 숫자를 들이밀면
 * "아껴 써야 하나" 싶어 오히려 안 쓰게 된다. 20% 이하로 떨어질 때만 알린다.
 */
export const UsageBadge: React.FC = () => {
  const usage = useUsage();
  if (!isLow(usage) || !usage) return null;

  const left = Math.min(usage.balance, usage.daily_remaining);
  return (
    <span
      aria-label={`남은 사용량 ${left}`}
      style={{
        position: 'absolute',
        // 우상단은 "AI" 배지(.ai-fab-badge, top/right -4)가 이미 쓰고 있다.
        // 같은 자리에 두면 겹쳐서 보이지 않는다 — 실제로 그렇게 만들었다가 고쳤다.
        bottom: -5,
        left: -5,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9999,
        background: left === 0 ? RED : '#1A1A1E',
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '18px',
        textAlign: 'center',
        pointerEvents: 'none',
        border: '2px solid #FFFFFF',
        zIndex: 1,
      }}
    >
      {left}
    </span>
  );
};

/**
 * 시트·챗 패널 헤더 한 줄.
 *
 * 기능을 쓰려고 연 시점이 알려주기 가장 좋은 때다. 다 썼을 때는 막다른 길로
 * 끝내지 않고 언제 다시 채워지는지 말해 준다.
 */
export const UsageLine: React.FC<{ style?: React.CSSProperties; compact?: boolean }> = ({
  style,
  compact = false,
}) => {
  const usage = useUsage();
  if (!usage) return null;

  const out = usage.balance <= 0 || usage.daily_remaining <= 0;
  const daily = usage.daily_remaining < usage.balance;

  /**
   * `compact` — 챗 패널 헤더처럼 **폭이 좁은 자리**용.
   *
   * 헤더는 아바타(36)와 버튼 두 개(40×2) 사이에 끼어 있어 남는 폭이 150px 남짓이다.
   * 거기에 "이번 주 0 / 15 · 오늘은 10번 더 · 로그인하면 더 넉넉해요" 를 다 넣으면
   * 두세 줄로 접혀 제목을 밀어낸다(실제로 그랬다).
   * 좁은 자리에서는 **한 줄로 끝나는 것만** 남기고, 자세한 안내는 넓은 자리
   * (카메라 시트 · 마이페이지)에서 한다.
   */
  const parts: React.ReactNode[] = [];
  if (usage.is_guest) {
    // 비회원도 체험분은 쓴다. 다 쓴 뒤에 **얼마를 주는지**로 말한다 —
    // 그때가 가입 의사가 가장 높은 순간이다.
    parts.push(
      out
        ? (compact ? '가입하면 더' : `가입하면 ${usage.signup_credits}개를 드려요`)
        : (compact ? '체험 중' : `체험 ${usage.guest_trial}회 중`),
    );
  } else if (out) {
    parts.push(daily ? '내일 다시 이어서' : '충전하거나 월요일을 기다려요');
  } else if (!compact) {
    if (daily) parts.push(`오늘은 ${usage.daily_remaining}번 더`);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        // 좁은 자리에서는 줄을 절대 늘리지 않는다. 넘치면 말줄임.
        flexWrap: compact ? 'nowrap' : 'wrap',
        overflow: compact ? 'hidden' : undefined,
        whiteSpace: compact ? 'nowrap' : undefined,
        textOverflow: compact ? 'ellipsis' : undefined,
        minWidth: 0,
        fontSize: 12,
        color: 'var(--ink-500)',
        ...style,
      }}
    >
      <span style={{ fontWeight: 600, color: out || usage.is_guest ? RED : 'var(--ink-700)', flexShrink: 0 }}>
        {`남은 크레딧 ${usage.balance}`}
      </span>
      {parts.map((text, i) => (
        <span key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>· {text}</span>
      ))}
    </div>
  );
};

/**
 * 마이페이지용 게이지.
 *
 * 여기가 "내 계정 상태"를 보는 자리다. 남은 양과 리셋 시각, 그리고 더 필요할 때
 * 무엇을 하면 되는지까지 한 덩어리로 보여준다.
 */
export const UsageGauge: React.FC = () => {
  const usage = useUsage();
  /**
   * 한도 추가 요청 상태.
   *  null   = 아직 확인 안 함
   *  false  = 요청 가능
   *  true   = 이미 접수됨 (같은 사람이 여러 번 남기지 않도록 서버도 막는다)
   */
  const [pending, setPending] = React.useState<boolean | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [result, setResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    void refreshUsage();
  }, []);

  React.useEffect(() => {
    if (usage && !usage.is_guest) void hasPendingRequest().then(setPending);
  }, [usage?.is_guest]);

  const submit = async () => {
    const res = await requestMoreUsage(reason.trim());
    setResult(res.text);
    if (res.ok) {
      setPending(true);
      setAsking(false);
      setReason('');
    }
  };

  if (!usage) return null;

  const ratio = remainingRatio(usage);
  // 잔액에는 "최대치" 가 없다(충전하면 늘어난다). 막대는 가입 지급분을 100 으로
  // 놓고 **남은 양**을 보여 준다 — 채워질수록 좋은 방향이라 직관과 맞다.
  const base = Math.max(1, usage.is_guest ? (usage.guest_trial || 5) : (usage.signup_credits || 30));
  const pct = Math.min(100, (usage.balance / base) * 100);
  const tone = toneOf(ratio);

  return (
    <div
      style={{
        border: '1px solid var(--line-200)',
        borderRadius: 14,
        padding: '16px 18px',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E' }}>AI 크레딧</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
          <>남은 <b style={{ color: '#1A1A1E', fontWeight: 700, fontSize: 15 }}>{usage.balance}</b></>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="남은 크레딧"
        aria-valuenow={usage.balance}
        aria-valuemin={0}
        aria-valuemax={base}
        style={{ height: 8, borderRadius: 9999, background: 'var(--line-200)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: '100%',
            background: tone,
            borderRadius: 9999,
            transition: 'width .3s ease',
          }}
        />
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.7 }}>
        사진으로 재료 담기(2)와 요리 챗봇(1)이 함께 쓰는 크레딧이에요.
        <br />
        {usage.is_guest ? (
          <>체험분 <b>{usage.guest_trial}개</b>를 드렸어요. 가입하면
          <b> {usage.signup_credits}개</b>를 바로 드립니다.</>
        ) : (
          <>
            매주 월요일에 <b>{usage.weekly_credits}</b>개씩 채워져요
            ({resetLabel(usage)}).
            {usage.daily_remaining < usage.balance &&
              ` 오늘은 ${usage.daily_remaining}번 더 쓸 수 있어요.`}
          </>
        )}
      </div>

      {usage.is_guest ? (
        <div style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 600 }}>
          {usage.balance > 0
            ? `체험으로 ${usage.balance}개 더 쓸 수 있어요.`
            : `가입하면 ${usage.signup_credits}개를 바로 드려요.`}
        </div>
      ) : pending ? (
        /* 이미 요청이 접수된 상태. 버튼을 계속 보여주면 또 누르게 되고,
           관리자 목록만 지저분해진다 (서버도 중복을 막는다). */
        <div style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 600 }}>
          요청이 접수됐어요. 확인하고 늘려 드릴게요.
        </div>
      ) : asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="어떤 용도로 더 필요하신가요? (선택)"
            style={{
              height: 36, borderRadius: 8, border: '1px solid var(--line-200)',
              padding: '0 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={submit} style={{
              height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
              background: '#FFD600', color: '#1A1A1E', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              요청 보내기
            </button>
            <button type="button" onClick={() => { setAsking(false); setResult(null); }} style={{
              height: 34, padding: '0 12px', borderRadius: 8,
              border: '1px solid var(--line-200)', background: '#FFFFFF',
              fontSize: 13, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer',
            }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          style={{
            alignSelf: 'flex-start',
            height: 34,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid var(--line-200)',
            background: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ink-700)',
            cursor: 'pointer',
          }}
        >
          더 필요해요
        </button>
      )}

      {result && <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{result}</div>}
    </div>
  );
};

export default UsageGauge;
