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

/** 첫 진입 시 보여주는 예시 질문 (맛 / 냉장고 / 대상 / 목적 / 상황을 고루 커버) */
const SUGGESTIONS = [
  '오늘 매운 거 먹고 싶어',
  '있는 재료로 뭐 해먹을 수 있어?',
  '재료 상관없이 간단한 거 추천해줘',
  '아이가 잘 먹는 반찬 알려줘',
  '다이어트 중인데 뭐 먹지?',
  '캠핑 가서 해먹기 좋은 요리',
  '술안주로 괜찮은 거 추천해줘',
  '15분이면 되는 자취 요리',
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

/** 챗봇 아이덴티티 말풍선 아이콘 (말풍선 + 말줄임 점 3개 + 반짝임) */
const ChatBubbleIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
  >
    {/* 말풍선 본체 + 왼쪽 아래 꼬리 */}
    <path
      className="ai-fab-bubble"
      d="M4.6 3.9h14.8c1 0 1.9.9 1.9 1.9v9.1c0 1-.9 1.9-1.9 1.9H9.9l-4.1 3.3c-.6.5-1.5.1-1.5-.7v-2.6h-.6c-.6-.3-1-.9-1-1.6V5.8c0-1 .9-1.9 1.9-1.9z"
      fill="currentColor"
    />
    {/* 말줄임 점 3개 (말풍선 안쪽, 버튼 배경색으로 뚫음) */}
    <circle className="ai-fab-bubble-dot" cx="8.4" cy="10.4" r="1.35" />
    <circle className="ai-fab-bubble-dot" cx="12" cy="10.4" r="1.35" />
    <circle className="ai-fab-bubble-dot" cx="15.6" cy="10.4" r="1.35" />
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
  const [viewportInfo, setViewportInfo] = useState<{ height: number; keyboardInset: number } | null>(null);

  // 모바일 키보드가 뜨면 visualViewport가 줄어드는데, 100vh 기준 높이는 이걸 반영하지
  // 못해서 패널 위쪽이 키보드 뒤로 잘려 보인다 — 실제 보이는 뷰포트를 추적해서
  // 패널 높이/위치를 그때그때 맞춘다.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setViewportInfo({ height: vv.height, keyboardInset });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

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

  // 패널이 열려 있는 동안 뒤 페이지 스크롤 잠금.
  // 잠그지 않으면 모바일에서 패널 안을 드래그할 때 뒤 페이지가 같이 밀려서
  // "패널이 안 스크롤된다"고 느껴짐
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || view !== 'chat' || !listRef.current) return;
    const list = listRef.current;
    const maxScroll = list.scrollHeight - list.clientHeight;
    if (maxScroll <= 0) return;

    // 답변이 길면 맨 아래로 보내지 않고 '마지막 질문'이 상단에 오도록 스크롤.
    // 그래야 긴 답변을 처음부터 읽을 수 있고, 아래로 더 있다는 것도 인지됨
    const userMsgs = list.querySelectorAll<HTMLElement>('[data-msg-role="user"]');
    const lastUser = userMsgs[userMsgs.length - 1];
    if (lastUser) {
      const delta = lastUser.getBoundingClientRect().top - list.getBoundingClientRect().top;
      list.scrollTop = Math.min(list.scrollTop + delta - 12, maxScroll);
    } else {
      list.scrollTop = maxScroll;
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

  const keyboardOpen = !!viewportInfo && viewportInfo.keyboardInset > 60;
  const panelBottom = keyboardOpen ? viewportInfo!.keyboardInset + 8 : 76;
  const panelHeight = viewportInfo
    ? Math.min(Math.max(320, viewportInfo.height - panelBottom - 16), 640)
    : 'min(80dvh, 640px)';

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
            bottom: panelBottom,
            maxWidth: 420,
            margin: '0 auto',
            height: panelHeight,
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            transition: 'bottom 120ms ease-out, height 120ms ease-out',
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
                    className="ai-avatar-mark flex items-center justify-center flex-shrink-0"
                    style={{ width: 36, height: 36 }}
                  >
                    <ChatBubbleIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    {/* 설명 문구는 본문 인트로와 중복되고 좁은 화면에서 말줄임되어 제거 */}
                    <p
                      className="truncate"
                      style={{
                        textShadow: 'none',
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#111',
                      }}
                    >
                      쿡매치 AI
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
            <div className="ai-chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ minHeight: 0 }}>
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
            <div ref={listRef} className="ai-chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ minHeight: 0 }}>
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
                  data-msg-role={msg.role}
                  className={`flex items-start gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="ai-avatar-mark flex items-center justify-center flex-shrink-0"
                      style={{ width: 26, height: 26, marginTop: 1 }}
                    >
                      <ChatBubbleIcon size={15} />
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
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 p-3"
              style={{ borderTop: '1px solid #EDEDF0', background: '#FAFAFB' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="먹고 싶은 걸 편하게 말해보세요"
                className="ai-chat-input flex-1 text-[13px]"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="text-[13px] font-bold rounded-full flex-shrink-0"
                style={{
                  height: 40,
                  minWidth: 56,
                  padding: '0 14px',
                  background: loading || !input.trim() ? '#E4E4E8' : '#FFD600',
                  color: loading || !input.trim() ? '#9A9AA0' : '#1A1A1A',
                  border: 'none',
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
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
          <button
            type="button"
            aria-label="AI 요리 챗봇 열기"
            className="ai-fab-button"
            onClick={openWidget}
          >
            <ChatBubbleIcon size={26} />
          </button>
          <span className="ai-fab-badge" style={{ textShadow: 'none' }}>AI</span>
        </div>
      )}
    </>
  );
};

export default RecipeChatWidget;
