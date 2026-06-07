'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, HandHeart, Scale, ArrowLeftRight, CreditCard, Layers, Target, ScrollText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Home' },
  { href: '/income',     icon: Briefcase,        label: 'Income' },
  { href: '/sadaka',     icon: HandHeart,         label: 'Sadaka' },
  { href: '/ledger',     icon: ArrowLeftRight,    label: 'Ledger' },
  { href: '/goals',      icon: Target,            label: 'Goals' },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t pb-safe"
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-around px-2 pt-2">
        {NAV.map(({ href, icon: Icon, label }) => {
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
