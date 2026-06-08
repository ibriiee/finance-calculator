import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/shared/BottomNav'
import TestBanner from '@/components/shared/TestBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen">
      {/* Centered phone-width app column; desktop backdrop comes from body gradient */}
      <div className="mx-auto w-full max-w-md min-h-screen relative"
        style={{
          background: 'var(--background)',
          boxShadow: '0 0 0 1px var(--border), 0 0 60px rgba(0,0,0,0.6)',
        }}>
        <TestBanner />
        <main className="pb-24">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
