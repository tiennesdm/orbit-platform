import { FloatingNav } from '@/components/nav/FloatingNav';
import { TopHeader } from '@/components/nav/TopHeader';
import { AiAgentFab } from '@/components/ai-agent/AiAgentFab';
import { SearchPalette } from '@/components/SearchPalette';
import { WellnessOverlay } from '@/components/WellnessOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-elevated">
      <TopHeader />
      <main className="pb-24">{children}</main>
      <FloatingNav />
      <AiAgentFab />
      <SearchPalette />
      <WellnessOverlay />
    </div>
  );
}
