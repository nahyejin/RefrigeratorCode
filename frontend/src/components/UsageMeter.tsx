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
export const UsageLine: React.FC<{
  style?: React.CSSProperties;
  compact?: boolean;
  /** 이 자리에서 한 번 누르면 몇 크레딧이 나가나. 알면 넣어 준다. */
  cost?: number;
  /**
   * 그 값이 **무엇 단위인지.**
   *
   * 자리마다 세는 단위가 다르다. 챗봇·식단은 물어본 횟수지만, 사진 인식은
   * **올린 횟수**다 — 다섯 장을 한 번에 올려도 호출은 한 번이라 크레딧도
   * 한 번치다. `1회 질문당` 이라고 적어 두면 장당 나가는 줄로 읽힌다.
   */
  costUnit?: 'ask' | 'upload';
}> = ({ style, compact = false, cost, costUnit = 'ask' }) => {
  const usage = useUsage();
  if (!usage) return null;

  /**
   * **두 가지를 다 말한다.**
   *
   * 크레딧은 한 종류가 아니다 — 쌓아 둔 잔액(월요일에 채워짐)과 하루에 쓸 수
   * 있는 양(자정에 돌아옴)이 따로 있고, 둘 중 **하나만 바닥나도** 못 쓴다.
   * 잔액만 보여 주면 "37 남았다는데 왜 안 되지" 가 되고, 반대도 마찬가지다.
   * 그래서 AI 가 붙은 자리마다 둘을 같이 적는다.
   */
  const noBalance = usage.balance <= 0;
  const noToday = usage.daily_remaining <= 0;
  const out = noBalance || noToday;

  let text: React.ReactNode;
  if (usage.is_guest && out) {
    // 다 쓴 뒤에 **얼마를 주는지**로 말한다 — 그때가 가입 의사가 가장 높다.
    text = compact
      ? '가입하면 더'
      : <>체험분을 다 쓰셨어요 · 가입하면 <b>{usage.signup_credits} 크레딧</b></>;
  } else if (noBalance) {
    text = compact ? '크레딧 0' : <>크레딧 소진 · 월요일에 <b>{usage.weekly_credits}</b> 충전돼요</>;
  } else if (noToday) {
    text = compact ? '금일 소진' : '금일 크레딧 소진 · 자정에 초기화돼요';
  } else if (compact) {
    // 챗 패널 헤더는 아바타와 버튼 사이 150px 남짓이다. 두 숫자만 —
    // 이번에 얼마 나가는지는 입력창 바로 위(넓은 자리)에서 말한다.
    text = <>크레딧 <b>{usage.balance}</b> · 오늘 <b>{usage.daily_remaining}</b></>;
  } else {
    /**
     * 세 숫자가 **각각 무엇인지** 말한다.
     *
     * `남은 크레딧 14 · 오늘 1/15 · 이번에 3 써요` 는 셋이 나란히 붙어 있어서
     * 어느 것이 무엇인지 알 수 없다는 말을 들었다. 사실 서로 다른 것을 센다:
     *   전체 남은 것 / 오늘 더 쓸 수 있는 것 / 이번에 나갈 것.
     * 줄을 바꾸고 이름을 붙이면 한 번 읽고 만다.
     */
    // 말로 풀어 쓰면 오히려 안 읽힌다. **이름 + 숫자**로 끊는다.
    text = (
      <span style={{ display: 'grid', gap: 2, width: '100%' }}>
        <span>전체 잔여 크레딧 <b style={{ color: 'var(--ink-900)' }}>{usage.balance}</b></span>
        {usage.daily_cap > 0 && (
          <span>
            금일 잔여 크레딧 <b style={{ color: 'var(--ink-900)' }}>{usage.daily_remaining}</b>
            {' '}· 하루 최대 {usage.daily_cap}
          </span>
        )}
        {typeof cost === 'number' && cost > 0 && (
          costUnit === 'upload'
            ? <span>사진 몇 장이든 1회 <b style={{ color: 'var(--ink-900)' }}>{cost}</b> 크레딧</span>
            : <span>1회 질문당 <b style={{ color: 'var(--ink-900)' }}>{cost}</b> 크레딧</span>
        )}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: compact ? 'nowrap' : 'wrap',
        overflow: compact ? 'hidden' : undefined,
        whiteSpace: compact ? 'nowrap' : undefined,
        textOverflow: compact ? 'ellipsis' : undefined,
        minWidth: 0,
        fontSize: 12,
        color: out ? RED : 'var(--ink-500)',
        fontWeight: out ? 600 : 400,
        ...style,
      }}
    >
      {text}
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
  // 오늘 한도. 잔액과 **다른 것**이라 막대를 따로 그린다.
  const dailyCap = usage.daily_cap || 0;
  const dailyPct = dailyCap > 0
    ? Math.min(100, Math.max(0, (usage.daily_remaining / dailyCap) * 100))
    : 0;

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
      {/* 남은 양이 이 카드의 요점이다. 제목과 같은 크기로 적어 두면
          "AI 크레딧" 이라는 이름만 눈에 들어오고 정작 숫자는 안 읽힌다. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>
          {/* '개' 를 붙이지 않는다. 크레딧이 곧 세는 단위다 —
              "37개" 는 무엇이 37개인지 다시 묻게 만든다. */}
          남은 크레딧{' '}
          <b style={{ color: '#1A1A1E', fontWeight: 800, fontSize: 20 }}>{usage.balance}</b>
        </div>
        {/* 모자란 걸 아는 순간이 바로 이 숫자를 볼 때다. 카드 맨 아래 두면
            그 순간과 버튼 사이에 설명이 세 줄 끼어 있다. */}
        {!usage.is_guest && !pending && !asking && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            style={{
              flexShrink: 0, height: 30, padding: '0 11px', borderRadius: 8,
              border: '1px solid var(--line-200)', background: '#FFFFFF',
              fontSize: 12.5, fontWeight: 700, color: 'var(--ink-700)', cursor: 'pointer',
            }}
          >
            더 필요해요
          </button>
        )}
      </div>

      {/* 막대가 둘이다. **다른 것을 세기 때문**이다 —
          위는 오늘 안에 쓸 수 있는 양(자정에 돌아온다),
          아래는 쌓아 둔 잔액(월요일에 채워진다).
          하나만 두면 "37 남았다는데 왜 안 되지" 가 된다. */}
      {dailyCap > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 11.5, color: 'var(--ink-500)' }}>
            <span>금일 잔여 크레딧</span>
            <span>
              <b style={{ color: usage.daily_remaining === 0 ? RED : '#1A1A1E' }}>
                {usage.daily_remaining}
              </b>
              {' / '}{dailyCap}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="오늘 남은 사용량"
            aria-valuenow={usage.daily_remaining}
            aria-valuemin={0}
            aria-valuemax={dailyCap}
            style={{ height: 8, borderRadius: 9999, background: 'var(--line-200)', overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${dailyPct}%`,
                height: '100%',
                background: usage.daily_remaining === 0 ? RED : '#1A1A1E',
                borderRadius: 9999,
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {dailyCap > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 11.5, color: 'var(--ink-500)' }}>
            <span>전체 잔여 크레딧</span>
            <span><b style={{ color: '#1A1A1E' }}>{usage.balance}</b></span>
          </div>
        )}
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
      </div>

      {/* 어디에 쓰이는지 **세 군데를 다 적는다.** 식단 짜기가 빠져 있어서,
          크레딧이 줄어 있는데 왜 줄었는지 알 수 없는 경우가 생겼다.
          값은 서버가 정하는 것이라 서버가 준 값을 그대로 쓴다. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[
          ['재료 담기', (usage.credits as any)?.vision ?? 2],
          ['요리 챗봇', (usage.credits as any)?.chat ?? 1],
          ['식단 짜기', (usage.credits as any)?.plan ?? 2],
        ].map(([label, cost]) => (
          <span key={label as string} style={{
            fontSize: 11.5, padding: '4px 9px', borderRadius: 9999,
            background: 'var(--surface-sub)', color: 'var(--ink-700)',
          }}>
            {label} <b style={{ color: '#1A1A1E' }}>{cost}</b> 크레딧
          </span>
        ))}
      </div>

      {/* 두 막대가 이미 무엇이 얼마인지 말하고 있다. 여기서는 **언제 채워지는지**
          만 짧게 — 막대가 못 하는 말이 그것뿐이다. */}
      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.7 }}>
        {usage.is_guest ? (
          <>가입 시 <b>{usage.signup_credits} 크레딧</b> 지급.</>
        ) : (
          <>
            {usage.is_paid && (
              <span style={{
                display: 'inline-block', marginRight: 6, padding: '1px 7px',
                borderRadius: 9999, background: '#1A1A1E', color: '#FFD600',
                fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em',
              }}>PLUS</span>
            )}
            매주 월요일 <b>{usage.weekly_credits} 크레딧</b> 충전
            {dailyCap > 0 && ' · 금일 한도는 자정 초기화'}
            {/* 언제까지인지 안 적으면 어느 날 갑자기 줄어든 것처럼 느낀다. */}
            {usage.is_paid && usage.plan_until && (
              <>
                <br />
                <b>{usage.plan_until}</b> 까지 유료예요. 그 뒤에는 무료로 돌아가요.
              </>
            )}
            {/* **왜 이만큼뿐인지**를 말해 준다. 숫자만 적어 두면 "이게 왜 이거지"
                로 끝나고, 더 받는 길이 있다는 것도 안 보인다. */}
            {!usage.is_paid && (
              <>
                <br />
                지금은 시험 기간이라, 위 <b>더 필요해요</b> 로 요청하시면{' '}
                매주 <b>{usage.weekly_plus ?? 60} 크레딧</b>으로 바꿔 드려요.
              </>
            )}
          </>
        )}
      </div>

      {usage.is_guest ? null : pending ? (
        /* 이미 요청이 접수된 상태. 버튼을 계속 보여주면 또 누르게 되고,
           관리자 목록만 지저분해진다 (서버도 중복을 막는다). */
        <div style={{
          fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-700)',
          background: 'var(--surface-sub)', borderRadius: 10, padding: '10px 11px',
        }}>
          <b>요청이 접수됐어요.</b> 확인하고 유료 계정으로 바꿔 드릴게요.
        </div>
      ) : asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* **무슨 일이 벌어지는지 먼저 말한다.**
              빈 칸에 "어떻게 쓰시는지 (선택)" 만 있으면, 이걸 적으면 뭐가 되는
              건지 알 수 없어 대부분 그냥 닫는다. 지금은 시험 기간이라 요청하면
              바로 올려 주는 것이 사실이므로 그대로 적는다. */}
          <div style={{
            fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-700)',
            background: '#FFFDF2', border: '1px solid #E0B400',
            borderRadius: 10, padding: '10px 11px',
          }}>
            지금은 <b>시험 기간</b>이라 요청하시면 <b>유료 계정</b>으로 바꿔 드려요.
            <br />
            매주 <b>{usage.weekly_plus ?? 60} 크레딧</b>이 충전되고, 하루 한도도 함께 올라가요.
          </div>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="어떻게 쓰실지 한 줄만 알려 주세요 (안 적어도 돼요)"
            style={{
              height: 40, borderRadius: 8, border: '1px solid var(--line-200)',
              padding: '0 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={submit} style={{
              flex: 1, height: 42, borderRadius: 10, border: 'none',
              background: '#FFD600', color: '#1A1A1E', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}>
              유료 계정 전환 요청 보내기
            </button>
            <button type="button" onClick={() => { setAsking(false); setResult(null); }} style={{
              flexShrink: 0, height: 42, padding: '0 14px', borderRadius: 10,
              border: '1px solid var(--line-200)', background: '#FFFFFF',
              fontSize: 13, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer',
            }}>
              취소
            </button>
          </div>
        </div>
      ) : null}

      {result && <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{result}</div>}
    </div>
  );
};

export default UsageGauge;
