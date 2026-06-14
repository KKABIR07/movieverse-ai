'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Hash, Bot, Loader2, Sparkles } from 'lucide-react';
import { useChatStore, CHAT_ROOMS, type RoomId } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { DancingAnimeIcon } from './DancingAnimeIcon';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AI_ROOM = { id: 'ai', label: 'AI', emoji: '🤖' } as const;
type ActiveRoom = RoomId | 'ai';

const ALL_ROOMS = [...CHAT_ROOMS, AI_ROOM] as const;

export function ChatWidget() {
  const { user } = useAuthStore();
  const {
    messages, chatOpen, toggleChat, setChatOpen,
    activeRoom, setActiveRoom, sendMessage,
    getRoomMessages, unreadCount,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<ActiveRoom>('general');
  const [text, setText] = useState('');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    {
      id: 'ai-welcome',
      role: 'assistant',
      content: "Hi! I'm your mkmovies AI assistant. Ask me for movie recommendations, plot explanations, director info, or anything film-related! 🎬",
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (chatOpen) scrollBottom();
  }, [messages, aiMessages, chatOpen, scrollBottom]);

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [chatOpen]);

  // Sync community tab to Zustand activeRoom
  useEffect(() => {
    if (activeTab !== 'ai') setActiveRoom(activeTab as RoomId);
  }, [activeTab, setActiveRoom]);

  // BroadcastChannel: receive messages from other tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let bc: BroadcastChannel;
    try {
      bc = new BroadcastChannel('mkmovies-chat');
      bc.onmessage = (e) => {
        useChatStore.setState((s) => ({
          messages: [...s.messages.slice(-499), e.data],
          unreadCount: s.chatOpen ? 0 : s.unreadCount + 1,
        }));
      };
    } catch { /* not supported */ }
    return () => { try { bc?.close(); } catch { /* ignore */ } };
  }, []);

  if (!user) return null;

  const roomMessages = activeTab !== 'ai' ? getRoomMessages(activeTab as RoomId) : [];

  const persistToDB = async (text: string, roomId: RoomId) => {
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, text }),
      });
    } catch { /* fire-and-forget */ }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');

    if (activeTab === 'ai') {
      const userMsg: AiMessage = { id: `u_${Date.now()}`, role: 'user', content: msg };
      setAiMessages((prev) => [...prev, userMsg]);
      setAiLoading(true);

      try {
        const res = await fetch('/api/ai/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...aiMessages, userMsg].map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = await res.json();
        setAiMessages((prev) => [
          ...prev,
          { id: `a_${Date.now()}`, role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.' },
        ]);
      } catch {
        setAiMessages((prev) => [
          ...prev,
          { id: `a_err_${Date.now()}`, role: 'assistant', content: 'Could not reach AI. Please try again.' },
        ]);
      } finally {
        setAiLoading(false);
      }
    } else {
      sendMessage(msg, user.id, user.name, user.initials);
      persistToDB(msg, activeTab as RoomId);
    }
  };

  return (
    <>
      {chatOpen && (
        <div className="fixed bottom-[76px] right-5 z-[150] w-80 sm:w-96 h-[540px] glass border border-[var(--border)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden origin-bottom-right animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center gap-2">
              {activeTab === 'ai' ? (
                <Sparkles size={14} className="text-violet-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {activeTab === 'ai' ? 'mkmovies AI' : 'Community Chat'}
              </span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Room tabs */}
          <div
            className="flex gap-1 px-3 py-2 border-b border-[var(--border)] overflow-x-auto flex-shrink-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {ALL_ROOMS.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveTab(room.id as ActiveRoom)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === room.id
                    ? room.id === 'ai'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                      : 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span>{room.emoji}</span>
                <span>{room.label}</span>
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {activeTab === 'ai' ? (
              <>
                {aiMessages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={m.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot size={14} className="text-white" />
                        </div>
                      )}
                      <div className={`max-w-[80%] flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-[var(--accent-primary)] text-white rounded-tr-sm'
                              : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] rounded-tl-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {aiLoading && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                      <Bot size={14} className="text-white" />
                    </div>
                    <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-[var(--bg-card)] border border-[var(--border)] flex items-center gap-1.5">
                      <Loader2 size={14} className="animate-spin text-violet-400" />
                      <span className="text-xs text-[var(--text-muted)]">Thinking...</span>
                    </div>
                  </div>
                )}
              </>
            ) : roomMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-muted)] gap-3">
                <Hash size={28} className="opacity-30" />
                <div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs mt-1">Start the conversation!</p>
                </div>
              </div>
            ) : (
              roomMessages.map((msg, i) => {
                const isMe = msg.userId === user.id;
                const showAvatar = i === 0 || roomMessages[i - 1].userId !== msg.userId;
                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {showAvatar && !isMe && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: msg.color }}
                      >
                        {msg.userInitials}
                      </div>
                    )}
                    {!showAvatar && !isMe && <div className="w-7 flex-shrink-0" />}
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      {showAvatar && (
                        <span
                          className={`text-xs font-medium px-1 ${isMe ? 'text-right text-[var(--text-muted)]' : ''}`}
                          style={isMe ? {} : { color: msg.color }}
                        >
                          {isMe ? 'You' : msg.userName}
                        </span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-[var(--accent-primary)] text-white rounded-tr-sm'
                            : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] rounded-tl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] px-1">
                        {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex gap-2 px-3 py-3 border-t border-[var(--border)] flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeTab === 'ai' ? 'Ask about any movie or show...' : 'Type a message...'}
              maxLength={500}
              disabled={aiLoading}
              className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!text.trim() || aiLoading}
              className="p-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
            >
              {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}

      {/* FAB — bottom-right corner anchor */}
      <div className="fixed bottom-5 right-5 z-[150] flex flex-col items-end gap-2">
        <button
          onClick={toggleChat}
          aria-label="Toggle chat"
          className={`relative flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
            chatOpen
              ? 'bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)]'
              : 'bg-[var(--bg-primary)] border-2 border-[var(--accent-primary)] hover:border-violet-400 shadow-[0_0_0_4px_rgba(124,58,237,0.18),0_8px_32px_rgba(124,58,237,0.45)]'
          }`}
          style={{ width: 60, height: 60 }}
        >
          {chatOpen ? (
            <X size={22} className="text-[var(--text-primary)]" />
          ) : (
            <DancingAnimeIcon size={48} />
          )}
          {!chatOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
