'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Clock, Eye, EyeOff, Heart, Users, Repeat, Bell, Lock, Moon, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function WellnessPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (hasHydrated && !user) { router.push('/login'); return; }
    if (!user) return;
    (api as any).getWellness().then(setSettings).catch(() => {});
    (api as any).getWellnessUsage().then(setUsage).catch(() => {});
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user || !settings) return <div className="min-h-screen bg-bg-elevated" />;

  function update(key: string, val: any) {
    setSettings({ ...settings, [key]: val });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await (api as any).updateWellness(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-xl tracking-tight flex items-center gap-2">
              <Shield size={18} className="text-ai" /> Digital wellness
            </h1>
            <p className="text-xs text-text-tertiary">Anti-addiction controls · EU DSA compliant</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 rounded-full bg-text-primary text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
            {saving ? 'Saving' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Today's usage */}
        {usage && (
          <section className="bg-gradient-to-br from-ai-soft to-accent-soft border border-ai/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-ai" />
              <h2 className="font-bold">Today</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-3xl font-extrabold">{Math.round(usage.usedTodaySeconds / 60)}<span className="text-sm font-medium text-text-tertiary"> min</span></div>
                <div className="text-xs text-text-tertiary">used today</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold">{Math.round(usage.usedWeekSeconds / 60)}<span className="text-sm font-medium text-text-tertiary"> min</span></div>
                <div className="text-xs text-text-tertiary">this week</div>
              </div>
            </div>
            {/* Weekly chart */}
            <div className="mt-4 flex items-end gap-1 h-12">
              {(usage.daily || []).map((d: any) => {
                const mins = d.seconds / 60;
                const height = Math.min(100, (mins / 120) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-ai rounded-t transition-all"
                      style={{ height: `${height}%` }}
                      title={`${d.day}: ${Math.round(mins)} min`}
                    />
                    <div className="text-[9px] text-text-tertiary">{d.day.slice(8, 10)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Time limits */}
        <Section icon={<Clock size={16} />} title="Time limits">
          <Field label="Daily limit (minutes)" hint="0 = no limit">
            <input
              type="number"
              min={0}
              max={1440}
              value={settings.dailyMinutesLimit || 0}
              onChange={(e) => update('dailyMinutesLimit', parseInt(e.target.value, 10) || 0)}
              className={inputCls}
            />
          </Field>
          <Field label="Weekly limit (minutes)" hint="0 = no limit">
            <input
              type="number"
              min={0}
              max={10080}
              value={settings.weeklyMinutesLimit || 0}
              onChange={(e) => update('weeklyMinutesLimit', parseInt(e.target.value, 10) || 0)}
              className={inputCls}
            />
          </Field>
          <Field label="Reminder interval (minutes)">
            <input
              type="number"
              min={5}
              max={180}
              value={settings.reminderIntervalMin || 30}
              onChange={(e) => update('reminderIntervalMin', parseInt(e.target.value, 10) || 30)}
              className={inputCls}
            />
          </Field>
        </Section>

        {/* Quiet hours */}
        <Section icon={<Moon size={16} />} title="Quiet hours">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start (HH:MM)">
              <input
                type="time"
                value={settings.quietHoursStart || '22:00'}
                onChange={(e) => update('quietHoursStart', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="End (HH:MM)">
              <input
                type="time"
                value={settings.quietHoursEnd || '08:00'}
                onChange={(e) => update('quietHoursEnd', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-xs text-text-tertiary">No notifications during quiet hours. App still usable.</p>
        </Section>

        {/* Privacy toggles */}
        <Section icon={<EyeOff size={16} />} title="Hide counts">
          <Toggle
            label="Hide likes count (your posts)"
            icon={<Heart size={14} />}
            value={settings.hideLikesCount}
            onChange={(v: any) => update('hideLikesCount', v)}
          />
          <Toggle
            label="Hide reposts count"
            icon={<Repeat size={14} />}
            value={settings.hideRepostsCount}
            onChange={(v: any) => update('hideRepostsCount', v)}
          />
          <Toggle
            label="Hide followers count"
            icon={<Users size={14} />}
            value={settings.hideFollowersCount}
            onChange={(v: any) => update('hideFollowersCount', v)}
          />
        </Section>

        {/* UX controls */}
        <Section icon={<Eye size={16} />} title="Browsing">
          <Toggle
            label="Slow mode (one post at a time)"
            value={settings.slowMode}
            onChange={(v: any) => update('slowMode', v)}
          />
          <Toggle
            label="No infinite scroll"
            value={settings.noInfinitescroll}
            onChange={(v: any) => update('noInfinitescroll', v)}
          />
          <Toggle
            label="Show session timer"
            value={settings.showTimer}
            onChange={(v: any) => update('showTimer', v)}
          />
        </Section>
      </main>
    </div>
  );
}

const inputCls = 'w-full bg-bg-card border border-hairlineStrong rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors';

function Section({ icon, title, children }: any) {
  return (
    <section className="bg-bg-card border border-hairline rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 text-text-secondary">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: any) {
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

function Toggle({ label, value, onChange, icon }: any) {
  return (
    <label className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg cursor-pointer">
      <span className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition relative ${value ? 'bg-accent' : 'bg-bg-elevated border border-hairline'}`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${value ? 'left-5' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}
