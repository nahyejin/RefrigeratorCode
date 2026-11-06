import React, { useEffect, useRef, useState } from 'react';
import { track } from '../utils/track';
import { openLoginGate } from '../utils/loginGate';
import { applyUsage, refreshUsage, spendOptimistically, usageHeaders } from '../utils/usage';
import { UsageLine, useUsage } from './UsageMeter';
import BackButton from './ui/BackButton';
import KebabMenu from './ui/KebabMenu';
import VoiceInputButton from './ui/VoiceInputButton';
import { UtensilsIcon } from './ui/Icons';
import { useLocation, useNavigate } from 'react-router-dom';
import StepLoading from './StepLoading';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { useCloseOnBack } from '../utils/closeOnBack';
import { openCookMode, subscribeCookMode } from '../utils/cookMode';
import { getPageContext } from '../utils/pageContext';

const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://refrigeratorcode-production.up.railway.app';

const STORAGE_FRIDGE = 'myfridge_ingredients';
const STORAGE_THREADS = 'cookmatch_chat_threads';
const HISTORY_RETENTION_DAYS = 30;
const MAX_STORED_THREADS = 30;

/** 첫 진입 시 보여주는 예시 질문 (맛 / 냉장고 / 대상 / 목적 / 상황을 고루 커버). 8개는 알약 더미로 보여 5개로 줄였다(2026-11-06). */
const SUGGESTIONS = [
  '오늘 매운 거 먹고 싶어',
  '있는 재료로 뭐 해먹을 수 있어?',
  '아이가 잘 먹는 반찬 알려줘',
  '다이어트 중인데 뭐 먹지?',
  '15분이면 되는 자취 요리',
];

type ChatRecipe = {
  id: number;
  title: string;
  /**
   * **왜 이 카드가 골라졌는지** 한 줄.
   *
   * 서버가 후보를 넉넉히 뽑아 LLM 에게 "질문에 실제로 맞는 것만 골라라" 라고
   * 시키면서 같이 받아 온 말이다. 없을 수도 있다(LLM 호출이 실패하면 예전처럼
   * 낱말 점수 순서로 나간다).
   */
  reason?: string;
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
   * **왜 이렇게 골랐나**(2026-11-06). 서버가 실제로 쓴 조건을 그대로 적어 보낸다 — 답 맨 아래에 작게 붙는다.
   * `considered` = 검색이 추려 LLM 에게 넘긴 후보 수, `picked` = 내보낸 수.
   */
  basis?: { considered: number; picked: number; lines: string[] } | null;
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
  /** 서버 오류·연결 실패로 답을 못 받아 안내 문구만 들어간 말풍선. 한 번 물었다고 치지 않는다. */
  failed?: boolean;
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

export function getFridgeIngredientNames(): string[] {
  // 곧 상하는 것부터, 기한 모르는 것은 뒤로(2026-11-06). 서버가 앞에서부터 자르므로 잘려 나가는 쪽이 덜 급한 재료가 되게.
  return getFridgeItems()
    .map((item, i) => ({ ...item, i }))
    .sort((a, b) => {
      if (a.daysLeft === null && b.daysLeft === null) return a.i - b.i;
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft || a.i - b.i;
    })
    .map((item) => item.name);
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
  /** 지금 대화를 나눈 화면 주소. 다른 화면에서 다시 열면 새 대화를 시작한다(`openWidget`). */
  const convoPathRef = useRef<string | null>(null);
  /** 열기 동작(새 대화 판단 포함) — 아래 `openWidget` 이 채운다. 숨겨진 화면에서는 기본 동작(그냥 열기). */
  const openFreshRef = useRef<() => void>(() => setOpen(true));
  // 요리 드로어가 열려 있는 동안은 둥근 AI 버튼을 숨긴다 — 드로어 안에 요리 한 건 전용 「쿡 코치」가 따로 있어서
  // 둘이 한 화면에 뜨면 어느 쪽에 물어야 하는지 헷갈린다(2026-11-06).
  const [cookOpen, setCookOpen] = useState(false);
  useEffect(() => subscribeCookMode(t => setCookOpen(!!t)), []);
  // 안드로이드 폰 「뒤로」로 대화창 닫기(utils/closeOnBack) — 대화 내용은 그대로 남는다
  useCloseOnBack(open, () => setOpen(false));
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

  // 쿡 픽은 **내냉장고·냉장고요리·요즘인기**에서만 뜬다(2026-11-06 사용자 결정 — 마이캘린더·마이페이지·식단 짜기 등에서는 안 뜬다).
  // 예전엔 로그인 화면 몇 곳만 빼고 모든 화면에 떴다. 빼는 목록이 아니라 **뜨는 목록**으로 둬야 새 화면이 생겨도 저절로 안 뜬다.
  const hideOnAuth = !['/', '/my-fridge', '/recipe-list', '/popular'].includes(location.pathname);
  /** 지금 어느 화면에서 묻는지 — 서버가 조언의 기준을 화면에 맞춘다. */
  const pageKind: 'fridge' | 'recipe-list' | 'popular' =
    location.pathname === '/recipe-list' ? 'recipe-list' : location.pathname === '/popular' ? 'popular' : 'fridge';

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

  // 홈 화면 위젯의 「쿡 픽」 버튼 → NativeShortcutBridge 가 이 이벤트를 쏜다.
  // (훅이라 아래 `if (hideOnAuth) return null` 보다 위에 있어야 한다 — 아래 있으면 로그인 화면을 드나들 때
  //  훅 개수가 바뀌어 React 오류가 난다.)
  // 이 컴포넌트는 AppRouter 에 한 번만 심겨 앱 어디서나 떠 있으므로, 화면을 옮기지 않고 열기만 하면 된다.
  React.useEffect(() => {
    const onOpen = () => openFreshRef.current();
    window.addEventListener('cookmatch-open-chat', onOpen);
    return () => window.removeEventListener('cookmatch-open-chat', onOpen);
  }, []);

  // 비회원이 체험 크레딧을 다 쓴 채로 챗봇을 열면 **열리는 순간** 로그인 확인창을 띄운다(2026-10-22 사용자 지적:
  // 질문을 보내고 나서야 떠서 헛걸음이었다). 훅이라 아래 `hideOnAuth` 분기보다 위에 둔다.
  const guestOut = !!usageNow && usageNow.is_guest && !usageNow.can_use_ai;
  const guestCredits = usageNow?.signup_credits;
  React.useEffect(() => {
    if (open && guestOut) openLoginGate('ai', { credits: guestCredits });
  }, [open, guestOut, guestCredits]);

  if (hideOnAuth) return null;

  /** 답을 한 번 받은 대화. 여기서부터는 이어서 못 묻고 새 대화로 간다(아래 입력 자리). */
  // 오류 안내(`failed`)는 답이 아니다 — 서버가 죽어서 실패했는데 「이 대화는 여기까지예요」로 잠그면 다시 물을 길이 없다(2026-11-06).
  const answered = messages.some(m => m.role === 'assistant' && !m.failed);

  const startNewThread = () => {
    setThreadId(createThreadId());
    setMessages([]);
    setError('');
    setView('chat');
  };

  const openWidget = () => {
    // 이 컴포넌트는 페이지를 옮겨도 앱 전체에 계속 떠 있는 채로 마운트돼 있다
    // (AppRouter 에 한 번만 심어짐). 그래서 `messages` 는 다른 화면에 갔다 와도 메모리에 남는다.
    //   · 같은 화면에서 내렸다 다시 열면 → 대화를 **그대로** 보여 준다(질문을 던지고 다른 화면을 봤다가 돌아왔더니 방금 그
    //     대화가 사라졌다는 실사용 보고가 있었다).
    //   · **다른 화면으로 옮긴 뒤** 다시 열면 → 새 대화(2026-11-06 사용자: 「쿡 픽 내렸다가 페이지 이동한 뒤 다시 켜면 새 대화창이
    //     떠야지」). 화면마다 조언의 기준이 다르고(냉장고요리 조건·요즘인기 구역), 앞 대화는 한 번 묻고 닫혀 있어서다.
    //     지난 대화는 `⋯ → 지난 대화` 에 그대로 남는다.
    if (messages.length > 0 && convoPathRef.current && convoPathRef.current !== location.pathname) {
      startNewThread();
    }
    setOpen(true);
  };
  openFreshRef.current = openWidget;


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
    // 이미 크레딧이 없는 비회원이면 서버에 보내지 않고 바로 확인창(질문을 쓴 뒤 눌러도 같은 안내).
    if (guestOut) {
      openLoginGate('ai', { credits: guestCredits });
      return;
    }

    convoPathRef.current = location.pathname;
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
          // 보고 있는 화면과 그 화면에 걸어 둔 조건(검색어·매칭률·임박 재료·정렬 / 요즘인기의 구역)을 함께 보낸다.
          page_context: { page: pageKind, lines: getPageContext()?.page === pageKind ? getPageContext()!.lines : [] },
        }),
      });
      const data = await response.json();
      // 성공이든 한도 초과(429)든 서버가 최신 사용량을 함께 보낸다 — 다시 조회하지
      // 않고 그대로 반영해서, 화면 세 곳이 곧바로 같은 값을 보이게 한다.
      applyUsage(data?.usage);
      track('chat_use');
      if (!response.ok) {
        // 비회원 체험을 다 썼으면 같은 로그인 확인창을 띄운다(말풍선에는 서버 안내가 그대로 남는다).
        if (data?.usage?.is_guest && data.usage.can_use_ai === false) {
          openLoginGate('ai', { credits: data.usage.signup_credits });
        }
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
          basis: data.basis || null,
          intent: data.intent || 'recipe',
          helpTitle: data.help_title || '',
          action: data.action || null,
        },
      ]);
    } catch (err) {
      // 서버에 닿지 못하면 브라우저가 영어 `Failed to fetch` 를 준다 — 사람 말로 바꾼다(2026-11-06 서버가 내려갔을 때 그대로 보였다).
      const message = err instanceof TypeError
        ? '서버에 연결하지 못했어요. 잠시 뒤 다시 물어봐 주세요.'
        : err instanceof Error ? err.message : '채팅 요청에 실패했습니다.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: message, failed: true },
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
  // 거의 전체 높이(2026-11-06 「창이 너무 작다, 핸드폰으로 본다」): 아래는 하단 메뉴 자리까지 내려오고 위·아래 여백만 남긴다.
  // 열려 있는 동안 떠 있는 알약은 숨고, 접는 길은 머리줄의 ⌄ · 바깥 어두운 곳 · 휴대폰 뒤로가기다.
  const panelBottom = keyboardOpen ? viewportInfo!.keyboardInset + 8 : 12;
  const panelHeight = viewportInfo
    ? Math.min(Math.max(320, viewportInfo.height - panelBottom - 24), 760)
    : 'min(calc(100dvh - 36px), 760px)';

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
          {/* 머리말 한 줄(2026-11-06 「타이틀 영역이 너무 높다·글자가 크다·크레딧을 줄바꿈할 필요가 있나」): 제목은 앱의 다른
              제목(섹션 15px/700)과 같은 크기로 줄이고, 크레딧은 제목 옆 같은 줄에 둔다. 아바타도 36 → 28. */}
          <header
            className="flex items-center justify-between pl-3 pr-1.5"
            style={{ borderBottom: '1px solid var(--line-200)', minHeight: 48 }}
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
                    style={{ width: 28, height: 28 }}
                  >
                    <UtensilsIcon size={16} strokeWidth={2.2} style={{ color: '#1A1A1E' }} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', whiteSpace: 'nowrap' }}>쿡 픽</span>
                  <span className="ai-tag" style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '.04em', padding: '1.5px 6px',
                    borderRadius: 6, background: '#1A1A1E', color: '#FFD600', flexShrink: 0,
                  }}>AI</span>
                  {/* 기능을 쓰려고 연 시점이 남은 양을 알려주기 가장 좋은 때다. 제목과 같은 줄에, 한 줄로 끝나는 것만. */}
                  <UsageLine compact style={{ marginLeft: 4, whiteSpace: 'nowrap', minWidth: 0 }} />
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* 지난 대화·새 대화는 자주 안 누르는 보조 동작이라 `⋯` 뒤로 물렸다(2026-11-06). 전엔 회색 원 버튼
                  셋(지난 대화·새 대화·닫기)이 머리말에 나란히 있어 무거웠다. 닫기만 밖에 남긴다. */}
              <KebabMenu
                ariaLabel="대화 메뉴"
                items={[
                  ...(view === 'chat' ? [{ label: '지난 대화', onClick: () => setView('history') }] : []),
                  { label: '새 대화', onClick: startNewThread },
                ]}
              />
              {/* 닫기(×)가 아니라 **접기(⌄)** — 접어도 대화는 그대로이고 쿡 코치와 같은 모양이다. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="접기"
                style={{
                  width: 36, height: 36, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--ink-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 9.5l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
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
                      <UtensilsIcon size={14} strokeWidth={2.2} style={{ color: '#1A1A1E' }} />
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
                          <div
                            key={recipe.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              track('recipe_open', String(recipe.id));
                              openCookMode({
                                id: recipe.id,
                                title: recipe.title,
                                link: recipe.link,
                                myIngredients: getFridgeItems().map(i => i.name),
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).click();
                              }
                            }}
                            className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl overflow-hidden"
                            style={{ textDecoration: 'none', cursor: 'pointer' }}
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
                              {/* 왜 이게 나왔는지. 사용자가 카드를 보고
                                  "이건 왜 골랐지" 를 그 자리에서 알 수 있게. */}
                              {recipe.reason && (
                                <p className="text-[11.5px] text-gray-500 truncate mt-0.5">
                                  {recipe.reason}
                                </p>
                              )}
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
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 맨 아래 「왜 이렇게 골랐나」 — 서버가 실제로 쓴 조건 그대로(후보 몇 개 → 몇 개). 접어 두고 필요할 때만 편다. */}
                    {!msg.typing && msg.basis && msg.basis.picked > 0 && (
                      <details
                        className="mt-2"
                        style={{ background: 'var(--surface)', border: '1px solid var(--line-200)', borderRadius: 12, padding: '8px 12px' }}
                      >
                        <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', cursor: 'pointer', listStyle: 'none' }}>
                          근거 · 후보 {msg.basis.considered}개를 살펴보고 {msg.basis.picked}개를 골랐어요 ▾
                        </summary>
                        <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, lineHeight: 1.6, color: 'var(--ink-500)' }}>
                          {msg.basis.lines.map((line, i) => (<li key={i}>{line}</li>))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                /* **기다림은 앱 안에서 한 모양이어야 한다.**
                   식단 짜기·사진 인식이 쓰는 `StepLoading` 을 그대로 쓴다.
                   점 세 개짜리 한 줄이었는데, 챗봇이 이제 LLM 을 두 번 부르므로
                   (검색어 뽑기 → 후보 중에서 고르기) 그만큼 더 기다린다.
                   무슨 일이 일어나는 중인지 보이지 않으면 멈춘 것처럼 읽힌다. */
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line-200)',
                              borderRadius: 14, padding: '4px 14px 14px' }}>
                  <StepLoading
                    steps={[
                      '질문을 이해하는 중이에요',
                      '냉장고 재료로 만들 수 있는 걸 찾는 중이에요',
                      '질문에 맞는 것만 고르는 중이에요',
                      '고른 이유를 정리하는 중이에요',
                    ]}
                    timings={[700, 2000, 4000, 7000]}
                    note="LLM을 두 번 거쳐 답을 골라서 몇 초 걸려요"
                    lastNote="거의 다 됐어요. 조금만 더 기다려 주세요"
                    rows={3}
                  />
                </div>
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
            {/* **한 대화에 한 번만 묻는다**(2026-11-06) — 식단 짜기와 같은 규칙. 이어서 또 물으면 위의 답이 어느 질문에
                대한 것인지 흐려지고, 크레딧이 언제 나갔는지도 헷갈린다. 다시 물으려면 `새 대화` 이고 앞의 것은 지난 대화로 남는다. */}
            {answered ? (
              <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))', background: '#F5F5F7' }}>
                <button
                  type="button"
                  onClick={startNewThread}
                  style={{
                    width: '100%', minHeight: 46, borderRadius: 23, border: 'none',
                    background: '#1A1A1E', color: '#FFFFFF',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  새 대화로 다시 물어보기
                </button>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 6, textAlign: 'center' }}>
                  이 대화는 여기까지예요
                </div>
                <UsageLine style={{ justifyContent: 'center', marginTop: 4 }} cost={chatCost} costOnly />
              </div>
            ) : (
            <>
            {/* 남은 양과 **이번에 얼마 나가는지**를 보내기 직전 자리에 둔다.
                머리말에도 있지만 거기는 폭이 좁아 값을 못 적는다. 누르기
                직전이 알아야 할 때다. */}
            <div style={{ padding: '6px 12px 0', background: '#F5F5F7' }}>
              {/* 쿡 픽이 무엇인지 한 줄 — 쿡 코치가 「이 요리를 도와드려요」 를 달고 있는 것처럼(2026-11-06). */}
              {/* **한 줄**이어야 한다(넘치면 말줄임). 「이 화면 기준」이라는 것과 **화면에 보이는 것만이 아니라 전체 레시피에서**
                  찾는다는 것을 함께 말한다 — 목록은 스크롤해야 20개 넘게 보이지만 쿡 픽은 보이는 20개만 보지 않는다. */}
              <div style={{
                fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-500)', textAlign: 'center', marginBottom: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {pageKind === 'recipe-list' ? '이 화면의 조건을 참고해 전체 레시피에서 골라요'
                  : pageKind === 'popular' ? '보고 있는 구역을 참고해 전체 레시피에서 골라요'
                  : '내 냉장고 재료를 기준으로 전체 레시피에서 골라요'}
              </div>
              <UsageLine cost={chatCost} costOnly />
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
                // min-w-0: 입력창은 기본으로 약 20글자 폭을 고집해서, 휴대폰 글꼴을 키우면 그 폭도
                // 같이 커져 "보내기" 버튼을 화면 밖으로 밀어냈다(어르신 폰 실사용 지적, 2026-09-21).
                // 남는 폭만큼만 차지하고 줄어들 수 있게 한다 — 기본 글꼴에선 보이는 모습 그대로.
                className="ai-chat-input flex-1 min-w-0 text-[15px]"
                disabled={loading}
              />
              {/* 말로 입력(2026-11-06). 입력창에 채우기만 하고 보내기는 ↑ 로 직접 한다. */}
              <VoiceInputButton value={input} onText={setInput} onError={setError} disabled={loading} />
              {/* 식단 AI 화면의 보내기와 같은 둥근 ↑ 버튼(`ai-action`). 화면마다 「보내기」 글자 / ↑ 로 달랐다. */}
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
            </form>
            </>
            )}
            </>
          )}
        </section>
      )}

      {!open && !cookOpen && (
        <div className="ai-fab-outer" data-guide-target="chat-fab">
          <button
            type="button"
            aria-label="쿡 픽 열기"
            className="ai-fab-pill y"
            onClick={openWidget}
          >
            {/* 글자가 붙은 알약(2026-11-06 「쿡 픽 A」): 포크·나이프 선 아이콘 + 이름. 오른쪽 위 AI 배지는 아래 형제. */}
            <UtensilsIcon size={20} />
            <span>쿡 픽</span>
          </button>
          {/* AI 가 붙은 자리는 어디서나 같은 「AI」 배지(2026-11-06 사용자: 배지를 왜 없앴나 — AI 가 붙은 건 다 붙이기로 했다). */}
          <span className="ai-fab-badge">AI</span>
        </div>
      )}
    </>
  );
};

export default RecipeChatWidget;
