'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';

export default function InboxPage() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    try {
      const data = await api.dms.listThreads();
      setThreads(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="ai-card mx-3 mt-2 mb-2">
        <div className="w-9 h-9 rounded-md bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white shadow-md flex-shrink-0">
          <Sparkles size={18} fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0 text-[13px]">
          <strong>2 need reply</strong> · 4 groups · 11 spammers blocked · AI organized
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-secondary">Loading inbox...</div>
      )}

      {!loading && threads.length === 0 && (
        <div className="text-center py-12 px-6">
          <div className="text-5xl mb-3">💬</div>
          <h3 className="font-bold text-lg mb-2">No messages yet</h3>
          <p className="text-sm text-text-secondary">Your encrypted conversations will appear here.</p>
        </div>
      )}

      <div>
        {threads.map((thread: any, i: number) => (
          <div key={i} className="flex gap-2.5 px-4 py-2.5 items-center cursor-pointer hover:bg-bg-elevated">
            <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm', `avatar-${(i % 9) + 1}`)}>
              {thread.name?.[0]?.toUpperCase() || 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <div className="text-[13.5px] font-bold">{thread.name || 'Conversation'}</div>
                <div className="text-2xs text-text-tertiary font-semibold">
                  {new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="text-[12.5px] mt-0.5 flex items-center gap-1.5">
                <span className="mode-pill intimate text-2xs">Intimate</span>
                <span className="truncate text-text-primary">End-to-end encrypted</span>
              </div>
            </div>
            {thread.unreadCounts && Object.keys(thread.unreadCounts).length > 0 && (
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
