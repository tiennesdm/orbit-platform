'use client';

import { Home, Search, Plus, Film, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { clsx } from 'clsx';

export function FloatingNav() {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <div className="fixed bottom-3 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <nav className="floating-nav pointer-events-auto">
        <Link href="/home" className={clsx('nav-pill', isActive('/home') && 'active')} title="Home">
          <Home size={22} strokeWidth={2} fill={isActive('/home') ? 'currentColor' : 'none'} />
        </Link>
        <Link href="/discover" className={clsx('nav-pill', isActive('/discover') && 'active')} title="Discover">
          <Search size={22} strokeWidth={2} />
        </Link>
        <Link href="/compose" className="nav-compose" title="Create">
          <Plus size={22} strokeWidth={2.5} />
        </Link>
        <Link href="/reels" className={clsx('nav-pill', isActive('/reels') && 'active')} title="Reels">
          <Film size={22} strokeWidth={2} />
        </Link>
        <Link href="/profile" className={clsx('nav-pill p-0', isActive('/profile') && 'p-0')} title="Profile">
          <div className={clsx(
            'w-9 h-9 rounded-full avatar-9 flex items-center justify-center text-white font-bold text-sm border-2',
            isActive('/profile') ? 'border-accent' : 'border-text-primary'
          )}>
            {user?.displayName?.[0]?.toUpperCase() || 'O'}
          </div>
        </Link>
      </nav>
    </div>
  );
}
