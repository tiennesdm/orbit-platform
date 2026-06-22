'use client';

import { Sparkles, MessageCircle, Search, Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export function TopHeader() {
  const user = useAuth((s) => s.user);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Listen for ⌘K from anywhere
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Trigger via custom event — palette listens
        window.dispatchEvent(new CustomEvent('orbit:open-palette'));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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

        {/* Search button with ⌘K hint */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('orbit:open-palette'))}
          className="hidden sm:flex flex-1 mx-4 max-w-xs items-center gap-2 bg-bg-subtle hover:bg-bg-cream rounded-full px-3 py-1.5 text-text-tertiary text-sm transition-colors"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-mono bg-bg-card border border-hairline px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        <div className="flex items-center gap-1">
          <Link
            href="/ai"
            className="w-9 h-9 rounded-full bg-gradient-to-br from-ai-soft to-accent-soft flex items-center justify-center text-ai relative"
            title="Ask AI"
          >
            <Sparkles size={18} fill="currentColor" />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-success rounded-full border-2 border-bg-elevated" />
          </Link>
          <Link
            href="/notifications"
            className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors"
            title="Notifications"
          >
            <Bell size={18} strokeWidth={2} />
          </Link>
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
