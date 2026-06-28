'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Briefcase, HandHeart, ArrowLeftRight, Landmark, Target, Settings, Hourglass, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Tab = { href: string; icon: typeof LayoutDashboard; label: string; key: string | null }

// Two rooms. Each owns its own nav so Life never competes with Finance for slots.
// Add a future Life module = one line in ROOMS.life.tabs.
const ROOMS = {
  finance: {
    label: 'Finance',
    icon: Wallet,
    home: { href: '/dashboard', icon: LayoutDashboard, label: 'Home', key: null } as Tab,
    tabs: [
      { href: '/income', icon: Briefcase,     label: 'Income', key: 'income' },
      { href: '/sadaka', icon: HandHeart,      label: 'Sadaka', key: 'sadaka' },
      { href: '/ledger', icon: ArrowLeftRight, label: 'Ledger', key: 'ledger' },
      { href: '/joint',  icon: Landmark,       label: 'Joint',  key: 'joint_account' },
      { href: '/goals',  icon: Target,         label: 'Goals',  key: 'goals' },
    ] as Tab[],
  },
  life: {
    label: 'Life',
    icon: Hourglass,
    home: { href: '/life', icon: Hourglass, label: 'Life', key: null } as Tab,
    tabs: [] as Tab[], // future life modules go here
  },
} as const

const ROOM_KEYS = ['finance', 'life'] as const
type RoomKey = (typeof ROOM_KEYS)[number]

const SETTINGS: Tab = { href: '/settings', icon: Settings, label: 'Settings', key: null }

// Which room a path belongs to (Settings is shared — stays in current room visually).
function lifeHrefs() {
  return [ROOMS.life.home.href, ...ROOMS.life.tabs.map(t => t.href)]
}

export default function BottomNav() {
  const path = usePathname()
  const router = useRouter()
  const [modules, setModules] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('enabled_modules').eq('id', user.id).single()
        .then(({ data }) => setModules((data as any)?.enabled_modules ?? {}))
    })
  }, [])

  const activeRoom: RoomKey = lifeHrefs().some(h => path === h || path.startsWith(h + '/'))
    ? 'life' : 'finance'
  const room = ROOMS[activeRoom]

  // Home (first) + up to 3 enabled module tabs + Settings (last) = max 5.
  const moduleTabs = room.tabs.filter(t => t.key === null || modules?.[t.key] !== false).slice(0, 3)
  const navItems: Tab[] = [room.home, ...moduleTabs, SETTINGS]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 border-t border-l border-r pb-safe"
         style={{
           background: 'rgba(17,15,10,0.88)',
           backdropFilter: 'blur(16px)',
           WebkitBackdropFilter: 'blur(16px)',
           borderColor: 'var(--border)',
         }}>
      {/* Room switcher — floats above the bar */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-12">
        <div className="flex gap-1 p-1 rounded-full"
             style={{
               background: 'rgba(17,15,10,0.95)',
               backdropFilter: 'blur(16px)',
               WebkitBackdropFilter: 'blur(16px)',
               border: '1px solid var(--border)',
               boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
             }}>
          {ROOM_KEYS.map(r => {
            const active = activeRoom === r
            const Icon = ROOMS[r].icon
            return (
              <button key={r} onClick={() => router.push(ROOMS[r].home.href)}
                className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all',
                  !active && 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]')}
                style={active ? { background: 'var(--gold)', color: 'var(--background)' } : undefined}>
                <Icon size={14} strokeWidth={active ? 2.5 : 1.5} />
                {ROOMS[r].label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-around px-2 pt-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={cn('relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
                active ? 'text-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}>
              <span aria-hidden
                className="absolute -top-[3px] text-[7px] leading-none transition-opacity"
                style={{ color: 'var(--gold)', opacity: active ? 1 : 0 }}>✦</span>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
