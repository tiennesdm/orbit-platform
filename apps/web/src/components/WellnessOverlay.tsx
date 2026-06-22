'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, X, Shield, Coffee } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export function WellnessOverlay() {
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [settings, setSettings] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [sessionSec, setSessionSec] = useState(0);

  useEffect(() => {
    if (hasHydrated && !user) return;
    if (!user) return;
    (api as any).getWellness().then(setSettings).catch(() => {});
    (api as any).getWellnessUsage().then(setUsage).catch(() => {});
  }, [user, hasHydrated]);

  // Tick every minute
  useEffect(() => {
    if (!user || !settings?.showTimer) return;
    const interval = setInterval(() => {
      setSessionSec((s) => s + 60);
      (api as any).tickWellness(60).then((res: any) => {
        if (res.exceeded === 'daily') setWarning(`You've hit your daily limit of ${res.limitToday} min. Time for a break?`);
        else if (res.exceeded === 'weekly') setWarning(`You've hit your weekly limit of ${res.limitWeek} min.`);
        else if (res.exceeded === 'hard') setWarning('Daily hard cap reached (parental controls). Logging out…');
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [user, settings?.showTimer]);

  if (!user || !settings) return null;
  if (!settings.showTimer && !warning) return null;

  return (
    <>
      {/* Floating session timer */}
      {settings.showTimer && sessionSec > 60 && (
        <div className="fixed bottom-20 right-4 z-20 bg-bg-card/95 backdrop-blur-md border border-hairline rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5 text-xs font-mono">
          <Clock size={12} className="text-ai" />
          <span className="font-semibold">{Math.floor(sessionSec / 60)}:{(sessionSec % 60).toString().padStart(2, '0')}</span>
        </div>
      )}

      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setWarning(null)}>
          <div className="bg-bg-card rounded-2xl max-w-md w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
              <Coffee size={28} className="text-warning" />
            </div>
            <h2 className="text-xl font-bold mb-2">Time for a break?</h2>
            <p className="text-text-secondary text-sm mb-5">{warning}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setWarning(null)}
                className="flex-1 py-2.5 border border-hairline rounded-md text-sm font-semibold"
              >
                Keep browsing
              </button>
              <button
                onClick={() => {
                  alert('Take a break! See you in a bit.');
                  setWarning(null);
                }}
                className="flex-1 py-2.5 bg-text-primary text-white rounded-md text-sm font-semibold"
              >
                Take a break
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
