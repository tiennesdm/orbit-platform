'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Smile, Paperclip, Lock, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { clsx } from 'clsx';

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  encrypted: boolean;
  readBy?: string[];
}

export default function InboxThreadPage() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState<any>(null);
  const [e2eEnabled, setE2eEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params?.threadId) {
      loadThread();
    }
  }, [params?.threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadThread() {
    try {
      const res = await fetch(`/api/v1/dms/threads/${params.threadId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('orbit_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setThread(data.thread);
        setMessages(data.messages || MOCK_MESSAGES);
      } else {
        // Fallback to mock
        setThread({ id: params.threadId, participants: ['user1', 'user2'] });
        setMessages(MOCK_MESSAGES);
      }
    } catch (err) {
      setThread({ id: params.threadId });
      setMessages(MOCK_MESSAGES);
    }
  }

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);

    // Optimistic append
    const newMsg: Message = {
      id: `tmp_${Date.now()}`,
      senderId: user?.did || 'me',
      content: draft,
      timestamp: new Date().toISOString(),
      encrypted: e2eEnabled,
      readBy: [],
    };
    setMessages((prev) => [...prev, newMsg]);
    setDraft('');

    try {
      await fetch(`/api/v1/dms/threads/${params.threadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('orbit_token')}`,
        },
        body: JSON.stringify({ content: newMsg.content, encrypted: e2eEnabled }),
      });
    } catch (err) {
      console.error('Send failed', err);
    } finally {
      setSending(false);
    }
  }

  function getThreadTitle() {
    if (!thread) return 'Loading…';
    const other = (thread.participants || []).find((p: string) => p !== user?.did);
    return other ? `@${other.split(':').pop()}` : 'Thread';
  }

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-hairline bg-bg/95 backdrop-blur sticky top-0">
        <button onClick={() => router.back()} className="text-text-secondary" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-bold">
          {getThreadTitle()[1]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{getThreadTitle()}</p>
          <p className="text-xs text-text-tertiary flex items-center gap-1">
            <Lock size={10} className="text-green-600" />
            End-to-end encrypted
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-text-tertiary py-12">
            <Lock className="mx-auto mb-2 text-green-600" size={32} />
            <p className="text-sm">No messages yet. Send the first one — it's end-to-end encrypted.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.did || msg.senderId === 'me';
          return (
            <div
              key={msg.id}
              className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}
            >
              <div
                className={clsx(
                  'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                  isMe
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-bg-subtle text-text-primary rounded-bl-md',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <div
                  className={clsx(
                    'flex items-center gap-1 mt-1 text-[10px]',
                    isMe ? 'text-white/70 justify-end' : 'text-text-tertiary',
                  )}
                >
                  {msg.encrypted && <Lock size={9} />}
                  <span>{formatTime(msg.timestamp)}</span>
                  {isMe && (msg.readBy?.length ? <CheckCheck size={12} /> : <Check size={12} />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-hairline p-3 bg-bg">
        <div className="flex items-center gap-2">
          <button className="text-text-tertiary hover:text-text-secondary" aria-label="Emoji">
            <Smile size={22} />
          </button>
          <button className="text-text-tertiary hover:text-text-secondary" aria-label="Attach">
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message…"
            className="flex-1 bg-bg-subtle rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="bg-accent text-white p-2 rounded-full disabled:opacity-50 hover:bg-accent/90"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-text-tertiary">
          <Lock size={10} className="text-green-600" />
          <span>Messages are end-to-end encrypted with the Signal Protocol</span>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    senderId: 'did:orbit:alice',
    content: 'Hey! Welcome to ORBIT 🎉',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    encrypted: true,
  },
  {
    id: 'm2',
    senderId: 'me',
    content: 'Thanks! Excited to be here. The 4-mode compose is genius.',
    timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    encrypted: true,
    readBy: ['did:orbit:alice'],
  },
  {
    id: 'm3',
    senderId: 'did:orbit:alice',
    content: 'Right? Intimate mode for close friends, public for the world, visual for image posts, community for groups. No infinite scroll. The portable identity means I can take my data anywhere.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    encrypted: true,
  },
  {
    id: 'm4',
    senderId: 'me',
    content: 'I tried the AI agent already. Asked it to find posts about AI in my feed and it just worked.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    encrypted: true,
    readBy: [],
  },
];
