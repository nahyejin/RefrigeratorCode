import React from 'react';
import Sheet from './ui/Sheet';
import VoiceInputButton from './ui/VoiceInputButton';
import { HatMark } from './ui/AiMarks';
import { UsageLine, useUsage } from './UsageMeter';
import { applyUsage, refreshUsage, spendOptimistically, usageHeaders } from '../utils/usage';
import { openLoginGate } from '../utils/loginGate';
import { track } from '../utils/track';
import { getFridgeIngredientNames } from './RecipeChatWidget';

/**
 * 쿡 코치 — 요리 드로어 안의 **요리 한 건 전용** 도우미(2026-11-06).
 *
 * 「재료가 이게 없는데 이거 써도 돼?」 「레시피 5배로 만들 건데 계량은?」 처럼 지금 열어 둔 요리에 대한 유동적인 질문에 답한다.
 * 서버(`POST /api/recipes/<id>/ask`)가 그 요리의 재료·조리 순서를 읽고 답하고, 다른 주제는 돌려보낸다.
 *
 * 구성: 드로어 맨 아래 한 줄(이 컴포넌트가 `Sheet` 의 `footer` 로 들어간다) → 누르면 위로 올라오는 대화 시트.
 *  - **대화는 드로어를 닫기 전까지 이어진다.** 시트를 내려도 상태는 이 컴포넌트에 남아 있고, 아래 줄에 「대화 N개」와
 *    마지막 답 한 줄이 보인다. 드로어를 닫으면 푸터째 사라져 대화도 지워진다.
 *  - 시트 머리말의 버튼은 닫기(×)가 아니라 **내리기(⌄)** — 닫는 것처럼 보이면 대화가 사라질 것 같아서.
 *  - **질문 횟수 제한은 없다.** 한도는 크레딧과 하루 한도뿐(서버가 센다).
 */
const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  '재료가 없는데 다른 걸로 대체해도 돼요?',
  '5배로 만들면 계량은 어떻게 해요?',
  '덜 맵게 하려면 어떻게 해요?',
  '아이가 먹어도 괜찮을까요?',
];

const MicIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
       stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
);

const HatCircle: React.FC<{ size: number }> = ({ size }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%', background: '#1A1A1E', flex: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <HatMark size={Math.round(size * 0.68)} />
  </span>
);

const CookCoach: React.FC<{ recipeId: number }> = ({ recipeId }) => {
  const usage = useUsage();
  const cost = (usage?.credits as any)?.coach ?? 1;
  const guestOut = !!usage && usage.is_guest && !usage.can_use_ai;

  const [open, setOpen] = React.useState(false);
  /** 아래 줄의 마이크를 눌러 열렸으면 시트가 열리자마자 듣기 시작한다. */
  const [autoVoice, setAutoVoice] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);

  // 다른 요리로 바뀌면 대화를 비운다(요리 한 건 전용이라 이어 갈 맥락이 없다).
  React.useEffect(() => {
    setMessages([]); setInput(''); setError(''); setOpen(false);
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
      setError(e instanceof Error ? e.message : '답을 가져오지 못했어요. 잠시 뒤 다시 물어봐 주세요.');
    } finally {
      setLoading(false);
      void refreshUsage();
    }
  };

  const openSheet = (voice: boolean) => {
    setAutoVoice(voice);
    setOpen(true);
  };

  const turns = messages.filter(m => m.role === 'user').length;
  const asked = new Set(messages.filter(m => m.role === 'user').map(m => m.content));
  const remaining = SUGGESTIONS.filter(s => !asked.has(s));
  const lastAnswer = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? '';

  return (
    <>
      {/* ── 드로어 맨 아래 한 줄 ─────────────────────────────── */}
      {turns === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HatCircle size={34} />
          <button
            type="button"
            onClick={() => openSheet(false)}
            style={{
              flex: 1, minWidth: 0, minHeight: 40, padding: '0 14px', borderRadius: 20, border: 'none',
              background: 'var(--surface-sub)', color: 'var(--ink-500)', fontSize: 13.5, textAlign: 'left',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
            }}
          >
            쿡 코치에게 이 요리를 물어보세요
          </button>
          <button
            type="button"
            onClick={() => openSheet(true)}
            aria-label="말로 물어보기"
            style={{
              flex: 'none', width: 40, height: 40, borderRadius: 20, padding: 0,
              border: '1px solid var(--line-200)', background: 'var(--surface)', color: 'var(--ink-700)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <MicIcon size={20} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openSheet(false)}
          aria-label={`쿡 코치 대화 ${turns}개 열기`}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 0,
            border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <HatCircle size={34} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b style={{ fontSize: 13.5, color: 'var(--ink-900)' }}>쿡 코치</b>
              <span style={{
                background: '#FFF3B0', color: '#7A5C00', borderRadius: 9999,
                padding: '1px 8px', fontSize: 11, fontWeight: 700,
              }}>대화 {turns}개</span>
            </span>
            <span style={{
              display: 'block', fontSize: 12, color: 'var(--ink-500)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {loading ? '답을 찾는 중이에요…' : (lastAnswer || '이어서 물어보세요')}
            </span>
          </span>
          <span aria-hidden style={{ flex: 'none', fontSize: 12, color: 'var(--ink-500)' }}>열기 ⌃</span>
        </button>
      )}

      {/* ── 대화 시트 ─────────────────────────────────────── */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeKind="down"
        maxHeight="82dvh"
        title={
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.3 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <HatCircle size={24} />
              쿡 코치
            </span>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-500)' }}>이 요리를 도와드려요</span>
          </span>
        }
        footer={
          <form
            onSubmit={e => { e.preventDefault(); void send(input); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {/* 대화가 시작된 뒤에도 **아직 안 물어본 예시 질문**을 한 줄로 보여 준다 — 요리 중에는 손이 젖어 있어 글자를
                치는 것보다 누르는 게 쉽다. 처음(대화 없음)에는 본문에 크게 있으니 중복해서 보이지 않는다. */}
            {messages.length > 0 && !loading && remaining.length > 0 && (
              <div style={{
                display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px',
                scrollbarWidth: 'none',
              }}>
                {remaining.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    style={{
                      flex: 'none', padding: '7px 11px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                      background: 'var(--surface-sub)', color: 'var(--ink-700)', fontSize: 12.5, whiteSpace: 'nowrap',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <UsageLine style={{ justifyContent: 'center' }} cost={cost} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="이 요리에 대해 물어보세요"
                disabled={loading}
                // 마이크로 열렸으면 키보드를 띄우지 않는다.
                autoFocus={!autoVoice}
                className="ai-chat-input flex-1 min-w-0 text-[15px]"
              />
              <VoiceInputButton
                value={input}
                onText={setInput}
                onError={setError}
                disabled={loading}
                autoStart={autoVoice}
              />
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
        }
      >
        {/* 본문 높이를 고정해 두어 첫 질문 전후로 시트가 들썩이지 않게 한다. */}
        <div style={{ minHeight: '34dvh', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>
                재료를 바꾸거나, 양을 늘리거나, 간을 맞추는 것까지 이 요리에 대한 건 뭐든 물어보세요.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => void send(s)}
                    style={{
                      padding: '8px 12px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                      background: 'var(--surface-sub)', color: 'var(--ink-700)', fontSize: 12.5,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '86%', padding: '9px 13px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                borderRadius: 16,
                borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                background: m.role === 'user' ? '#1A1A1E' : 'var(--surface-sub)',
                color: m.role === 'user' ? '#FFFFFF' : 'var(--ink-900)',
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '9px 13px', fontSize: 13.5, borderRadius: 16, borderBottomLeftRadius: 4,
                background: 'var(--surface-sub)', color: 'var(--ink-500)',
              }}>
                답을 찾는 중이에요…
              </div>
            </div>
          )}
          {error && !loading && (
            <p style={{ margin: 0, fontSize: 12.5, color: '#D93025' }}>{error}</p>
          )}
          <div ref={endRef} />
        </div>
      </Sheet>
    </>
  );
};

export default CookCoach;
