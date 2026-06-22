'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, ArrowLeft, Bot, User, Loader2, Settings as SettingsIcon, Zap, BookOpen, ShieldCheck, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type Message = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  at: number;
  toolCalls?: { name: string; result?: string }[];
};

const SUGGESTED = [
  { icon: Zap, label: 'Show my unread DMs', prompt: 'Show me unread DMs' },
  { icon: BookOpen, label: 'Summarize my feed today', prompt: 'Summarize my feed today' },
  { icon: Calendar, label: 'Suggest 3 people to follow', prompt: 'Suggest 3 people to follow based on my interests' },
  { icon: ShieldCheck, label: 'Block recent spammers', prompt: 'Block recent spammers' },
];

export default function AiChatPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm0',
      role: 'agent',
      content: `Hi ${user?.displayName?.split(' ')[0] || 'there'}! I'm your ORBIT AI. I can help you filter spam, summarize DMs, draft posts, suggest follows, and more. What can I do for you?`,
      at: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  if (hasHydrated && !user) {
    router.push('/login');
    return null;
  }
  if (!hasHydrated) return null;

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content, at: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setSending(true);
    try {
      const res = await api.ai.chat(content);
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: 'agent',
          content: res.message?.content || res.reply || 'I did that for you.',
          at: Date.now(),
          toolCalls: res.toolCalls,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: 'agent',
          content: 'Sorry, I couldn\'t connect. Try again in a moment.',
          at: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-elevated flex flex-col">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white shadow-md">
            <Sparkles size={18} fill="white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-lg tracking-tight">ORBIT AI</h1>
            <p className="text-xs text-text-tertiary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> Online · respects your autonomy
            </p>
          </div>
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors"
            title="AI settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto px-4 py-6 space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sending && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white flex-shrink-0">
              <Bot size={18} />
            </div>
            <div className="bg-bg-card border border-hairline rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ai animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-ai animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-ai animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Suggested prompts (only on first message) */}
        {messages.length === 1 && (
          <div className="pt-4">
            <p className="text-xs text-text-tertiary font-semibold uppercase tracking-wider mb-3 px-1">Try asking</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.prompt}
                    onClick={() => send(s.prompt)}
                    className="text-left p-4 bg-bg-card border border-hairline rounded-xl hover:border-accent hover:shadow-sm transition-all group"
                  >
                    <Icon size={20} className="text-ai mb-2 group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold">{s.label}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">{s.prompt}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-bg-elevated/90 backdrop-blur-md border-t border-hairline">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 bg-bg-card border border-hairlineStrong rounded-2xl p-2 focus-within:border-accent transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask your AI anything…"
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none resize-none px-2 py-2 text-[15px] placeholder:text-text-tertiary max-h-32"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-ai to-accent text-white flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform flex-shrink-0"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-text-tertiary text-center mt-2">
            ORBIT AI works for you · Privacy-first · <button className="underline hover:text-text-secondary">Set autonomy</button>
          </p>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {isUser ? (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white flex-shrink-0">
          <User size={18} />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white flex-shrink-0">
          <Bot size={18} />
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-gradient-to-br from-ai to-accent text-white rounded-tr-md'
              : 'bg-bg-card border border-hairline text-text-primary rounded-tl-md'
          }`}
        >
          {message.content}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                <Zap size={10} />
                <span className="font-mono">{tc.name}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-text-tertiary mt-1 px-1">
          {new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
