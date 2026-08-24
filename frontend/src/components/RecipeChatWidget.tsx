import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getProxiedImageUrl } from '../utils/imageUtils';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const STORAGE_FRIDGE = 'myfridge_ingredients';
const STORAGE_THREADS = 'cookmatch_chat_threads';
const HISTORY_RETENTION_DAYS = 30;
const MAX_STORED_THREADS = 100;

const SUGGESTIONS = [
  '오늘 매운 거 먹고 싶어',
  '있는 재료로 뭐 해먹을 수 있어?',
  '재료 상관없이 간단한 거 추천해줘',
];

type ChatRecipe = {
  id: number;
  title: string;
  thumbnail: string;
  platform: string;
  link: string;
  match_rate: number;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  recipes?: ChatRecipe[];
};

type ChatThread = {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

const CookMatchMarkIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
  >
    {/* 쿡매치 메인 아이콘(집 지붕 + 밥그릇) 모티프 */}
    <path
      className="ai-fab-icon-spark"
      d="M5.3 11L12 4.6L18.7 11M7 9.5V13M17 9.5V13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      className="ai-fab-icon-main"
      d="M5.4 13.6h13.2c.4 0 .7.4.6.8-.7 3.3-3.6 5.7-7 5.7h-.4c-3.4 0-6.3-2.4-7-5.7-.1-.4.2-.8.6-.8z"
      fill="currentColor"
    />
  </svg>
);

const HistoryIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
  >
    <path
      d="M12 8v5l3 2M20 12a8 8 0 11-2.34-5.66M20 4v5h-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
  >
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function getFridgeIngredientNames(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_FRIDGE) || 'null');
    if (!data) return [];
    return [...(data.frozen || []), ...(data.fridge || []), ...(data.room || [])]
      .map((item: { name?: string }) => (item?.name || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function createThreadId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_THREADS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return parsed
      .filter((t: ChatThread) => t && typeof t.updatedAt === 'number' && t.updatedAt >= cutoff)
      .sort((a: ChatThread, b: ChatThread) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persistThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(STORAGE_THREADS, JSON.stringify(threads.slice(0, MAX_STORED_THREADS)));
  } catch {
    // localStorage 사용 불가(사생활 보호 모드 등) 시 조용히 무시
  }
}

function formatRelativeDate(ts: number): string {
  const diffDay = Math.floor((Date.now() - ts) / 86400000);
  if (diffDay <= 0) return '오늘';
  if (diffDay === 1) return '어제';
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

function threadTitle(thread: ChatThread): string {
  const firstUser = thread.messages.find((m) => m.role === 'user');
  const text = (firstUser?.content || '새 대화').trim();
  return text.length > 26 ? `${text.slice(0, 26)}…` : text;
}

const RecipeChatWidget: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [threadId, setThreadId] = useState<string>(createThreadId);
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hideOnAuth =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/signup') ||
    location.pathname.startsWith('/find-email') ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname.startsWith('/auth');

  // 현재 대화창(threadId)의 메시지를 히스토리 목록에 계속 반영 (빈 대화는 저장 안 함)
  useEffect(() => {
    if (messages.length === 0) return;
    setThreads((prev) => {
      const now = Date.now();
      const idx = prev.findIndex((t) => t.id === threadId);
      let next: ChatThread[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], messages, updatedAt: now };
      } else {
        next = [{ id: threadId, createdAt: now, updatedAt: now, messages }, ...prev];
      }
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      persistThreads(next);
      return next;
    });
  }, [messages, threadId]);

  useEffect(() => {
    if (open && view === 'chat' && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, view, messages, loading]);

  useEffect(() => {
    if (open && view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, view]);

  if (hideOnAuth) return null;

  const startNewThread = () => {
    setThreadId(createThreadId());
    setMessages([]);
    setError('');
    setView('chat');
  };

  const openWidget = () => {
    // 나갔다 들어오면 항상 새 대화로 시작 (지난 대화는 히스토리에서 이어볼 수 있음)
    startNewThread();
    setOpen(true);
  };

  const openThread = (thread: ChatThread) => {
    setThreadId(thread.id);
    setMessages(thread.messages);
    setError('');
    setView('chat');
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persistThreads(next);
      return next;
    });
    if (id === threadId) {
      startNewThread();
    }
  };

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: threadId,
          messages: nextMessages.map(({ role, content: body }) => ({ role, content: body })),
          ingredients: getFridgeIngredientNames(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '채팅 요청에 실패했습니다.');
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || '레시피를 찾아봤어요.',
          recipes: Array.isArray(data.recipes) ? data.recipes : [],
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '채팅 요청에 실패했습니다.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-[10030]"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <section
          className="fixed left-3 right-3 z-[10040] flex flex-col bg-white overflow-hidden"
          style={{
            bottom: 76,
            maxWidth: 420,
            margin: '0 auto',
            height: 'min(84vh, 700px)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              {view === 'history' ? (
                <>
                  <button
                    type="button"
                    aria-label="대화로 돌아가기"
                    className="text-gray-500 flex-shrink-0"
                    style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 18 }}
                    onClick={() => setView('chat')}
                  >
                    ←
                  </button>
                  <p className="text-sm font-bold text-gray-900" style={{ textShadow: 'none' }}>
                    지난 대화
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9999,
                      background: 'linear-gradient(135deg, #2a2a2c 0%, #0d0d0e 60%, #000 100%)',
                      boxShadow: '0 0 0 1px rgba(255,214,0,0.35)',
                    }}
                  >
                    <CookMatchMarkIcon size={21} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate"
                      style={{
                        textShadow: 'none',
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: '#111',
                      }}
                    >
                      쿡매치 AI
                    </p>
                    <p className="text-[11px] text-gray-400 truncate" style={{ textShadow: 'none' }}>
                      오늘 뭐 먹을지, 냉장고 재료로 같이 찾아볼게요 🍳
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {view === 'chat' && (
                <button
                  type="button"
                  aria-label="지난 대화 보기"
                  className="flex items-center justify-center text-gray-600 bg-gray-100 flex-shrink-0"
                  style={{ width: 38, height: 38, borderRadius: 9999, border: 'none', cursor: 'pointer' }}
                  onClick={() => setView('history')}
                >
                  <HistoryIcon size={21} />
                </button>
              )}
              <button
                type="button"
                aria-label="새 대화 시작"
                className="flex items-center justify-center text-gray-600 bg-gray-100 flex-shrink-0"
                style={{ width: 38, height: 38, borderRadius: 9999, border: 'none', cursor: 'pointer' }}
                onClick={startNewThread}
              >
                <PlusIcon size={21} />
              </button>
              <button
                type="button"
                aria-label="닫기"
                className="flex items-center justify-center text-gray-500 flex-shrink-0"
                style={{ width: 38, height: 38, fontSize: 22, border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {view === 'history' ? (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {threads.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-10" style={{ textShadow: 'none' }}>
                  최근 {HISTORY_RETENTION_DAYS}일 안에 나눈 대화가 없어요.
                </p>
              )}
              {threads.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
                  style={{ border: t.id === threadId ? '1px solid #FFD600' : '1px solid transparent' }}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => openThread(t)}
                  >
                    <p className="text-[13px] font-medium text-gray-800 truncate" style={{ textShadow: 'none' }}>
                      {threadTitle(t)}
                    </p>
                    <p className="text-[11px] text-gray-400" style={{ textShadow: 'none' }}>
                      {formatRelativeDate(t.updatedAt)} · 메시지 {t.messages.length}개
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="대화 삭제"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#aaa',
                      fontSize: 16,
                      padding: 4,
                      flexShrink: 0,
                    }}
                    onClick={() => deleteThread(t.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500" style={{ textShadow: 'none' }}>
                    뭐 먹을지 고민될 때, 냉장고 재료로 딱 맞는 레시피를 찾아드릴게요.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        className="text-xs px-3 py-2 rounded-full bg-gray-100 text-gray-700"
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => void sendMessage(hint)}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={`flex items-start gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 26,
                        height: 26,
                        marginTop: 1,
                        borderRadius: 9999,
                        background: 'linear-gradient(135deg, #2a2a2c 0%, #0d0d0e 60%, #000 100%)',
                      }}
                    >
                      <CookMatchMarkIcon size={16} />
                    </div>
                  )}
                  <div className={`max-w-[82%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                    <div
                      className={`text-[13px] leading-5 px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#222] text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                      style={{ textShadow: 'none' }}
                    >
                      {msg.content}
                    </div>
                    {msg.recipes && msg.recipes.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.recipes.map((recipe) => (
                          <a
                            key={recipe.id}
                            href={recipe.link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl overflow-hidden"
                            style={{ textDecoration: 'none' }}
                          >
                            {recipe.thumbnail ? (
                              <img
                                src={getProxiedImageUrl(recipe.thumbnail)}
                                alt=""
                                className="w-16 h-16 object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 flex-shrink-0" />
                            )}
                            <div className="min-w-0 pr-2 py-1">
                              <p
                                className="text-[12px] font-semibold text-gray-900 truncate"
                                style={{ textShadow: 'none' }}
                              >
                                {recipe.title}
                              </p>
                              <div
                                className="inline-flex items-center gap-1 rounded mt-1 px-1.5 py-0.5"
                                style={{ background: 'rgba(68,68,68,0.85)' }}
                              >
                                <span className="text-[9px] text-white font-medium" style={{ textShadow: 'none' }}>
                                  재료 매칭률
                                </span>
                                <span
                                  className="text-[10px] font-bold"
                                  style={{ color: '#FFD600', textShadow: 'none', letterSpacing: '0.3px' }}
                                >
                                  {recipe.match_rate}%
                                </span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <p className="text-xs text-gray-400" style={{ textShadow: 'none' }}>
                  레시피를 찾고 있어요…
                </p>
              )}
              {error && !loading && (
                <p className="text-xs text-red-500" style={{ textShadow: 'none' }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {view === 'chat' && (
            <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-100">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="먹고 싶은 걸 편하게 말해보세요"
                className="flex-1 text-[13px] px-3 py-2 rounded-full bg-gray-100 outline-none"
                style={{ border: 'none', textShadow: 'none' }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="text-[13px] font-semibold text-white px-3 rounded-full"
                style={{
                  background: loading || !input.trim() ? '#bbb' : '#222',
                  border: 'none',
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                  minWidth: 52,
                }}
              >
                보내기
              </button>
            </form>
          )}
        </section>
      )}

      {!open && (
        <div className="ai-fab-outer">
          <div className="ai-fab-glow" />
          <div className="ai-fab-ring-spin" />
          <button
            type="button"
            aria-label="AI 요리 챗봇 열기"
            className="ai-fab-button"
            onClick={openWidget}
          >
            <CookMatchMarkIcon size={29} />
          </button>
          <span className="ai-fab-badge" style={{ textShadow: 'none' }}>AI</span>
        </div>
      )}
    </>
  );
};

export default RecipeChatWidget;
