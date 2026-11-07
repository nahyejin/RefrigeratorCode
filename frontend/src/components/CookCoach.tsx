import { takePendingCoachQuestion } from '../utils/substituteStore';
import ChatText from './ui/ChatText';
import React from 'react';
import Portal from './Portal';
import VoiceInputButton from './ui/VoiceInputButton';
import { ChefHatIcon } from './ui/Icons';
import { UsageLine, useUsage } from './UsageMeter';
import { applyUsage, refreshUsage, spendOptimistically, usageHeaders } from '../utils/usage';
import { openLoginGate } from '../utils/loginGate';
import { track } from '../utils/track';
import { useCloseOnBack } from '../utils/closeOnBack';
import { getFridgeIngredientNames } from './RecipeChatWidget';

/**
 * 쿡 코치 — 요리 레시피 창 안의 **요리 한 건 전용** 도우미(2026-11-06).
 *
 * 「재료가 이게 없는데 이거 써도 돼?」 「레시피 5배로 만들 건데 계량은?」 처럼 지금 열어 둔 요리에 대한 유동적인 질문에 답한다.
 * 서버(`POST /api/recipes/<id>/ask`)가 그 요리의 재료·조리 순서를 읽고 답하고, 다른 주제는 돌려보낸다.
 *
 * 구성: **우하단에 떠 있는 버튼 → 누르면 대화 카드.** 밖의 추천 챗봇(쿡 픽)과 같은 방식·같은 자리다.
 *  - 시행착오(2026-11-06): 아래에서 올라오는 시트(창이 이중으로 쌓임) → 어중간한 높이의 카드 → 누런 바탕에 삼각 꼬리를 단 카드
 *    (「촌스럽다」). 지금은 **어두운 카드**(검정 바탕·노랑 포인트, 시안 B)다. 레시피 창(흰색)과 한눈에 다른 영역으로 보이도록
 *    ① 카드 윗변을 레시피 창 **제목줄 바로 아래**에 맞춰 본문을 덮고(제목과 ×는 보인다), ② 카드 뒤 레시피 본문을 **어둡게 눌러** 카드가
 *    그 위에 떠 있게 한다. 말풍선 꼬리는 없다 — 아래 버튼 바로 위에 놓이는 것만으로 버튼에서 열린 걸 알 수 있다.
 *  - **대화는 레시피 창을 닫기 전까지 이어진다.** 카드를 접어도 상태는 이 컴포넌트에 남고, 버튼에 말한 횟수가 붙는다.
 *    레시피 창을 닫으면 이 컴포넌트가 사라져 대화도 지워진다.
 *  - **질문 횟수 제한은 없다.** 한도는 크레딧과 하루 한도뿐(서버가 센다).
 */
const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

interface Msg { role: 'user' | 'assistant'; content: string }

/** 추천 질문 하나 — `label` 은 칩에 보이는 글자, `ask` 는 실제로 보내는 질문(보통 같다). */
interface Suggestion { label: string; ask: string }

const BASE_SUGGESTIONS: Suggestion[] = [
  '재료가 없는데 다른 걸로 대체해도 돼요?',
  '5배로 만들면 계량은 어떻게 해요?',
  '덜 맵게 하려면 어떻게 해요?',
  '아이가 먹어도 괜찮을까요?',
].map(t => ({ label: t, ask: t }));

/**
 * 요리 중 가장 자주 묻는 「재료 준비 끝났는데 그다음은?」. 처음엔 질문에 이 레시피의 **첫 단계를 실었는데**(2026-11-07), 사용자가 첫 단계를 이미
 * 했는지는 알 수 없으니 「첫 단계인 …부터 시작할게요」가 앞서가는 말이 된다 → **재료 준비만 끝났다고 말하고 순서대로 알려 달라**고만 보낸다.
 * 조리 순서가 없는 레시피(알려 줄 순서가 없다)엔 만들지 않는다.
 */
function nextStepSuggestion(firstStep?: string): Suggestion | null {
  if (!(firstStep || '').trim()) return null;
  return {
    label: '재료 준비 끝났어요, 그다음은?',
    ask: '재료 준비는 끝났어요. 순서대로 알려주세요.',
  };
}

/** 레시피 창(`Sheet`)의 가로 최대폭 460 에 맞춰, 넓은 화면에서도 버튼이 창 안쪽 오른쪽 아래에 오게 한다. */
const FAB_RIGHT = 'max(16px, calc((100vw - 460px) / 2 + 16px))';
/** 레시피 창(z-modal)과 같은 층. 나중에 열리는 확인창이 이 버튼 위로 올라오도록 **더 높이지 않는다**.
 *  같은 층끼리는 나중에 그려진 것이 위라서, 아래 JSX 에서 **어둡게 누르는 판 → 카드 → 버튼** 순서로 둔다. */
const LAYER = 'var(--z-modal)' as unknown as number;
/** `Sheet` 위쪽의 손잡이(26) + 제목줄(52). 카드 윗변을 이 아래에 맞춘다. */
/** 어두운 카드의 색 */
const INK = '#1A1A1E';
const SURFACE2 = '#2B2B31';
const LINE = 'rgba(255,255,255,0.10)';
const MUTED = 'rgba(255,255,255,0.62)';

const HatCircle: React.FC<{ size: number }> = ({ size }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%', background: '#FFFFFF', flex: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <ChefHatIcon size={Math.round(size * 0.62)} strokeWidth={2.1} style={{ color: INK }} />
  </span>
);

const CookCoach: React.FC<{
  recipeId: number;
  /** 레시피 창(`Sheet`)의 바깥 틀. 카드 윗변을 그 제목줄 아래에 맞추는 데 쓴다. */
  anchor?: React.RefObject<HTMLElement | null>;
  /** 이 레시피의 첫 조리 단계 — 「재료 준비 끝났어요, 그다음은?」 칩이 이것을 말에 싣는다. 없으면 그 칩은 없다. */
  firstStep?: string;
}> = ({ recipeId, anchor, firstStep }) => {
  const usage = useUsage();
  const cost = (usage?.credits as any)?.coach ?? 1;
  const guestOut = !!usage && usage.is_guest && !usage.can_use_ai;

  const [open, setOpen] = React.useState(false);
  // 안드로이드 폰 「뒤로」는 카드부터 접는다.
  useCloseOnBack(open, () => setOpen(false));
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);

  // 모바일 키보드가 뜨면 보이는 화면이 줄어든다 — 카드가 키보드 뒤로 잘리지 않게 실제 보이는 높이를 따라간다(쿡 픽과 같은 방식).
  const [vv, setVv] = React.useState<{ keyboard: number; height: number } | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setVv({ keyboard: Math.max(0, window.innerHeight - v.height - v.offsetTop), height: v.height });
    update();
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => { v.removeEventListener('resize', update); v.removeEventListener('scroll', update); };
  }, [open]);
  const keyboardOpen = !!vv && vv.keyboard > 60;
  // 카드가 화면 아래(하단 메뉴 자리)까지 내려온다 — 세로로 더 길게(2026-11-06 「GNB 영역을 살짝 가릴 정도로」). 열려 있는 동안은 아래 알약을 숨긴다.
  const cardBottom = keyboardOpen ? vv!.keyboard + 8 : 12;
  // 높이를 **보이는 화면 높이**로 직접 계산한다(쿡 픽과 같은 방식, 2026-11-06 「키보드가 뜨면 쿡 픽처럼 세로 높이가 줄어야」).
  // 윗변을 화면 위에 고정하고 아래만 키보드 위로 올렸더니, 키보드가 뜰 때 폰이 화면을 위로 밀어 올리면서 카드 윗부분이 화면 밖으로 잘렸다.
  const cardHeight = vv
    ? Math.min(Math.max(320, vv.height - cardBottom - 24), 760)
    : 'min(calc(100dvh - 36px), 760px)';

  // 레시피 창 위쪽의 「쿡 코치」 입구가 같은 카드를 연다(CookModeSheet 가 이벤트를 쏜다).
  React.useEffect(() => {
    const openFromSheet = () => setOpen(true);
    // 재료 칩(「쪽파 → 대파 ›」)을 누르면 카드를 열고 질문만 채운다 — 보내기는 사용자가 누른다(크레딧이 나가므로).
    const askFromChip = (e: Event) => {
      const q = String((e as CustomEvent).detail?.question || '').trim();
      setOpen(true);
      if (q) setInput(q.slice(0, 300));
    };
    window.addEventListener('cookmatch:open-coach', openFromSheet);
    window.addEventListener('cookmatch:ask-coach', askFromChip);
    return () => {
      window.removeEventListener('cookmatch:open-coach', openFromSheet);
      window.removeEventListener('cookmatch:ask-coach', askFromChip);
    };
  }, []);

  // 다른 요리로 바뀌면 대화를 비운다(요리 한 건 전용이라 이어 갈 맥락이 없다).
  React.useEffect(() => {
    setMessages([]); setInput(''); setError(''); setOpen(false);
  }, [recipeId]);

  // 카드 바깥의 대체 칩을 눌러 들어왔으면 질문이 맡겨져 있다 — 카드를 열고 질문만 채운다(보내기는 사용자가). 위의 비우기 효과 **뒤**에 두어야 이긴다.
  // 가져온 질문은 ref 에 기억해 둔다 — 개발 모드(StrictMode)는 효과를 두 번 돌려서 앞의 「비우기」가 두 번째에 채운 질문을 다시 지운다. 이미 가져간 질문은 두 번째엔 비어 있다.
  const askedRef = React.useRef<{ id: number; q: string } | null>(null);
  React.useEffect(() => {
    const q = takePendingCoachQuestion(recipeId);
    if (q) askedRef.current = { id: recipeId, q };
    const a = askedRef.current;
    if (a && a.id === recipeId) { setOpen(true); setInput(a.q.slice(0, 300)); }
  }, [recipeId]);

  React.useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, loading]);

  const send = async (text: string) => {
    const content = text.trim().slice(0, 300);
    if (!content || loading) return;
    // 체험 크레딧을 다 쓴 비회원은 서버에 보내지 않고 로그인 확인창(다른 AI 화면과 같은 규칙).
    if (guestOut) {
      openLoginGate('ai', { credits: usage?.signup_credits });
      return;
    }
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);
    // 서버는 LLM 을 부르기 전에 이미 깎는다 — 응답 오기 전에도 숫자가 줄어 보이게 한다(챗봇과 같은 방식).
    spendOptimistically(cost);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...usageHeaders() },
        body: JSON.stringify({ messages: next, ingredients: getFridgeIngredientNames() }),
      });
      const data = await res.json().catch(() => ({}));
      applyUsage(data?.usage);
      track('coach_use');
      if (!res.ok) {
        if (data?.usage?.is_guest && data.usage.can_use_ai === false) {
          openLoginGate('ai', { credits: data.usage.signup_credits });
        }
        throw new Error(data?.error || '답을 가져오지 못했어요. 잠시 뒤 다시 물어봐 주세요.');
      }
      setMessages(prev => [...prev, { role: 'assistant', content: String(data.reply || '') }]);
    } catch (e) {
      setError(e instanceof TypeError
        ? '서버에 연결하지 못했어요. 잠시 뒤 다시 물어봐 주세요.'
        : e instanceof Error ? e.message : '답을 가져오지 못했어요. 잠시 뒤 다시 물어봐 주세요.');
    } finally {
      setLoading(false);
      void refreshUsage();
    }
  };

  const turns = messages.filter(m => m.role === 'user').length;
  const asked = new Set(messages.filter(m => m.role === 'user').map(m => m.content));
  // 「그다음은?」 칩을 **맨 앞**에 둔다(요리 중에 가장 쓸모 있는 질문)
  const suggestions: Suggestion[] = React.useMemo(() => {
    const next = nextStepSuggestion(firstStep);
    return next ? [next, ...BASE_SUGGESTIONS] : BASE_SUGGESTIONS;
  }, [firstStep]);
  const remaining = suggestions.filter(s => !asked.has(s.ask));

  return (
    <Portal>
      {/* ── 레시피 본문을 어둡게 누르는 판 ───────────────────
          카드가 그 위에 떠 있게 해서 레시피 창과 다른 영역이라는 걸 보인다. 누르면 카드가 접힌다. */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          style={{
            // 화면 **전체**를 덮는다(레시피 창 제목줄까지) — 카드 윗변부터만 덮었더니 제목줄이 그대로 밝아 딤이 안 느껴졌다.
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: LAYER, animation: 'sheet-fade 0.18s ease-out',
          }}
        />
      )}

      {/* ── 대화 카드 ─────────────────────────────────────── */}
      {open && (
        <section
          aria-label="쿡 코치"
          style={{
            position: 'fixed', left: 12, right: 12, margin: '0 auto', maxWidth: 420, zIndex: LAYER,
            // 거의 전체 높이(2026-11-06 「창이 너무 작다, 핸드폰으로 본다」) — 위·아래 여백만 남겨 뒤 화면이 딤으로 보이게 한다.
            height: cardHeight,
            bottom: keyboardOpen ? cardBottom : `calc(${cardBottom}px + env(safe-area-inset-bottom, 0px))`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: INK, color: '#FFFFFF', borderRadius: 22,
            boxShadow: '0 18px 48px rgba(0,0,0,0.36)', transition: 'bottom 120ms ease-out, height 120ms ease-out',
          }}
        >
          {/* 머리말 한 줄 — 제목은 쿡 픽·다른 제목과 같은 15px/700, 설명은 같은 줄 옆에 */}
          <header style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 0 12px', minHeight: 48,
            flexShrink: 0, borderBottom: `1px solid ${LINE}`,
          }}>
            <HatCircle size={30} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>쿡 코치</span>
              <span className="ai-tag" style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '.04em', padding: '1.5px 6px', borderRadius: 6,
                background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', flexShrink: 0,
              }}>AI</span>
              <span style={{
                fontSize: 11.5, color: MUTED, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>이 요리를 도와드려요</span>
            </span>
            {/* 닫기(×)가 아니라 접기(⌄) — 접어도 대화는 그대로다. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="접기"
              style={{
                width: 36, height: 36, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'rgba(255,255,255,0.85)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          <div className="ai-chat-scroll" style={{
            flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
            scrollbarColor: 'rgba(255,255,255,0.25) transparent',
          }}>
            {messages.length === 0 && (
              <>
                <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                  재료를 바꾸거나, 양을 늘리거나, 간을 맞추는 것까지 이 요리에 대한 건 뭐든 물어보세요.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {suggestions.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      disabled={loading}
                      onClick={() => void send(s.ask)}
                      style={{
                        padding: '8px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                        background: SURFACE2, color: '#F1F1F4', fontSize: 12.5, textAlign: 'left',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%', padding: '9px 13px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  borderRadius: 16,
                  borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                  background: m.role === 'user' ? '#FFFFFF' : SURFACE2,
                  color: m.role === 'user' ? INK : '#F1F1F4',
                }}>
                  {m.role === 'assistant' ? <ChatText text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '9px 13px', fontSize: 13.5, borderRadius: 16, borderBottomLeftRadius: 4,
                  background: SURFACE2, color: MUTED,
                }}>
                  답을 찾는 중이에요…
                </div>
              </div>
            )}
            {error && !loading && (
              <p style={{ margin: 0, fontSize: 12.5, color: '#FF8A80' }}>{error}</p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={e => { e.preventDefault(); void send(input); }}
            style={{
              flexShrink: 0, padding: '8px 12px 12px', borderTop: `1px solid ${LINE}`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            {/* 대화가 시작된 뒤에도 **아직 안 물어본 예시 질문**을 한 줄로 보여 준다 — 요리 중에는 손이 젖어 있어 글자를
                치는 것보다 누르는 게 쉽다. 처음(대화 없음)에는 위쪽에 크게 있으니 중복해서 보이지 않는다. */}
            {messages.length > 0 && !loading && remaining.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -12px', padding: '0 12px', scrollbarWidth: 'none' }}>
                {remaining.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => void send(s.ask)}
                    style={{
                      flex: 'none', padding: '7px 11px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                      background: SURFACE2, color: '#F1F1F4', fontSize: 12.5, whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <UsageLine style={{ justifyContent: 'center' }} cost={cost} onDark />
            {/* 대화는 메모리에만 있다 — 레시피 창을 닫거나 다른 요리로 넘어가면 지워진다(2026-11-06 「닫으면 지워진다는 안내를 넣어야」).
                닫을 때 확인창을 따로 띄우지 않는 이유: 30초 넘게 보다 닫으면 이미 「레시피를 완료하셨나요?」가 뜨는데 팝업이 연달아 둘이 되고,
                요리 한 건 즉석 질문이라 지워져도 손해가 작다. 대신 여기에 한 줄로 미리 알린다. */}
            <div style={{
              textAlign: 'center', fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: -2,
            }}>
              레시피 창을 닫으면 이 대화는 지워져요
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="이 요리에 대해 물어보세요"
                disabled={loading}
                className="ai-chat-input ai-chat-input-dark flex-1 min-w-0 text-[15px]"
              />
              <VoiceInputButton value={input} onText={setInput} onError={setError} disabled={loading} dark />
              <button
                type="submit"
                aria-label="보내기"
                className="ai-action flex-shrink-0"
                disabled={loading || !input.trim()}
                style={{
                  width: 40, height: 40, borderRadius: 20, padding: 0, fontSize: 17, fontWeight: 800,
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                }}
              >
                <span>↑</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── 우하단 떠 있는 버튼 ───────────────────────────────
          버튼이 `overflow: hidden`(스쳐 가는 빛줄기를 가두려고)이라 AI 배지·횟수 표시는 **버튼 밖** 형제로 둔다. */}
      {!open && (
        <div style={{
          position: 'fixed', right: FAB_RIGHT, bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          zIndex: LAYER,
        }}>
          {/* 검정 알약(2026-11-06 「쿡 코치 A」): 선 요리사 모자 + 이름. 말한 횟수는 알약 안 오른쪽 작은 흰 동그라미. */}
          <button
            type="button"
            className="ai-fab-pill k"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? '쿡 코치 접기' : '쿡 코치 열기'}
            aria-expanded={open}
          >
            <ChefHatIcon size={20} />
            <span>쿡 코치</span>
            {turns > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#FFFFFF', color: INK,
                fontSize: 11, fontWeight: 800, lineHeight: '18px', textAlign: 'center', boxSizing: 'border-box',
              }}>{turns}</span>
            )}
          </button>
          <span className="ai-fab-badge">AI</span>
        </div>
      )}
    </Portal>
  );
};

export default CookCoach;
