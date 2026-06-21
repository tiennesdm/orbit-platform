'use client';

import { useState } from 'react';
import { Sparkles, X, Send } from 'lucide-react';

export function AiAgentFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([
    { role: 'agent', content: 'Hi! I\'m your AI. Ask me to filter your feed, summarize DMs, draft posts, or block spammers.' }
  ]);
  const [input, setInput] = useState('');

  async function send() {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((m) => [...m, { role: 'user', content: userMsg }]);
    setInput('');

    try {
      const res = await fetch('/api/proxy/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('orbit_token')}` },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'agent', content: data.message?.content || 'No response' }]);
    } catch {
      setMessages((m) => [...m, { role: 'agent', content: 'Sorry, I couldn\'t connect. Check your connection.' }]);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full z-40 flex items-center justify-center text-white shadow-lg border-[3px] border-bg-elevated hover:scale-105 transition-transform"
        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)', boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)' }}
        aria-label="Open AI agent"
      >
        <Sparkles size={24} fill="white" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-bg-card flex flex-col">
          <div className="px-4 py-3.5 border-b border-hairline flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white shadow-md">
                <Sparkles size={20} fill="currentColor" />
              </div>
              <div>
                <div className="text-sm font-extrabold letter-tight">Your AI · Orbit</div>
                <div className="text-2xs text-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-success rounded-full" /> On-device · Ready
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-bg-subtle flex items-center justify-center text-text-secondary">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[86%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed ${m.role === 'user' ? 'self-end bg-accent text-white rounded-br-md' : 'self-start bg-bg-subtle rounded-bl-md'}`}>
                {m.content}
              </div>
            ))}
          </div>

          <div className="p-3.5 border-t border-hairline flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask your AI anything..."
              className="flex-1 bg-bg-subtle border border-hairline rounded-full py-2.5 px-4 text-sm outline-none focus:border-ai focus:bg-bg-card"
            />
            <button onClick={send} className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white">
              <Send size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
