'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Hand, Settings, Volume2, VolumeX, X, Loader2, Sparkles, Headphones } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const MOCK_ROOMS = [
  { id: 'r1', title: 'AI builders hangout', host: '@aidev', listeners: 234, speakers: 8, mode: 'public', emoji: '🤖', tags: ['AI', 'tech'] },
  { id: 'r2', title: 'Mental health + startups', host: '@mindful', listeners: 67, speakers: 5, mode: 'public', emoji: '🧠', tags: ['wellness'] },
  { id: 'r3', title: 'Hindi music listening party', host: '@gaana', listeners: 412, speakers: 12, mode: 'public', emoji: '🎵', tags: ['music', 'hindi'] },
  { id: 'r4', title: 'Photography critique', host: '@lens', listeners: 89, speakers: 6, mode: 'public', emoji: '📸', tags: ['photography'] },
  { id: 'r5', title: 'Open mic comedy', host: '@lol', listeners: 156, speakers: 10, mode: 'public', emoji: '🎤', tags: ['comedy'] },
];

export default function VoicePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [activeRoom, setActiveRoom] = useState<typeof MOCK_ROOMS[0] | null>(null);
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [showCreate, setShowCreate] = useState(false);
  const [muted, setMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);

  useEffect(() => {
    if (hasHydrated && !user) router.push('/login');
  }, [user, hasHydrated, router]);

  useEffect(() => {
    if (activeRoom) {
      // Mock peers
      setPeers([
        { did: 'host-1', handle: activeRoom.host, role: 'host', muted: false },
        ...Array.from({ length: activeRoom.speakers - 1 }, (_, i) => ({
          did: `spk-${i}`, handle: `@speak${i + 1}`, role: 'speaker', muted: i % 2 === 0,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          did: `lst-${i}`, handle: `@listen${i + 1}`, role: 'listener', muted: true,
        })),
      ]);
    }
  }, [activeRoom]);

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  if (activeRoom) {
    return <VoiceRoomView room={activeRoom} peers={peers} muted={muted} setMuted={setMuted} handRaised={handRaised} setHandRaised={setHandRaised} onLeave={() => setActiveRoom(null)} />;
  }

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <X size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-xl tracking-tight flex items-center gap-2">
              <Headphones size={18} className="text-ai" /> Voice rooms
            </h1>
            <p className="text-xs text-text-tertiary">Live audio conversations · {rooms.length} live now</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-accent to-ai text-white text-sm font-semibold flex items-center gap-1">
            <Mic size={12} /> Start
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {/* Live now section */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">Live now</h2>
        </div>

        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRoom(r)}
            className="w-full bg-bg-card border border-hairline rounded-2xl p-4 hover:border-hairlineStrong transition-colors text-left flex items-start gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-ai flex items-center justify-center text-2xl flex-shrink-0">
              {r.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold truncate">{r.title}</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider">LIVE</span>
              </div>
              <p className="text-xs text-text-tertiary mb-2">{r.host} · {r.tags.map(t => `#${t}`).join(' ')}</p>
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {r.listeners + r.speakers}
                </span>
                <span className="flex items-center gap-1">
                  <Mic size={12} /> {r.speakers} speaking
                </span>
                <span className="flex items-center gap-1">
                  <Headphones size={12} /> {r.listeners} listening
                </span>
              </div>
            </div>
          </button>
        ))}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-bg-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                <Mic size={20} className="text-accent" /> Start a voice room
              </h2>
              <p className="text-sm text-text-secondary mb-4">Live audio chat, like Twitter Spaces. Up to 50 speakers.</p>
              <input
                type="text"
                placeholder="What's your room about?"
                className="w-full bg-bg-subtle border border-hairline rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors mb-3"
              />
              <textarea
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-bg-subtle border border-hairline rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors mb-3 resize-none"
              />
              <div className="flex gap-2 mb-4">
                {['public', 'intimate', 'close_friends'].map((v) => (
                  <button
                    key={v}
                    className="flex-1 py-2 rounded-md border border-hairline text-xs font-semibold hover:border-accent transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-hairline rounded-md text-sm font-semibold">Cancel</button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setActiveRoom({ id: 'new', title: 'Your new room', host: `@${user.handle}`, listeners: 0, speakers: 1, mode: 'public', emoji: '🎙️', tags: [] });
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-accent to-ai text-white rounded-md text-sm font-semibold"
                >
                  Start now
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function VoiceRoomView({ room, peers, muted, setMuted, handRaised, setHandRaised, onLeave }: any) {
  const speakers = peers.filter((p: any) => p.role === 'speaker' || p.role === 'host');
  const listeners = peers.filter((p: any) => p.role === 'listener');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">Live</span>
          <span className="text-white/80 text-sm font-mono">{room.listeners + room.speakers} listeners</span>
        </div>
        <button onClick={onLeave} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
          <X size={18} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-white">
        <div className="text-6xl mb-3">{room.emoji}</div>
        <h1 className="text-2xl font-extrabold font-display text-center mb-1">{room.title}</h1>
        <p className="text-white/60 text-sm mb-8">Hosted by {room.host}</p>

        {/* Speakers grid */}
        <div className="grid grid-cols-3 gap-4 max-w-md w-full mb-8">
          {speakers.slice(0, 9).map((spk: any, i: number) => (
            <div key={spk.did} className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full border-4 ${spk.role === 'host' ? 'border-amber-400' : 'border-white/30'} bg-gradient-to-br from-accent to-ai flex items-center justify-center text-xl font-extrabold relative`}>
                {spk.handle[1]?.toUpperCase() || '?'}
                {spk.muted && <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><MicOff size={10} /></span>}
              </div>
              <p className="text-xs mt-1.5 truncate max-w-full">{spk.handle}</p>
              {spk.role === 'host' && <span className="text-[10px] text-amber-400">Host</span>}
            </div>
          ))}
        </div>

        {/* Hand raised indicator */}
        {handRaised && (
          <div className="px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-sm font-semibold flex items-center gap-1.5 mb-3">
            ✋ Hand raised — waiting for host
          </div>
        )}

        {/* Listeners count */}
        <p className="text-white/60 text-xs">
          <Headphones size={12} className="inline" /> {listeners.length}+ listening
        </p>
      </main>

      {/* Bottom controls */}
      <footer className="bg-black/40 backdrop-blur-md border-t border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setMuted(!muted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-white text-black' : 'bg-white/20 text-white'}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={() => setHandRaised(!handRaised)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${handRaised ? 'bg-amber-400 text-black' : 'bg-white/20 text-white'}`}
            title="Raise hand"
          >
            <Hand size={20} />
          </button>
          <button
            onClick={onLeave}
            className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center"
            title="Leave quietly"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
