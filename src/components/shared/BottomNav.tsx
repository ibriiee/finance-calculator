'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Briefcase, HandHeart, Scale, ArrowLeftRight, CreditCard, Layers, Target, ScrollText, Settings, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Home',    key: null },
  { href: '/income',     icon: Briefcase,        label: 'Income', key: 'income' },
  { href: '/sadaka',     icon: HandHeart,         label: 'Sadaka', key: 'sadaka' },
  { href: '/ledger',     icon: ArrowLeftRight,    label: 'Ledger', key: 'ledger' },
  { href: '/joint',      icon: Landmark,          label: 'Joint',  key: 'joint_account' },
  { href: '/goals',      icon: Target,            label: 'Goals',  key: 'goals' },
  { href: '/settings',   icon: Settings,          label: 'Settings', key: null },
]

export default function BottomNav() {
  const path = usePathname()
  const [modules, setModules] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('enabled_modules').eq('id', user.id).single()
        .then(({ data }) => setModules((data as any)?.enabled_modules ?? {}))
    })
  }, [])

  // Home (first) + up to 3 enabled module tabs + Settings (last) = max 5.
  const home = NAV.find(n => n.href === '/dashboard')!
  const settings = NAV.find(n => n.href === '/settings')!
  const moduleTabs = NAV.filter(n => n.key !== null && modules?.[n.key] !== false).slice(0, 3)
  const navItems = [home, ...moduleTabs, settings]
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 border-t border-l border-r pb-safe"
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-around px-2 pt-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={cn('flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all',
                active ? 'text-[var(--gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
