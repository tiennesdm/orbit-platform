'use client';

import { Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export function TopHeader() {
  const user = useAuth((s) => s.user);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/home" className="flex items-center gap-2 font-display font-extrabold text-xl letter-tight">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-extrabold text-sm shadow-md">
            O
          </div>
          <span>Orbit</span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            className="w-9 h-9 rounded-full bg-gradient-to-br from-ai-soft to-accent-soft flex items-center justify-center text-ai relative"
            title="Ask AI"
            onClick={() => (window.location.href = '/ai')}
          >
            <Sparkles size={18} fill="currentColor" />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-success rounded-full border-2 border-bg-elevated" />
          </button>
          <Link
            href="/inbox"
            className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors"
            title="Inbox"
          >
            <MessageCircle size={18} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </header>
  );
}
