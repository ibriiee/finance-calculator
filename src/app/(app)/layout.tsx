import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/shared/BottomNav'
import TestBanner from '@/components/shared/TestBanner'
import BackToTop from '@/components/shared/BackToTop'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen relative">
      {/* Desktop-only branding flanking the centered app */}
      <DesktopSides />

      {/* Centered phone-width app column; desktop backdrop comes from body gradient */}
      <div className="mx-auto w-full max-w-md min-h-screen relative z-10"
        style={{
          background: 'var(--background)',
          boxShadow: '0 0 0 1px var(--border), 0 0 80px rgba(0,0,0,0.7)',
        }}>
        <TestBanner />
        <main className="pb-24">
          {children}
        </main>
        <BackToTop />
        <BottomNav />
      </div>
    </div>
  )
}

function ScaleLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <path d="M18 4V32M18 4L4 10M18 4L32 10" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4" cy="18" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201,168,76,0.08)" />
      <circle cx="32" cy="18" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201,168,76,0.08)" />
      <path d="M14 32 H22" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function DesktopSides() {
  const features = ['Earnings', 'Sadaka', 'Zakat', 'Joint Account', 'Brother Ledger', 'Goals']
  return (
    <div className="hidden md:flex fixed inset-0 z-0 pointer-events-none items-center justify-between">
      {/* Left: brand */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <div className="animate-drift" style={{ filter: 'drop-shadow(0 0 40px rgba(201,168,76,0.25))' }}>
          <ScaleLogo size={88} />
        </div>
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold text-gold-gradient">Mizan</h1>
          <p className="text-2xl mt-1" style={{ color: 'rgba(201,168,76,0.7)' }}>ميزان</p>
          <p className="text-sm mt-3 max-w-[220px]" style={{ color: 'var(--text-muted)' }}>
            Balance in wealth, charity, and trust — your private Islamic financial OS.
          </p>
        </div>
      </div>

      {/* Right: feature words + verse */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="flex flex-col items-center gap-2.5">
          {features.map((f, i) => (
            <span key={f} className="text-sm tracking-wide"
              style={{ color: `rgba(201,168,76,${0.25 + (i % 3) * 0.12})` }}>{f}</span>
          ))}
        </div>
        <p className="text-xs italic text-center max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
          “And establish weight in justice and do not make deficient the balance.”
          <br /><span className="not-italic">— Ar-Rahman 55:9</span>
        </p>
      </div>
    </div>
  )
}
