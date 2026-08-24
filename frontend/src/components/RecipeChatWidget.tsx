import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getProxiedImageUrl } from '../utils/imageUtils';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const STORAGE_FRIDGE = 'myfridge_ingredients';
const STORAGE_SESSION = 'cookmatch_chat_session';
const STORAGE_MESSAGES = 'cookmatch_chat_messages';

const SUGGESTIONS = [
  '오늘 매운 거 먹고 싶어',
  '있는 재료로 뭐 해먹을 수 있어?',
  '간단하게 만들 수 있는 거',
];

type ChatRecipe = {
  id: number;
  title: string;
  thumbnail: string;
  platform: string;
  link: string;
  match_rate: number;
};

const SparklesIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      className="ai-fab-icon-main"
      d="M9.81 15.9L9 18.75l-.81-2.85a4.5 4.5 0 00-3.09-3.09L2.25 12l2.85-.81a4.5 4.5 0 003.09-3.09L9 5.25l.81 2.85a4.5 4.5 0 003.09 3.09l2.85.81-2.85.81a4.5 4.5 0 00-3.09 3.09z"
      fill="currentColor"
    />
    <path
      className="ai-fab-icon-spark"
      d="M18.26 8.72L18 9.75l-.26-1.03a3.38 3.38 0 00-2.46-2.46L14.25 6l1.03-.26a3.38 3.38 0 002.46-2.46L18 2.25l.26 1.03a3.38 3.38 0 002.46 2.46L21.75 6l-1.03.26a3.38 3.38 0 00-2.46 2.46z"
      fill="currentColor"
    />
  </svg>
);

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  recipes?: ChatRecipe[];
};

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

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(STORAGE_SESSION);
  if (!id) {
    id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(STORAGE_SESSION, id);
  }
  return id;
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const RecipeChatWidget: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hideOnAuth =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/signup') ||
    location.pathname.startsWith('/find-email') ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname.startsWith('/auth');

  useEffect(() => {
    sessionStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (hideOnAuth) return null;

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
          session_id: getOrCreateSessionId(),
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
            height: 'min(70vh, 560px)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  background: 'linear-gradient(135deg, #2a2a2c 0%, #0d0d0e 60%, #000 100%)',
                }}
              >
                <SparklesIcon size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900" style={{ textShadow: 'none' }}>
                  AI 요리 챗
                </p>
                <p className="text-[11px] text-gray-400" style={{ textShadow: 'none' }}>
                  냉장고 재료로 레시피를 찾아드려요
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[11px] text-gray-500"
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}
                onClick={() => {
                  setMessages([]);
                  sessionStorage.removeItem(STORAGE_MESSAGES);
                }}
              >
                새 대화
              </button>
              <button
                type="button"
                aria-label="닫기"
                className="text-gray-500 text-lg leading-none"
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500" style={{ textShadow: 'none' }}>
                  어느 탭에 있어도 바로 물어볼 수 있어요.
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
                      width: 22,
                      height: 22,
                      marginTop: 1,
                      borderRadius: 9999,
                      background: 'linear-gradient(135deg, #2a2a2c 0%, #0d0d0e 60%, #000 100%)',
                    }}
                  >
                    <SparklesIcon size={13} />
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
                            <p className="text-[11px] text-gray-500" style={{ textShadow: 'none' }}>
                              재료 매칭률 {recipe.match_rate}%
                            </p>
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

          <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-100">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="먹고 싶은 맛을 말해 보세요"
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
            onClick={() => setOpen(true)}
          >
            <SparklesIcon size={24} />
          </button>
          <span className="ai-fab-badge" style={{ textShadow: 'none' }}>AI</span>
        </div>
      )}
    </>
  );
};

export default RecipeChatWidget;
