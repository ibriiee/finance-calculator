import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/shared/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Desktop: centered app shell with subtle border */}
      <div className="mx-auto w-full max-w-md min-h-screen relative"
        style={{ boxShadow: '0 0 0 1px var(--border)' }}>
        <main className="pb-24">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
