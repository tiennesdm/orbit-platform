'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Check, Key, Sparkles, ShieldCheck, Loader2, Sun, Moon, X, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

const STARS = [
  { top: '10%', left: '15%', size: 2, delay: '0.5s' },
  { top: '25%', left: '78%', size: 1, delay: '1.5s' },
  { top: '70%', left: '10%', size: 1, delay: '2.8s' },
  { top: '50%', left: '85%', size: 2, delay: '1.0s' },
  { top: '85%', left: '45%', size: 1, delay: '3.5s' },
  { top: '15%', left: '50%', size: 1, delay: '2.0s' },
];

const PERSONAS = [
  { emoji: '🎨', label: 'Creator', desc: 'Share your work' },
  { emoji: '👥', label: 'Community', desc: 'Build a group' },
  { emoji: '🏢', label: 'Business', desc: 'Reach customers' },
  { emoji: '🌍', label: 'Just me', desc: 'Private by default' },
];

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const { theme, toggleTheme } = useTheme();

  const [step, setStep] = useState(1);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [persona, setPersona] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.push('/home');
  }, [isAuthenticated, router]);

  function toggleInterest(i: string) {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  async function handleSignup() {
    setLoading(true);
    setError(null);
    try {
      await signup({ displayName, handle: handle || undefined });
      router.push('/home');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  const INTEREST_OPTIONS = ['AI', 'Web3', 'Climate', 'Indie Hackers', 'Design', 'Music', 'Photography', 'Gaming', 'Cooking', 'Travel', 'Fitness', 'Books', 'Art', 'Tech'];

  return (
    <div className="min-h-screen bg-bg-elevated flex">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-bg-card border border-hairline flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Left form */}
      <div className="flex-1 flex flex-col px-6 sm:px-12 py-8 max-w-xl mx-auto w-full order-2 lg:order-1">
        <Link href="/" className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-extrabold shadow-md">
            O
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">ORBIT</span>
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-primary transition-colors mb-8">
            <ArrowLeft size={14} /> Already have an account?
          </Link>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-8">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`flex-1 h-[3px] rounded-full transition-colors ${step >= n ? 'bg-accent' : 'bg-hairline'}`}
              />
            ))}
          </div>

          {/* Step 1: Handle */}
          {step === 1 && (
            <div>
              <div className="text-7xl mb-6">🔑</div>
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">
                Your handle is yours.<br />Forever.
              </h2>
              <p className="text-text-secondary mb-8 leading-relaxed">
                Pick a handle or use your own domain. We'll generate cryptographic keys so your identity, followers, and history move with you — even if ORBIT shuts down.
              </p>

              <div className="mb-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Handle or domain</label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="@yourname.com or @yourname"
                  autoFocus
                  className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3.5 px-4 text-[15px] font-mono outline-none focus:border-accent transition-colors"
                />
                {handle && !handle.startsWith('@') && (
                  <p className="text-xs text-text-tertiary mt-1.5">
                    Your identity: <span className="font-mono">did:orbit:{handle.slice(0, 6)}…{handle.slice(-4)}</span>
                  </p>
                )}
                {handle && handle.length < 3 && (
                  <p className="text-xs text-warning mt-1.5">Handle should be at least 3 characters</p>
                )}
              </div>

              <div className="bg-success/10 border border-success/20 rounded-md p-3 flex items-center gap-2 text-sm text-success mt-4">
                <Check size={16} /> Cryptographic keys generated · Portable
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={handle.length < 3}
                className="w-full mt-8 py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Step 2: Display name */}
          {step === 2 && (
            <div>
              <div className="text-7xl mb-6">👋</div>
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">
                What should we call you?
              </h2>
              <p className="text-text-secondary mb-8 leading-relaxed">
                This is your display name — what people see on your profile and posts. You can change it anytime.
              </p>

              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3.5 px-4 text-[15px] outline-none focus:border-accent transition-colors"
              />

              <button
                onClick={() => setStep(3)}
                disabled={!displayName.trim()}
                className="w-full mt-8 py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={18} />
              </button>
              <button onClick={() => setStep(1)} className="w-full text-text-secondary text-sm font-semibold py-3 mt-2">
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Persona */}
          {step === 3 && (
            <div>
              <div className="text-7xl mb-6">🎯</div>
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">
                What brings you here?
              </h2>
              <p className="text-text-secondary mb-8 leading-relaxed">
                We'll tune your feed and AI suggestions. You can change this anytime.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {PERSONAS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setPersona(p.label)}
                    className={`p-5 rounded-xl border-2 transition-all text-left ${
                      persona === p.label
                        ? 'border-accent bg-accent/5'
                        : 'border-hairline hover:border-hairlineStrong'
                    }`}
                  >
                    <div className="text-3xl mb-2">{p.emoji}</div>
                    <div className="font-bold text-text-primary text-sm">{p.label}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(4)}
                disabled={!persona}
                className="w-full mt-8 py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={18} />
              </button>
              <button onClick={() => setStep(2)} className="w-full text-text-secondary text-sm font-semibold py-3 mt-2">
                ← Back
              </button>
            </div>
          )}

          {/* Step 4: Interests */}
          {step === 4 && (
            <div>
              <div className="text-7xl mb-6">✨</div>
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">
                Pick 3+ interests
              </h2>
              <p className="text-text-secondary mb-8 leading-relaxed">
                We'll suggest people and groups to follow. Skip this if you want a clean slate.
              </p>

              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((i) => {
                  const active = interests.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleInterest(i)}
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-1.5 ${
                        active
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-card border-hairline text-text-secondary hover:border-accent'
                      }`}
                    >
                      {active ? <X size={12} /> : <Plus size={12} />}
                      {i}
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSignup}
                disabled={loading || interests.length < 1}
                className="w-full mt-8 py-4 bg-gradient-to-r from-accent to-ai text-white border-0 rounded-md text-[15px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Create my orbit <ArrowRight size={18} /></>}
              </button>
              <button onClick={() => setStep(3)} className="w-full text-text-secondary text-sm font-semibold py-3 mt-2">
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right visual side */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-ai via-accent to-pink-400 items-center justify-center order-1 lg:order-2">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
              boxShadow: `0 0 ${s.size * 4}px white`,
            }}
          />
        ))}

        <div className="relative z-10 text-center px-12">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-300 via-pink-400 to-purple-500 shadow-2xl flex items-center justify-center text-6xl">
            🪐
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 font-display tracking-tight">
            {step === 1 && 'Your identity.'}
            {step === 2 && 'Your name.'}
            {step === 3 && 'Your style.'}
            {step === 4 && 'Almost there!'}
          </h1>
          <p className="text-lg text-white/85 max-w-md mx-auto leading-relaxed">
            {step === 1 && 'Portable, encrypted, yours. Take it anywhere.'}
            {step === 2 && 'You can change it anytime. No pressure.'}
            {step === 3 && 'Personalize your feed and AI.'}
            {step === 4 && '3+ interests help us suggest the right people to follow.'}
          </p>

          {/* Live preview */}
          <div className="mt-12 max-w-sm mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-pink-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                {displayName ? displayName[0].toUpperCase() : '?'}
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-bold">{displayName || 'Your name'}</div>
                <div className="text-white/70 text-sm font-mono">@{handle || 'yourname'}</div>
              </div>
            </div>
            {persona && (
              <div className="mt-4 flex items-center gap-2 text-white/90 text-sm">
                <span>{PERSONAS.find((p) => p.label === persona)?.emoji}</span>
                <span>{persona}</span>
              </div>
            )}
            {interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {interests.map((i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white">
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-8 left-8 right-8 flex items-center gap-2 text-white/70 text-xs">
          <ShieldCheck size={14} />
          <span>End-to-end encrypted. Open source. No tracking.</span>
        </div>
      </div>
    </div>
  );
}
