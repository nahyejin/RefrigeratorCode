import React, { useEffect, useRef, useState } from 'react';
import { track } from '../utils/track';
import { applyUsage, refreshUsage, spendOptimistically, usageHeaders } from '../utils/usage';
import { UsageLine, useUsage } from './UsageMeter';
import BackButton from './ui/BackButton';
import { useLocation, useNavigate } from 'react-router-dom';
import { getProxiedImageUrl } from '../utils/imageUtils';
import CloseButton from './ui/CloseButton';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const STORAGE_FRIDGE = 'myfridge_ingredients';
const STORAGE_THREADS = 'cookmatch_chat_threads';
const HISTORY_RETENTION_DAYS = 30;
const MAX_STORED_THREADS = 30;

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
  /**
   * 무엇에 대한 답인가.
   *
   * 이 대화창은 레시피만 받는 곳이 아니다 — 요리하다 막혀서 묻기도 하고,
   * 앱을 어떻게 쓰는지 묻기도 한다. 다 레시피 검색으로 받으면 엉뚱한 목록이
   * 뜨고, 두어 번 헛물을 켠 사람은 다시 안 연다.
   */
  intent?: 'recipe' | 'cooking' | 'app' | 'other';
  /** 앱 사용법 답에 붙는 제목과, 그 화면으로 바로 가는 버튼. */
  helpTitle?: string;
  action?: { path: string; label: string } | null;
  /** 타이핑 애니메이션용. content는 fullContent를 향해 점점 채워지는 중간 상태다. */
  fullContent?: string;
  typing?: boolean;
};

/** 타이핑 애니메이션 속도 — 한 번에 채우는 글자 수 / 그 간격(ms) */
const TYPING_CHARS_PER_TICK = 2;
const TYPING_TICK_MS = 24;

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

type FridgeRawItem = { name?: string; expiry?: string; estimatedExpiry?: string };

/**
 * expiry(직접 입력) 우선, 없으면 estimatedExpiry(구매일로 짐작한 값)를 써서
 * 자정 기준 Date로 돌려준다. 둘 다 없거나 형식이 이상하면 null
 * (MyFridge.tsx의 getDdayLabel과 같은 기준).
 */
function parseExpiryDate(item: FridgeRawItem): Date | null {
  const raw = item.expiry || item.estimatedExpiry;
  if (!raw) return null;
  const d = new Date(String(raw).replace(/\./g, '-'));
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 유통기한(직접 입력 또는 구매일로 짐작한 값)이 이미 지난 재료인지 본다.
 * 지난 재료는 실제로는 못 쓸 가능성이 높으니 챗봇 추천의 "보유 재료"에서 뺀다.
 */
function isExpired(item: FridgeRawItem): boolean {
  const d = parseExpiryDate(item);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/**
 * 냉장고 재료 목록(냉동/냉장/실온) 중 유통기한이 지나지 않은 것만, 이름과
 * 남은 일수(daysLeft, 정보 없으면 null)와 함께 돌려준다. 챗봇에 보내는
 * ingredients(이름만)와 ingredient_expiry(유통기한 임박도)가 여기서 갈라져 나온다 —
 * 서버가 답변 문장에서 어떤 재료를 이름으로 부를지 정할 때(조미료 제외, 유통기한
 * 임박 우선) 참고하도록 남은 일수를 함께 보낸다.
 */
function getFridgeItems(): { name: string; daysLeft: number | null }[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_FRIDGE) || 'null');
    if (!data) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...(data.frozen || []), ...(data.fridge || []), ...(data.room || [])]
      .filter((item: FridgeRawItem) => !isExpired(item))
      .map((item: FridgeRawItem) => {
        const name = (item?.name || '').trim();
        const expiryDate = parseExpiryDate(item);
        const daysLeft = expiryDate
          ? Math.round((expiryDate.getTime() - today.getTime()) / 86400000)
          : null;
        return { name, daysLeft };
      })
      .filter((item) => Boolean(item.name));
  } catch {
    return [];
  }
}

function getFridgeIngredientNames(): string[] {
  return getFridgeItems().map((item) => item.name);
}

/** 유통기한 정보가 있는 재료만, 이름과 남은 일수로 서버에 보낼 형태로 추려낸다. */
function getFridgeIngredientExpiry(): { name: string; days_left: number }[] {
  return getFridgeItems()
    .filter((item): item is { name: string; daysLeft: number } => item.daysLeft !== null)
    .map((item) => ({ name: item.name, days_left: item.daysLeft }));
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
  // 앱 사용법 답에 붙는 `바로 가기` 버튼이 쓴다. 말로만 알려 주면
  // 그 화면을 다시 찾아 헤맨다.
  const navigate = useNavigate();
  // 이 대화창에서 한 번 물으면 몇 크레딧이 나가는지. 서버가 정한 값.
  const usageNow = useUsage();
  const chatCost = (usageNow?.credits as any)?.chat ?? 1;
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
    location.pathname.startsWith('/auth') ||
    // AI 식단 추천은 그 자체가 채팅 화면이다. 여기에 챗봇 버튼까지 띄우면
    // 아래 고정 입력창을 가리고, 채팅이 두 개인 것처럼 보인다.
    (location.pathname.startsWith('/plan') && location.search.includes('ai=1'));

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

  // 챗봇 답변을 한 번에 다 보여주지 않고, 제미나이처럼 글자가 순차적으로
  // 채워지는 것처럼 보이게 한다. content를 fullContent를 향해 조금씩
  // 늘려가는 방식이라 실제 스트리밍은 아니지만(백엔드가 JSON 응답 전체를
  // 한 번에 주기 때문), 사용자가 보는 화면은 동일한 타이핑 효과를 낸다.
  useEffect(() => {
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    if (!last || last.role !== 'assistant' || !last.typing) return;

    const full = last.fullContent ?? '';
    if (last.content.length >= full.length) {
      setMessages((prev) => {
        const target = prev[lastIndex];
        if (!target || !target.typing) return prev;
        const next = [...prev];
        next[lastIndex] = { ...target, typing: false };
        return next;
      });
      return;
    }

    const timer = setTimeout(() => {
      setMessages((prev) => {
        const target = prev[lastIndex];
        if (!target || !target.typing) return prev;
        const targetFull = target.fullContent ?? '';
        const nextLen = Math.min(target.content.length + TYPING_CHARS_PER_TICK, targetFull.length);
        const next = [...prev];
        next[lastIndex] = { ...target, content: targetFull.slice(0, nextLen) };
        return next;
      });
    }, TYPING_TICK_MS);
    return () => clearTimeout(timer);
  }, [messages]);

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
    // 서버는 LLM 을 부르기 전에 이미 깎았다. 답이 5~10초 걸리는데 그때까지
    // 위쪽 숫자가 그대로면 "차감이 안 된다" 로 보인다 — 보내는 즉시 깎아
    // 보여 주고, 응답이 오면 아래에서 서버 값으로 덮는다.
    spendOptimistically(chatCost);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        // 사용량 한도는 사용자별이다. 로그인했으면 토큰으로, 아니면 기기 식별자로 센다.
        headers: { 'Content-Type': 'application/json', ...usageHeaders() },
        body: JSON.stringify({
          session_id: threadId,
          messages: nextMessages.map(({ role, content: body }) => ({ role, content: body })),
          ingredients: getFridgeIngredientNames(),
          ingredient_expiry: getFridgeIngredientExpiry(),
        }),
      });
      const data = await response.json();
      // 성공이든 한도 초과(429)든 서버가 최신 사용량을 함께 보낸다 — 다시 조회하지
      // 않고 그대로 반영해서, 화면 세 곳이 곧바로 같은 값을 보이게 한다.
      applyUsage(data?.usage);
      track('chat_use');
      if (!response.ok) {
        throw new Error(data.error || '채팅 요청에 실패했습니다.');
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          fullContent: data.reply || '레시피를 찾아봤어요.',
          typing: true,
          recipes: Array.isArray(data.recipes) ? data.recipes : [],
          intent: data.intent || 'recipe',
          helpTitle: data.help_title || '',
          action: data.action || null,
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
      // 위의 `applyUsage(data?.usage)` 로 보통은 즉시 맞춰진다. 다만 서버가
      // 사용량을 안 실어 보내는 길이 있다 — 광범위한 질문("있는 걸로 뭐 해먹지")
      // 은 LLM 을 안 부르므로 차감이 없고, 네트워크가 끊기면 응답 자체가 없다.
      // 그런 때 화면에 옛 숫자가 남지 않도록 한 번 더 물어본다.
      void refreshUsage();
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
          className="fixed inset-0 bg-black/40 z-[var(--z-overlay)]"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <section
          className="fixed left-3 right-3 z-[var(--z-modal)] flex flex-col bg-white overflow-hidden"
          style={{
            bottom: panelBottom,
            maxWidth: 420,
            margin: '0 auto',
            height: panelHeight,
            // 팝업 공통 규격에 맞춤 (Dialog / Sheet 와 동일한 모서리·그림자)
            borderRadius: 20,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            transition: 'bottom 120ms ease-out, height 120ms ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <header
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--line-200)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {view === 'history' ? (
                <>
                  <BackButton
                    onClick={() => setView('chat')}
                    absolute={false}
                    label="대화로 돌아가기"
                  />
                  <p className="text-sm font-bold text-gray-900">
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
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#1A1A1E',
                      }}
                    >
                      쿡매치 AI
                    </p>
                    {/* 기능을 쓰려고 연 시점이 남은 양을 알려주기 가장 좋은 때다.
                        헤더는 폭이 좁아 compact — 한 줄로 끝나는 것만 보여준다. */}
                    <UsageLine compact />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {view === 'chat' && (
                <button
                  type="button"
                  aria-label="지난 대화 보기"
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 40, height: 40, borderRadius: 9999, border: 'none',
                    cursor: 'pointer', background: 'var(--surface-sub)', color: 'var(--ink-700)',
                  }}
                  onClick={() => setView('history')}
                >
                  <HistoryIcon size={21} />
                </button>
              )}
              <button
                type="button"
                aria-label="새 대화 시작"
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 40, height: 40, borderRadius: 9999, border: 'none',
                  cursor: 'pointer', background: 'var(--surface-sub)', color: 'var(--ink-700)',
                }}
                onClick={startNewThread}
              >
                <PlusIcon size={21} />
              </button>
              <CloseButton onClick={() => setOpen(false)} absolute={false} />
            </div>
          </header>

          {view === 'history' ? (
            <div className="ai-chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ minHeight: 0 }}>
              {threads.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-10">
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
                    <p className="text-[15px] font-medium text-gray-800 truncate">
                      {threadTitle(t)}
                    </p>
                    <p className="text-[13px] text-gray-400">
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
                      color: '#9A9AA2',
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
              {threads.length > 0 && (
                <p className="text-[11px] text-gray-400 text-center pt-2 pb-1">
                  최근 대화 {MAX_STORED_THREADS}개까지만 보관돼요. 그 이전 대화는 자동으로 지워져요.
                </p>
              )}
            </div>
          ) : (
            <div ref={listRef} className="ai-chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ minHeight: 0 }}>
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
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
                      className={`text-[15px] leading-5 px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#1A1A1E] text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      {/* 앱 사용법 답은 **정해진 문장**이라 굵은 글씨가 들어 있다.
                          이 한 자리에서만 서식을 허용한다 — 요리 답변은 LLM 이
                          쓰므로 그대로 글자로만 그린다. */}
                      {msg.intent === 'app' && !msg.typing ? (
                        <>
                          {msg.helpTitle && (
                            <div className="text-[13px] font-bold text-gray-900 mb-1">
                              {msg.helpTitle}
                            </div>
                          )}
                          <span dangerouslySetInnerHTML={{ __html: msg.content }} />
                        </>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {/* 말로만 알려 주면 그 화면을 다시 찾아 헤맨다. 바로 데려간다. */}
                    {!msg.typing && msg.action && (
                      <button
                        type="button"
                        onClick={() => { setOpen(false); navigate(msg.action!.path); }}
                        className="mt-2 h-9 px-3 rounded-lg text-[13px] font-bold"
                        style={{ background: '#FFD600', color: '#1A1A1E', border: 'none', cursor: 'pointer' }}
                      >
                        {msg.action.label} ›
                      </button>
                    )}
                    {!msg.typing && msg.recipes && msg.recipes.length > 0 && (
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
                                className="text-[13px] font-semibold text-gray-900 truncate"
                              >
                                {recipe.title}
                              </p>
                              <div
                                className="inline-flex items-center gap-1 rounded mt-1 px-1.5 py-0.5"
                                style={{ background: 'rgba(68,68,68,0.85)' }}
                              >
                                <span className="text-[12px] text-white font-medium">
                                  재료 매칭률
                                </span>
                                <span
                                  className="text-[12px] font-bold"
                                  style={{ color: '#FFD600', letterSpacing: '0.3px' }}
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
                <p className="text-xs text-gray-400">
                  레시피를 찾고 있어요…
                </p>
              )}
              {error && !loading && (
                <p className="text-xs text-red-500">
                  {error}
                </p>
              )}
            </div>
          )}

          {view === 'chat' && (
            <>
            {/* 남은 양과 **이번에 얼마 나가는지**를 보내기 직전 자리에 둔다.
                머리말에도 있지만 거기는 폭이 좁아 값을 못 적는다. 누르기
                직전이 알아야 할 때다. */}
            <div style={{ padding: '6px 12px 0', background: '#F5F5F7' }}>
              <UsageLine cost={chatCost} />
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 p-3"
              style={{ background: '#F5F5F7' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="먹고 싶은 걸 편하게 말해보세요"
                className="ai-chat-input flex-1 text-[15px]"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="text-[15px] font-bold rounded-full flex-shrink-0"
                style={{
                  height: 40,
                  minWidth: 56,
                  padding: '0 14px',
                  background: loading || !input.trim() ? '#E6E6EA' : '#FFD600',
                  color: loading || !input.trim() ? '#9A9AA2' : '#1A1A1E',
                  border: 'none',
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                보내기
              </button>
            </form>
            </>
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
          <span className="ai-fab-badge">AI</span>
          
        </div>
      )}
    </>
  );
};

export default RecipeChatWidget;
