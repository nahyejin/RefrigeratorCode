import React from 'react';
import Sheet from './ui/Sheet';
import PlanThisDay from './PlanThisDay';

/**
 * 요리 모드 — 원문으로 나가지 않고 앱 안에서 조리 순서를 본다.
 *
 * 왜 필요한가:
 *   요리하는 중에 블로그 원문을 여는 건 사실상 못 할 짓이다. 손에 물이 묻어
 *   있고, 위아래로 한참 스크롤해야 하고, 중간에 광고와 잡담이 섞여 있다.
 *   **필요한 건 재료와 순서 두 가지뿐이다.**
 *
 * 왜 소리로 읽어 주나:
 *   같은 이유다. 손이 젖어 있으면 화면을 못 만진다. 한 번 눌러 두면 멈출 때까지
 *   단계를 이어서 읽는다. 브라우저 내장 음성(`speechSynthesis`)을 쓰므로
 *   API 비용이 없고 앱에서도 그대로 된다.
 *
 * 원문은 버리지 않는다:
 *   요약은 요약이다. 사진이 필요하거나 더 자세히 보고 싶으면 원문으로 갈 수
 *   있어야 한다. 그래서 링크 버튼을 항상 크게 둔다.
 */

export interface CookData {
  id: number;
  title: string;
  link: string;
  platform?: string;
  author?: string;
  ingredients: string[];
  ingredients_detail: string[];
  steps: string[];
}

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

/** 브라우저가 소리 내어 읽어 줄 수 있는가. */
const canSpeak = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * **읽는 속도의 기준값.**
 *
 * 조금 느리다. 따라 하면서 듣는 속도라서 그렇다 — 손은 도마에 있고 귀로만
 * 좇는다. 아래 배속 버튼은 이 값의 **배수**다. 그래서 `1×` 는 예전과 정확히
 * 같은 속도이고, 배속을 만지지 않은 사람에게는 달라지는 것이 없다.
 */
const BASE_RATE = 0.95;

/** 배속 퀵버튼. 팟캐스트·영상 앱에서 쓰는 눈금과 같게 둔다. */
const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

const SPEED_KEY = 'cookmode_speech_rate';

/** 고른 배속은 기억한다 — 빠르게 듣는 사람은 매번 빠르게 듣는다. */
function loadSpeed(): number {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    if (SPEEDS.includes(v as (typeof SPEEDS)[number])) return v;
  } catch { /* 사생활 보호 모드 등 — 기본값으로 간다 */ }
  return 1;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  recipeId: number | null;
  /** 목록에서 이미 아는 값 — 불러오기 전에도 제목이 보이도록 */
  fallbackTitle?: string;
  fallbackLink?: string;
  /** 내 냉장고에 있는 재료(대표어). 있는 것/없는 것을 나눠 보여 준다. */
  myIngredients?: string[];
}

const CookModeSheet: React.FC<Props> = ({
  isOpen, onClose, recipeId, fallbackTitle, fallbackLink, myIngredients = [],
}) => {
  const [data, setData] = React.useState<CookData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [speaking, setSpeaking] = React.useState(false);
  const [at, setAt] = React.useState<number>(-1);
  const [speed, setSpeed] = React.useState<number>(loadSpeed);
  const [speedOpen, setSpeedOpen] = React.useState(false);

  /**
   * 읽는 중에 배속을 바꾸면 **그 자리에서 다시 읽어야 한다.**
   *
   * `SpeechSynthesisUtterance` 의 `rate` 는 말하기 시작한 뒤에는 못 바꾼다.
   * 다음 단계부터 적용하면 "눌렀는데 아무 일도 안 난다" 로 읽히므로, 지금 읽던
   * 단계를 새 속도로 다시 시작한다. `speakFrom` 이 아래에 정의돼 있어 ref 로
   * 붙잡아 둔다.
   */
  const speakFromRef = React.useRef<(start: number) => void>(() => {});

  /**
   * **몇 번째 읽기인가.**
   *
   * `speechSynthesis.cancel()` 이 보내는 `onend`/`onerror` 는 **한 박자 늦게**
   * 온다. 그 사이에 새 읽기가 시작하면, 죽은 발화의 뒷정리가 살아 있는 읽기의
   * 상태를 덮어써서 **읽고 있는데 버튼은 「읽어 주기」로 돌아간다.**
   * (실측: 배속을 바꾸면 소리는 새 속도로 나오는데 버튼만 원래대로 돌아갔다)
   *
   * 그래서 발화마다 번호를 달고, 자기 번호가 최신일 때만 상태를 만진다.
   */
  const runIdRef = React.useRef(0);

  // 읽기를 멈추는 일은 여러 곳에서 일어난다(닫기, 화면 이탈, 다시 누르기).
  // 한 곳에 모아 두지 않으면 시트를 닫아도 계속 떠드는 상태가 된다.
  const stopSpeaking = React.useCallback(() => {
    runIdRef.current += 1;
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeaking(false);
    setAt(-1);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !recipeId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`${API_BASE_URL}/api/recipes/${recipeId}/cook`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('불러오지 못했어요'))))
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setError('레시피를 불러오지 못했어요. 원문에서 확인해 주세요.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isOpen, recipeId]);

  // 시트가 닫히거나 컴포넌트가 사라지면 반드시 멈춘다.
  React.useEffect(() => {
    if (!isOpen) stopSpeaking();
    return stopSpeaking;
  }, [isOpen, stopSpeaking]);

  const steps = data?.steps || [];

  /**
   * 한 단계씩 이어서 읽는다.
   *
   * 단계마다 따로 발화를 만들고 `onend` 로 다음을 잇는다. 전체를 한 덩어리로
   * 넘기면 **지금 어느 단계인지 알 수 없어** 화면에서 짚어 줄 수가 없다.
   */
  const speakFrom = React.useCallback((start: number) => {
    if (!canSpeak() || steps.length === 0) return;
    const myRun = ++runIdRef.current;   // 이번 읽기의 번호
    window.speechSynthesis.cancel();
    setSpeaking(true);

    const run = (i: number) => {
      // 그 사이에 다른 읽기가 시작됐으면 이 갈래는 조용히 물러난다.
      if (myRun !== runIdRef.current) return;
      if (i >= steps.length) {
        setSpeaking(false);
        setAt(-1);
        return;
      }
      setAt(i);
      const u = new SpeechSynthesisUtterance(`${i + 1}번. ${steps[i]}`);
      u.lang = 'ko-KR';
      // 기준 속도(`BASE_RATE`)에 고른 배속을 곱한다. 브라우저가 받는 상한은
      // 10 이라 2× 까지는 넉넉하다.
      u.rate = BASE_RATE * speed;
      u.onend = () => run(i + 1);
      u.onerror = () => {
        if (myRun !== runIdRef.current) return;
        setSpeaking(false);
        setAt(-1);
      };
      window.speechSynthesis.speak(u);
    };
    run(start);
  }, [steps, speed]);

  React.useEffect(() => { speakFromRef.current = speakFrom; }, [speakFrom]);

  /** 배속을 고른다. 읽던 중이었다면 그 단계를 새 속도로 다시 읽는다. */
  const pickSpeed = (v: number) => {
    setSpeed(v);
    try { localStorage.setItem(SPEED_KEY, String(v)); } catch { /* 무시 */ }
    setSpeedOpen(false);
    if (speaking) {
      const from = at < 0 ? 0 : at;
      // `speed` 가 반영된 `speakFrom` 은 다음 렌더에 만들어진다. 그 뒤에 부른다.
      // (`cancel()` 은 새 `speakFrom` 이 자기 번호를 달고 부른다 — 여기서 미리
      //  부르면 죽은 발화의 뒷정리가 새 읽기를 끊는다)
      setTimeout(() => speakFromRef.current(from), 0);
    }
  };

  const have = new Set(myIngredients.map(x => x.trim()));
  const detail = data?.ingredients_detail || [];
  const names = data?.ingredients || [];

  return (
    <Sheet open={isOpen} onClose={() => { stopSpeaking(); onClose(); }}
           title={data?.title || fallbackTitle || '레시피'} maxHeight="88dvh" hideFooter>
      {loading && (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 14 }}>
          불러오는 중이에요...
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '20px 0', fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.7 }}>
          {error}
        </div>
      )}

      {!loading && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* ── 재료 ─────────────────────────────────────────── */}
          {(detail.length > 0 || names.length > 0) && (
            <section>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', margin: '0 0 8px' }}>
                재료
              </h3>
              {detail.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none',
                             display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {detail.map((line, i) => (
                    <li key={i} style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.5 }}>
                      · {line}
                    </li>
                  ))}
                </ul>
              ) : (
                /* 분량이 없는 옛 데이터. 이름만이라도 보여 준다. */
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {names.map(n => (
                    <span key={n} style={{
                      fontSize: 12, padding: '4px 9px', borderRadius: 9999,
                      background: have.has(n) ? '#FFF3B0' : 'var(--surface-sub)',
                      color: 'var(--ink-700)',
                    }}>{n}</span>
                  ))}
                </div>
              )}
              {detail.length > 0 && names.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {names.map(n => (
                    <span key={n} style={{
                      fontSize: 11.5, padding: '3px 8px', borderRadius: 9999,
                      background: have.has(n) ? '#FFF3B0' : 'var(--surface-sub)',
                      color: have.has(n) ? '#7A5C00' : 'var(--ink-500)',
                      fontWeight: have.has(n) ? 700 : 400,
                    }}>
                      {have.has(n) ? '✓ ' : ''}{n}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── 조리 순서 ────────────────────────────────────── */}
          {steps.length > 0 ? (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', margin: 0 }}>
                  조리 순서
                </h3>
                {canSpeak() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* 배속. 눌러야 눈금이 펼쳐진다 — 다섯 개를 늘 펴 두면
                        「읽어 주기」보다 배속이 더 넓은 자리를 차지한다. */}
                    <button
                      type="button"
                      onClick={() => setSpeedOpen(v => !v)}
                      aria-expanded={speedOpen}
                      aria-label={`읽는 속도 ${speed}배. 눌러서 바꾸기`}
                      style={{
                        height: 34, padding: '0 11px', borderRadius: 9999,
                        border: `1px solid ${speedOpen ? '#1A1A1E' : 'var(--line-300)'}`,
                        background: 'var(--surface)', color: 'var(--ink-900)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {speed}×
                    </button>
                    <button
                      type="button"
                      onClick={() => (speaking ? stopSpeaking() : speakFrom(0))}
                      style={{
                        height: 34, padding: '0 14px', borderRadius: 9999, border: 'none',
                        background: speaking ? '#1A1A1E' : '#FFD600',
                        color: speaking ? '#FFFFFF' : '#1A1A1E',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {speaking ? '■ 멈추기' : '▶ 읽어 주기'}
                    </button>
                  </div>
                )}
              </div>

              {canSpeak() && speedOpen && (
                <div
                  role="group"
                  aria-label="읽는 속도"
                  style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'flex-end',
                           flexWrap: 'wrap' }}
                >
                  {SPEEDS.map(v => {
                    const on = v === speed;
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => pickSpeed(v)}
                        style={{
                          height: 32, minWidth: 52, padding: '0 10px', borderRadius: 9999,
                          border: `1px solid ${on ? '#1A1A1E' : 'var(--line-300)'}`,
                          background: on ? '#1A1A1E' : 'var(--surface)',
                          color: on ? '#FFFFFF' : 'var(--ink-700)',
                          fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {v}×
                      </button>
                    );
                  })}
                </div>
              )}

              <ol style={{ margin: 0, padding: 0, listStyle: 'none',
                           display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((step, i) => (
                  <li
                    key={i}
                    onClick={() => speakFrom(i)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 12px', borderRadius: 12,
                      // 읽고 있는 단계를 짚어 준다. 소리만 나오면 어디까지 왔는지
                      // 모르고, 한눈 팔면 처음부터 다시 들어야 한다.
                      background: at === i ? '#FFF8CC' : 'var(--surface-sub)',
                      cursor: canSpeak() ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 9999,
                      background: at === i ? '#FFD600' : 'var(--surface)',
                      color: '#1A1A1E', fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-900)' }}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              {canSpeak() && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 8, lineHeight: 1.6 }}>
                  단계를 누르면 거기서부터 읽어 줘요. 멈출 때까지 이어서 읽습니다.
                </div>
              )}
            </section>
          ) : (
            /* 본문에 만드는 과정이 없는 글(영상으로만 설명한 유튜브 등).
               없는 걸 지어내지 않고 원문으로 보낸다. */
            <section style={{
              background: 'var(--surface-sub)', borderRadius: 12, padding: '16px 14px',
              fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.7,
            }}>
              이 레시피는 <b>본문에 만드는 과정이 안 적혀 있어요.</b>
              <br />
              {data.platform && data.platform.includes('youtube')
                ? '영상에서 설명해요. 아래 버튼으로 보세요.'
                : '아래 버튼으로 원문에서 보세요.'}
            </section>
          )}

          {/* ── 언제 해먹을까 ────────────────────────────────── */}
          {/* 요리를 정하는 순간은 식단 화면이 아니라 **레시피를 보고 있을 때**다.
              여기 없으면 "이건 금요일에" 라는 생각이 그냥 사라진다. */}
          {!!recipeId && (
            <PlanThisDay
              recipeId={recipeId}
              title={data.title || fallbackTitle || '레시피'}
              link={data.link || fallbackLink}
              thumbnail={(data as any).thumbnail}
            />
          )}

          {/* ── 원문 ─────────────────────────────────────────── */}
          {(data.link || fallbackLink) && (
            <a
              href={data.link || fallbackLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopSpeaking}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 46, borderRadius: 12, border: '1px solid var(--line-200)',
                background: 'var(--surface)', color: 'var(--ink-900)',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}
            >
              원문에서 자세히 보기 ↗
            </a>
          )}

          <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.6, textAlign: 'center' }}>
            원문을 요약한 거예요. 사진과 자세한 설명은 원문에.
            {data.author && <><br />출처 · {data.author}</>}
          </div>
        </div>
      )}
    </Sheet>
  );
};

export default CookModeSheet;
