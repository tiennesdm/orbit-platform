'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { Edit, Share2, UserPlus, Download } from 'lucide-react';

export default function ProfilePage() {
  const user = useAuth((s) => s.user);
  const fetchMe = useAuth((s) => s.fetchMe);
  const [stats, setStats] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (user) {
      setBio((user as any).bio || '');
      setName(user.displayName);
    }
  }, [user]);

  async function saveProfile() {
    await api.identity.updateMe({ bio, displayName: name });
    await fetchMe();
    setEditing(false);
  }

  async function exportData() {
    try {
      const data = await api.identity.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbit-export-${user?.handle || 'data'}.json`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Cover photo */}
      <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #EC4899 40%, #F97316 100%)' }}>
        <div className="absolute top-3 right-3 bg-black/50 text-white text-2xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-md">
          📷 Add cover
        </div>
      </div>

      {/* Profile info */}
      <div className="px-4 pb-3 text-center relative -mt-12">
        <div className="inline-block mb-2">
          <div className="p-[3px] rounded-full" style={{ background: 'conic-gradient(from 0deg, #F472B6, #FB923C, #FBBF24, #F472B6)' }}>
            <div className="bg-bg-elevated p-0.5 rounded-full">
              <div className="w-[86px] h-[86px] rounded-full avatar-9 flex items-center justify-center text-white font-bold text-[30px] border-4 border-bg-elevated shadow-md">
                {user.displayName?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-center font-extrabold text-xl letter-tight bg-transparent border-b border-hairline outline-none focus:border-accent py-1"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself..."
              rows={2}
              maxLength={500}
              className="w-full text-center text-sm bg-transparent border border-hairline rounded-md outline-none focus:border-accent p-2"
            />
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={saveProfile} className="btn btn-primary">Save</button>
              <button onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1.5 pt-3">
              <span className="text-xl font-extrabold letter-tight font-display">{user.displayName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#4338CA"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/></svg>
            </div>
            <div className="text-xs text-text-secondary font-mono">@{user.handle}</div>
            <div className="portable-badge mt-2">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              Owned by you · Portable
            </div>
          </>
        )}
      </div>

      {/* Bio (non-edit mode) */}
      {!editing && (
        <div className="px-4 py-3 text-[13.5px] leading-relaxed text-center">
          {(user as any).bio || <span className="text-text-tertiary">No bio yet</span>}
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-around py-3.5 border-b border-hairline">
        <div className="text-center cursor-pointer px-3 py-1 rounded-sm hover:bg-bg-subtle">
          <div className="text-lg font-extrabold letter-tight font-display">{stats?.posts || 0}</div>
          <div className="text-2xs text-text-secondary mt-0.5">Posts</div>
        </div>
        <div className="text-center cursor-pointer px-3 py-1 rounded-sm hover:bg-bg-subtle">
          <div className="text-lg font-extrabold letter-tight font-display">{stats?.followers || 0}</div>
          <div className="text-2xs text-text-secondary mt-0.5">Followers</div>
        </div>
        <div className="text-center cursor-pointer px-3 py-1 rounded-sm hover:bg-bg-subtle">
          <div className="text-lg font-extrabold letter-tight font-display">{stats?.following || 0}</div>
          <div className="text-2xs text-text-secondary mt-0.5">Following</div>
        </div>
        <div className="text-center cursor-pointer px-3 py-1 rounded-sm hover:bg-bg-subtle">
          <div className="text-lg font-extrabold letter-tight font-display">{stats?.subscribers || 0}</div>
          <div className="text-2xs text-text-secondary mt-0.5">Subs</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 px-4 py-2.5">
        <button onClick={() => setEditing(!editing)} className="flex-1 py-2.5 rounded-sm text-[13px] font-bold border border-hairlineStrong bg-bg-card hover:bg-bg-subtle transition-colors flex items-center justify-center gap-2">
          <Edit size={14} /> {editing ? 'Cancel' : 'Edit profile'}
        </button>
        <button onClick={exportData} className="flex-1 py-2.5 rounded-sm text-[13px] font-bold border border-hairlineStrong bg-bg-card hover:bg-bg-subtle transition-colors flex items-center justify-center gap-2">
          <Download size={14} /> Export data
        </button>
        <button className="flex-0 py-2 px-3 rounded-sm text-[13px] font-bold border border-hairlineStrong bg-bg-card hover:bg-bg-subtle transition-colors">
          <Share2 size={14} />
        </button>
      </div>

      {/* Highlights */}
      <div className="flex gap-4 px-4 py-3 border-b border-hairline overflow-x-auto scrollbar-hidden">
        {[
          { emoji: '✨', label: 'New', color: 'hl-new' },
          { emoji: '🏔️', label: 'Travel', color: 'hl-travel' },
          { emoji: '🍜', label: 'Food', color: 'hl-food' },
          { emoji: '💪', label: 'Fitness', color: 'hl-fitness' },
          { emoji: '💻', label: 'Tech', color: 'hl-tech' },
          { emoji: '🌿', label: 'Nature', color: 'hl-nature' },
        ].map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer">
            <div className={clsx('w-16 h-16 rounded-full p-[2.5px]', h.color)}>
              <div className="w-full h-full rounded-full border-2 border-bg-elevated flex items-center justify-center text-[22px] shadow-sm">
                {h.emoji}
              </div>
            </div>
            <span className="text-2xs font-semibold">{h.label}</span>
          </div>
        ))}
      </div>

      {/* Pinned posts section */}
      <PinnedPostsStrip />

      {/* Tabs */}
      <div className="flex border-t border-hairline">
        {[
          { icon: 'grid', active: true },
          { icon: 'film' },
          { icon: 'user-tag' },
          { icon: 'bookmark' },
        ].map((tab, i) => (
          <button key={i} className={clsx('flex-1 py-3 flex justify-center border-t-2', tab.active ? 'text-text-primary border-text-primary' : 'text-text-tertiary border-transparent -mt-px')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {tab.icon === 'grid' && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>}
              {tab.icon === 'film' && <><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></>}
              {tab.icon === 'user-tag' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}
              {tab.icon === 'bookmark' && <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>}
            </svg>
          </button>
        ))}
      </div>

      {/* Photo grid placeholder */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {[
          'photo-mountain', 'photo-sunset', 'photo-coffee',
          'photo-tech', 'photo-nature', 'photo-food',
          'photo-portrait', 'photo-fashion', 'photo-mountain',
        ].map((p, i) => (
          <div key={i} className={clsx('aspect-square relative cursor-pointer', p)}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[36px]">{['🏔️','🌅','☕','💻','🌲','🍕','🤳','🕶️','🏕️'][i]}</div>
            {(i === 1 || i === 8) && (
              <svg className="absolute top-1.5 right-1.5 text-white" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PinnedPostsStrip() {
  const [pinned, setPinned] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Load pinned from localStorage
    try {
      const stored = localStorage.getItem('orbit-pinned-posts');
      if (stored) setPinned(JSON.parse(stored));
    } catch {}
  }, []);

  // Listen for changes from other pages
  useEffect(() => {
    const handler = (e: any) => {
      setPinned(e.detail || []);
    };
    window.addEventListener('orbit-pinned-update', handler);
    return () => window.removeEventListener('orbit-pinned-update', handler);
  }, []);

  if (pinned.length === 0) return null;

  return (
    <div className="border-t border-hairline bg-bg-subtle/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-subtle/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary">
            <path d="M12 2L9 9H2l6 4-3 9 7-5 7 5-3-9 6-4h-7z"/>
          </svg>
          <span className="text-sm font-bold">Pinned ({pinned.length})</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={clsx('transition-transform', open && 'rotate-180')}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {pinned.map((p, i) => (
            <div key={p.id || i} className="bg-bg-card border border-hairline rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1.5">
                <span className={`mode-pill ${p.mode}`}>{p.mode || 'public'}</span>
                <span>Pinned {new Date(p.pinnedAt || Date.now()).toLocaleDateString()}</span>
              </div>
              <p className="text-sm line-clamp-2">{p.content || p.contentText || 'Pinned post'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
