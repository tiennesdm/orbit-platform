'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, ArrowRight, ShieldCheck, Sparkles, Loader2, ChevronLeft, Fingerprint, Sun, Moon, Users, Hash, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';

const STARS = [
  { top: '8%', left: '12%', size: 2, delay: '0s' },
  { top: '20%', left: '85%', size: 1, delay: '1.2s' },
  { top: '65%', left: '20%', size: 1, delay: '2.5s' },
  { top: '45%', left: '78%', size: 2, delay: '0.7s' },
  { top: '80%', left: '55%', size: 1, delay: '3.2s' },
  { top: '12%', left: '45%', size: 1, delay: '1.8s' },
  { top: '55%', left: '5%', size: 2, delay: '4.1s' },
  { top: '32%', left: '95%', size: 1, delay: '2.0s' },
];

const ORBITS = [
  { size: 480, rotate: '0s' },
  { size: 720, rotate: '120s' },
  { size: 960, rotate: '240s' },
];

export default function LoginPage() {
  const router = useRouter();
  const signin = useAuth((s) => s.signin);
  const verifyLogin = useAuth((s) => s.verifyLogin);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const { theme, toggleTheme } = useTheme();

  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    setPasskeySupported(typeof window !== 'undefined' && 'PublicKeyCredential' in window);
  }, []);

  useEffect(() => {
    if (isAuthenticated) router.push('/home');
  }, [isAuthenticated, router]);

  async function loginWithHandle() {
    if (!handle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { challengeId, options } = await signin(handle.trim());
      // For demo: auto-fill credential with a mock response
      // Real passkey would use navigator.credentials.get(options)
      const credential = options ? { id: 'mock', rawId: 'mock', type: 'public-key', response: { clientDataJSON: 'mock' } } : null;
      await verifyLogin(challengeId, credential);
      router.push('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your handle.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPasskey() {
    setLoading(true);
    setError(null);
    try {
      // Real passkey flow — discoverable credential (resident key)
      if (!passkeySupported) {
        setError('Passkeys not supported in this browser. Use handle login.');
        return;
      }
      // For demo: try with handle first
      if (handle.trim()) {
        const { challengeId, options } = await signin(handle.trim());
        const credential = await (navigator as any).credentials.get({
          publicKey: options.publicKey,
        });
        await verifyLogin(challengeId, credential);
      } else {
        setError('Enter your handle to find your passkey');
        return;
      }
      router.push('/home');
    } catch (err: any) {
      setError(err.message || 'Passkey login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-elevated flex">
      {/* Theme toggle (top-right) */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-bg-card border border-hairline flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Left visual side */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-accent via-ai to-accent items-center justify-center">
        {/* Animated stars */}
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

        {/* Orbital rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {ORBITS.map((o, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/20"
              style={{
                width: o.size,
                height: o.size,
                animation: `orbit ${o.rotate} linear infinite`,
              }}
            >
              <div
                className="absolute w-3 h-3 rounded-full bg-white"
                style={{ top: -6, left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 12px white' }}
              />
            </div>
          ))}
        </div>

        {/* Central planet */}
        <div className="relative z-10 text-center px-12">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-300 via-pink-400 to-purple-500 shadow-2xl flex items-center justify-center text-6xl">
            🪐
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 font-display tracking-tight">
            Welcome back
          </h1>
          <p className="text-lg text-white/85 max-w-md mx-auto leading-relaxed">
            Your orbit, your rules. Continue where you left off — with your community, your AI, your identity intact.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-12">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-white">2.4M</div>
              <div className="text-xs text-white/70 mt-1">people on ORBIT</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-extrabold text-white">0</div>
              <div className="text-xs text-white/70 mt-1">ads, ever</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-extrabold text-white">100%</div>
              <div className="text-xs text-white/70 mt-1">portable</div>
            </div>
          </div>
        </div>

        {/* Bottom badge */}
        <div className="absolute bottom-8 left-8 right-8 flex items-center gap-2 text-white/70 text-xs">
          <ShieldCheck size={14} />
          <span>End-to-end encrypted. Open source. No tracking.</span>
        </div>
      </div>

      {/* Right form side */}
      <div className="flex-1 flex flex-col px-6 sm:px-12 py-8 max-w-xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-extrabold shadow-md">
            O
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">ORBIT</span>
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-primary transition-colors mb-8"
          >
            <ChevronLeft size={14} />
            Back
          </Link>

          <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">
            Log in to ORBIT
          </h2>
          <p className="text-text-secondary mb-10">
            Use your handle, your passkey, or your domain.
          </p>

          {/* Passkey button (prominent) */}
          {passkeySupported && (
            <button
              onClick={loginWithPasskey}
              disabled={loading}
              className="w-full mb-3 py-3.5 px-4 bg-gradient-to-r from-accent to-ai text-white border-0 rounded-md text-[15px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-lg shadow-accent/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={20} />}
              Continue with Passkey
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-hairline" />
            <span className="text-xs text-text-tertiary font-medium">or use your handle</span>
            <div className="flex-1 h-px bg-hairline" />
          </div>

          {/* Handle input */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Handle or domain</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loginWithHandle()}
              placeholder="@yourname or yourname.com"
              autoFocus
              className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3 px-4 text-[15px] font-mono outline-none focus:border-accent transition-colors"
            />
          </div>

          <button
            onClick={loginWithHandle}
            disabled={!handle.trim() || loading}
            className="w-full py-3.5 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">
              {error}
            </div>
          )}

          {/* Forgot handle link */}
          <Link href="/forgot" className="text-text-tertiary text-sm mt-4 hover:text-text-secondary transition-colors text-center block">
            Forgot your handle?
          </Link>

          {/* Sign up CTA */}
          <div className="mt-12 pt-6 border-t border-hairline text-center">
            <p className="text-text-secondary text-sm mb-3">New to ORBIT?</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-accent font-semibold text-sm hover:underline"
            >
              Create your orbit <ArrowRight size={14} />
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-8 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <Lock size={12} /> E2E encrypted
            </span>
            <span className="flex items-center gap-1">
              <Sparkles size={12} /> AI by you
            </span>
            <span className="flex items-center gap-1">
              <Hash size={12} /> Open source
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
