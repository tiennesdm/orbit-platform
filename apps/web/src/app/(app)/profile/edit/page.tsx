'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Check, Loader2, Globe, Twitter, Github, Linkedin, Link as LinkIcon, Palette, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const THEME_COLORS = [
  { name: 'Indigo', value: '#4338CA' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Green', value: '#059669' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Cyan', value: '#0891B2' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Slate', value: '#475569' },
  { name: 'Black', value: '#0F0F12' },
];

const BANNER_PRESETS = [
  'linear-gradient(135deg, #4338CA 0%, #7C3AED 50%, #EC4899 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)',
  'linear-gradient(135deg, #059669 0%, #0D9488 50%, #06B6D4 100%)',
  'linear-gradient(135deg, #0F0F12 0%, #4338CA 50%, #7C3AED 100%)',
  'linear-gradient(135deg, #DC2626 0%, #F59E0B 100%)',
  'linear-gradient(180deg, #0D9488 0%, #064E3B 100%)',
  'linear-gradient(135deg, #FBBF24 0%, #F472B6 50%, #818CF8 100%)',
  'linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #93C5FD 100%)',
];

export default function ProfileEditPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const fetchMe = useAuth((s) => s.fetchMe);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [themeColor, setThemeColor] = useState('#4338CA');
  const [bannerUrl, setBannerUrl] = useState(BANNER_PRESETS[0]);
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(user.displayName || '');
    setBio((user as any).bio || '');
    setThemeColor((user as any).themeColor || '#4338CA');
    setWebsite((user as any).linkWebsite || '');
    setTwitter((user as any).linkTwitter || '');
    setGithub((user as any).linkGithub || '');
    setLinkedin((user as any).linkLinkedin || '');
    setCustomLabel((user as any).linkCustomLabel || '');
    setCustomUrl((user as any).linkCustomUrl || '');
    setBannerUrl((user as any).coverCid || BANNER_PRESETS[0]);
  }, [user, hasHydrated, router]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await api.identity.updateMe({
        displayName,
        bio,
        themeColor,
        linkWebsite: website || undefined,
        linkTwitter: twitter || undefined,
        linkGithub: github || undefined,
        linkLinkedin: linkedin || undefined,
        linkCustomLabel: customLabel || undefined,
        linkCustomUrl: customUrl || undefined,
        coverCid: bannerUrl.startsWith('linear-gradient') ? undefined : bannerUrl,
      });
      await fetchMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!hasHydrated || !user) {
    return <div className="min-h-screen bg-bg-elevated" />;
  }

  return (
    <div className="min-h-screen bg-bg-elevated pb-32">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 className="font-display font-extrabold text-xl tracking-tight">Edit profile</h1>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-full bg-text-primary text-white text-sm font-bold hover:bg-neutral-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saving ? 'Saving' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Live preview */}
        <div className="bg-bg-card border border-hairline rounded-2xl overflow-hidden">
          <div className="h-32" style={{ background: bannerUrl }} />
          <div className="px-4 pb-4 -mt-12">
            <div
              className="w-20 h-20 rounded-full border-4 border-bg-card flex items-center justify-center text-white font-extrabold text-2xl shadow-md"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
            >
              {displayName[0]?.toUpperCase() || '?'}
            </div>
            <div className="mt-3">
              <h2 className="font-display font-extrabold text-lg">{displayName || 'Your name'}</h2>
              <p className="text-sm text-text-tertiary">@{user.handle}</p>
              {bio && <p className="mt-2 text-sm text-text-secondary leading-relaxed">{bio}</p>}
            </div>
          </div>
        </div>

        {/* Banner */}
        <Section title="Banner" icon={<Camera size={16} />}>
          <div className="grid grid-cols-4 gap-2">
            {BANNER_PRESETS.map((bg, i) => (
              <button
                key={i}
                onClick={() => setBannerUrl(bg)}
                className={`aspect-[3/1] rounded-lg border-2 transition-all ${
                  bannerUrl === bg ? 'border-accent scale-95' : 'border-transparent hover:scale-95'
                }`}
                style={{ background: bg }}
              />
            ))}
          </div>
        </Section>

        {/* Avatar color / theme color */}
        <Section title="Theme color" icon={<Palette size={16} />}>
          <div className="grid grid-cols-6 gap-2">
            {THEME_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setThemeColor(c.value)}
                className={`aspect-square rounded-full border-2 transition-all ${
                  themeColor === c.value ? 'border-text-primary scale-95' : 'border-transparent'
                }`}
                style={{ background: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </Section>

        {/* Basic info */}
        <Section title="Basic info" icon={<Sparkles size={16} />}>
          <Field label="Display name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="w-full bg-bg-card border border-hairlineStrong rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors"
            />
          </Field>
          <Field label="Bio" hint={`${bio.length} / 500`}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself…"
              maxLength={500}
              rows={3}
              className="w-full bg-bg-card border border-hairlineStrong rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
          </Field>
        </Section>

        {/* Links */}
        <Section title="Links" icon={<LinkIcon size={16} />}>
          <Field label="Website">
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" className={inputCls} />
          </Field>
          <Field label="Twitter / X">
            <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@yourhandle" className={inputCls} />
          </Field>
          <Field label="GitHub">
            <input type="text" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="@yourhandle" className={inputCls} />
          </Field>
          <Field label="LinkedIn">
            <input type="text" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="/in/yourname" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Custom label">
              <input type="text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Blog" className={inputCls} />
            </Field>
            <Field label="Custom URL">
              <input type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Premium badge */}
        <Section title="Premium" icon={<Sparkles size={16} />}>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-pink-50 border border-amber-200">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center text-white">
              <Sparkles size={20} fill="white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">ORBIT Pro</div>
              <div className="text-xs text-text-secondary">Verified badge, analytics, custom themes</div>
            </div>
            <button className="px-4 py-1.5 rounded-full bg-text-primary text-white text-xs font-semibold">
              Upgrade
            </button>
          </div>
        </Section>
      </main>
    </div>
  );
}

const inputCls = 'w-full bg-bg-card border border-hairlineStrong rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-bg-card border border-hairline rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-text-secondary">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-text-secondary">{label}</label>
        {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
