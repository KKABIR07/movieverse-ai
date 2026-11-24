'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Hash, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useChatStore, CHAT_ROOMS, type ChatMessage, type RoomId } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { openAuth } from '@/store';
import { formatRelativeTime } from '@/lib/format';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/components/ui/cn';

const POLL_MS = 5000;
const AI_TAB = 'ai';
type ActiveTab = RoomId | typeof AI_TAB;

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AI_WELCOME: AiMessage = {
  id: 'ai-welcome',
  role: 'assistant',
  content: "Hi! I'm the mkmovies assistant. Ask for recommendations, plot explanations or who directed what.",
};

/** Poll the active room every 5s while the panel is open and the tab is visible. */
function useRoomPolling(roomId: RoomId | null, enabled: boolean) {
  const fetchRoom = useChatStore((s) => s.fetchRoom);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!enabled || !roomId) return;
    let ctrl = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      ctrl.abort();
      ctrl = new AbortController();
      void fetchRoom(roomId, { signal: ctrl.signal, currentUserId: userId });
    };
    const start = () => {
      if (timer) return;
      tick();
      timer = setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      ctrl.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [roomId, enabled, fetchRoom, userId]);
}

function Bubble({ m, showName }: { m: ChatMessage; showName: boolean }) {
  return (
    <li className={cn('flex gap-2.5', m.isMine && 'flex-row-reverse')}>
      {!m.isMine &&
        (showName ? (
          <span
            aria-hidden
            className="mt-5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-micro font-semibold text-fg-secondary"
          >
            {m.initials}
          </span>
        ) : (
          <span aria-hidden className="w-8 shrink-0" />
        ))}
      <div className={cn('flex max-w-[78%] flex-col gap-1', m.isMine ? 'items-end' : 'items-start')}>
        {showName && <span className="px-1 text-micro font-medium text-fg-muted">{m.isMine ? 'You' : m.userName}</span>}
        <p
          className={cn(
            'whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-caption leading-relaxed',
            m.isMine ? 'rounded-tr-md bg-accent text-on-accent' : 'rounded-tl-md border border-line bg-surface-2 text-fg',
            m.pending && 'opacity-70',
          )}
        >
          <span className="sr-only">{m.isMine ? 'You' : m.userName}: </span>
          {m.text}
        </p>
        <span className="px-1 text-micro text-fg-muted">
          {m.failed ? <span className="text-danger">Not sent</span> : m.pending ? 'Sending…' : formatRelativeTime(m.createdAt)}
        </span>
      </div>
    </li>
  );
}

/**
 * Shared community chat + AI assistant panel. The launcher lives in the header
 * (never a floating button that fights the mobile tab bar). Readable by
 * everyone; posting requires sign-in. Fits 320px screens.
 */
export function ChatWidget() {
  const user = useAuthStore((s) => s.user);
  const chatOpen = useChatStore((s) => s.chatOpen);
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const activeRoom = useChatStore((s) => s.activeRoom);
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const messages = useChatStore((s) => s.messagesByRoom[s.activeRoom]);
  const loadingRoom = useChatStore((s) => s.loadingRoom);
  const loadError = useChatStore((s) => s.loadError);

  const [aiSelected, setAiSelected] = useState(false);
  const tab: ActiveTab = aiSelected ? AI_TAB : activeRoom;
  const [text, setText] = useState('');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([AI_WELCOME]);
  const [aiLoading, setAiLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isAi = tab === AI_TAB;
  useRoomPolling(isAi ? null : (tab as RoomId), chatOpen);

  const roomMessages = messages ?? [];

  // Keep the newest message in view.
  useEffect(() => {
    if (!chatOpen) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOpen, roomMessages.length, aiMessages.length, tab]);

  // Focus management: into the panel on open, back to the launcher on close; Esc closes.
  useEffect(() => {
    if (!chatOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() =>
      (inputRef.current ?? panelRef.current?.querySelector<HTMLElement>('button'))?.focus(),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelRef.current?.contains(document.activeElement)) setChatOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [chatOpen, setChatOpen]);

  if (!chatOpen) return null;

  const onTab = (id: ActiveTab) => {
    setAiSelected(id === AI_TAB);
    if (id !== AI_TAB) setActiveRoom(id as RoomId);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || !user) return;
    setText('');

    if (!isAi) {
      await sendMessage(msg, { userName: user.name, initials: user.initials });
      return;
    }

    const userMsg: AiMessage = { id: `u_${Date.now()}`, role: 'user', content: msg };
    const history = [...aiMessages, userMsg];
    setAiMessages(history);
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      setAiMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.' },
      ]);
    } catch {
      setAiMessages((prev) => [...prev, { id: `a_err_${Date.now()}`, role: 'assistant', content: 'Could not reach the assistant. Try again.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const retryFailed = (m: ChatMessage) => {
    if (!user) return;
    useChatStore.setState((s) => ({
      messagesByRoom: { ...s.messagesByRoom, [activeRoom]: (s.messagesByRoom[activeRoom] ?? []).filter((x) => x.id !== m.id) },
    }));
    void sendMessage(m.text, { userName: user.name, initials: user.initials });
  };

  const tabs = [
    ...CHAT_ROOMS.map((r) => ({ id: r.id as ActiveTab, label: `# ${r.label}` })),
    { id: AI_TAB as ActiveTab, label: 'AI assistant' },
  ];
  const failed = roomMessages.filter((m) => m.failed);

  return (
    <div
      ref={panelRef}
      id="chat-panel"
      role="dialog"
      aria-modal="false"
      aria-label={isAi ? 'mkmovies AI assistant' : 'Community chat'}
      className={cn(
        'fixed z-[150] flex flex-col overflow-hidden rounded-panel border border-line bg-surface-1 shadow-pop animate-rise-in',
        // phones: fill the space between header and tab bar, 8px inset (fits 320px)
        'inset-x-2 top-[calc(var(--header-h)+8px)] bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+8px)]',
        // tablet/desktop: docked bottom-right
        'md:inset-auto md:bottom-6 md:right-6 md:h-[min(600px,calc(100dvh-var(--header-h)-48px))] md:w-[400px]',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {isAi ? (
            <Sparkles aria-hidden className="size-4 text-accent" />
          ) : (
            <span aria-hidden className="size-2 rounded-full bg-success" />
          )}
          <h2 className="truncate text-caption font-semibold text-fg">{isAi ? 'AI assistant' : 'Community chat'}</h2>
        </div>
        <IconButton label="Close chat" icon={<X />} size="sm" onClick={() => setChatOpen(false)} className="-mr-2" />
      </div>

      <Tabs<ActiveTab>
        label="Chat rooms"
        items={tabs}
        value={tab}
        onValueChange={onTab}
        panels={false}
        className="px-2 [&_[role=tab]]:h-10 [&_[role=tab]]:px-3"
      />

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-live="polite" aria-relevant="additions">
        {isAi ? (
          <ul className="space-y-3">
            {aiMessages.map((m) => (
              <li key={m.id} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                {m.role === 'assistant' && (
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Bot className="size-4" />
                  </span>
                )}
                <p
                  className={cn(
                    'max-w-[80%] whitespace-pre-wrap rounded-[18px] px-3.5 py-2 text-caption leading-relaxed',
                    m.role === 'user' ? 'rounded-tr-md bg-accent text-on-accent' : 'rounded-tl-md border border-line bg-surface-2 text-fg',
                  )}
                >
                  {m.content}
                </p>
              </li>
            ))}
            {aiLoading && (
              <li className="flex items-center gap-2 pl-10 text-micro text-fg-muted">
                <Loader2 aria-hidden className="size-3.5 animate-spin" /> Thinking…
              </li>
            )}
          </ul>
        ) : loadingRoom === tab && !roomMessages.length ? (
          <div className="grid h-full place-items-center text-caption text-fg-muted">
            <span className="flex items-center gap-2">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Loading messages…
            </span>
          </div>
        ) : roomMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Hash aria-hidden className="size-7 text-fg-muted" />
            <p className="text-caption font-medium text-fg">{loadError ? 'Chat is unavailable' : 'No messages yet'}</p>
            <p className="text-micro text-fg-muted">{loadError ? 'We will keep trying.' : 'Start the conversation.'}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {roomMessages.map((m, i) => (
              <Bubble
                key={m.id}
                m={m}
                showName={i === 0 || roomMessages[i - 1].userName !== m.userName || roomMessages[i - 1].isMine !== m.isMine}
              />
            ))}
          </ul>
        )}
      </div>

      {!isAi && failed.length > 0 && user && (
        <div className="flex items-center justify-between gap-2 border-t border-line bg-danger/5 px-4 py-2 text-micro text-danger">
          <span>{failed.length === 1 ? '1 message' : `${failed.length} messages`} not sent</span>
          <button
            type="button"
            onClick={() => failed.forEach(retryFailed)}
            className="inline-flex h-8 items-center gap-1 rounded-chip px-2 font-medium hover:bg-danger/10"
          >
            <RotateCcw aria-hidden className="size-3.5" /> Retry
          </button>
        </div>
      )}

      {user ? (
        <form onSubmit={onSubmit} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="chat-input" className="sr-only">
            {isAi ? 'Ask the assistant' : `Message #${tab}`}
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isAi ? 'Ask about any movie or show…' : 'Write a message…'}
            maxLength={500}
            disabled={aiLoading}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-control border border-line bg-surface-2 px-3.5 text-caption text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <IconButton
            type="submit"
            label="Send message"
            variant="primary"
            icon={aiLoading ? <Loader2 className="animate-spin" /> : <Send />}
            disabled={!text.trim() || aiLoading}
          />
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t border-line p-3">
          <p className="text-micro text-fg-muted">{isAi ? 'Sign in to ask the assistant.' : 'Read-only. Sign in to chat.'}</p>
          <Button size="sm" onClick={() => openAuth('login')}>
            Sign in to chat
          </Button>
        </div>
      )}
    </div>
  );
}
