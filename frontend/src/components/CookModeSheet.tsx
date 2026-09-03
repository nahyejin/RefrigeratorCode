import React from 'react';
import Sheet from './ui/Sheet';

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

  // 읽기를 멈추는 일은 여러 곳에서 일어난다(닫기, 화면 이탈, 다시 누르기).
  // 한 곳에 모아 두지 않으면 시트를 닫아도 계속 떠드는 상태가 된다.
  const stopSpeaking = React.useCallback(() => {
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
  const speakFrom = (start: number) => {
    if (!canSpeak() || steps.length === 0) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);

    const run = (i: number) => {
      if (i >= steps.length) {
        setSpeaking(false);
        setAt(-1);
        return;
      }
      setAt(i);
      const u = new SpeechSynthesisUtterance(`${i + 1}번. ${steps[i]}`);
      u.lang = 'ko-KR';
      u.rate = 0.95;   // 조금 느리게. 따라 하면서 듣는 속도다.
      u.onend = () => run(i + 1);
      u.onerror = () => { setSpeaking(false); setAt(-1); };
      window.speechSynthesis.speak(u);
    };
    run(start);
  };

  const have = new Set(myIngredients.map(x => x.trim()));
  const detail = data?.ingredients_detail || [];
  const names = data?.ingredients || [];

  return (
    <Sheet isOpen={isOpen} onClose={() => { stopSpeaking(); onClose(); }}
           title={data?.title || fallbackTitle || '레시피'}>
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
                )}
              </div>

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
                ? '영상에서 설명하는 경우예요. 아래 버튼으로 영상에서 확인해 주세요.'
                : '아래 버튼으로 원문에서 확인해 주세요.'}
            </section>
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
            조리 순서는 원문을 요약한 것이에요. 사진이나 더 자세한 설명은 원문에 있어요.
            {data.author && <><br />출처 · {data.author}</>}
          </div>
        </div>
      )}
    </Sheet>
  );
};

export default CookModeSheet;
