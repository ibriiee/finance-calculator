'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ModuleHeader from '@/components/shared/ModuleHeader'
import {
  Briefcase, Receipt, HandHeart, Users, ArrowLeftRight, Landmark, Scale,
  Target, CreditCard, PiggyBank, ScrollText, BarChart3, Hourglass, Settings,
} from 'lucide-react'

// Every screen in the app, two taps from Home. key = enabled_modules toggle (null = always on).
const MODULES = [
  { href: '/income',     icon: Briefcase,      label: 'Income',     desc: 'Projects & payments',        key: 'income' },
  { href: '/expenses',   icon: Receipt,        label: 'Expenses',   desc: 'Living costs & splits',      key: 'expenses' },
  { href: '/sadaka',     icon: HandHeart,      label: 'Sadaka',     desc: 'Obligations & giving',       key: 'sadaka' },
  { href: '/recipients', icon: Users,          label: 'Recipients', desc: 'Who received what',          key: 'sadaka' },
  { href: '/ledger',     icon: ArrowLeftRight, label: 'Ledger',     desc: 'IOUs between brothers',      key: 'ledger' },
  { href: '/joint',      icon: Landmark,       label: 'Joint',      desc: 'Shared house account',       key: 'joint_account' },
  { href: '/loans',      icon: CreditCard,     label: 'Loans',      desc: 'Qard Hasan tracking',        key: 'loans' },
  { href: '/savings',    icon: PiggyBank,      label: 'Savings',    desc: 'Backup money stashes',       key: 'savings' },
  { href: '/goals',      icon: Target,         label: 'Goals',      desc: 'Targets & contributions',    key: 'goals' },
  { href: '/zakat',      icon: Scale,          label: 'Zakat',      desc: 'Nisab, hawl & snapshots',    key: 'zakat' },
  { href: '/wasiyya',    icon: ScrollText,     label: 'Wasiyya',    desc: 'Digital will vault',         key: 'wasiyya' },
  { href: '/analytics',  icon: BarChart3,      label: 'Analytics',  desc: 'Trends & insights',          key: null },
  { href: '/life',       icon: Hourglass,      label: 'Life',       desc: 'Memento mori tracker',       key: 'life' },
  { href: '/settings',   icon: Settings,       label: 'Settings',   desc: 'Preferences & backup',       key: null },
]

export default function ModulesPage() {
  const [modules, setModules] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('enabled_modules').eq('id', user.id).single()
        .then(({ data }) => setModules((data as any)?.enabled_modules ?? {}))
    })
  }, [])
  const visible = MODULES.filter(m => m.key === null || modules[m.key] !== false)

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="All Modules" subtitle="Everything, two taps from Home" />
      <div className="grid grid-cols-2 gap-3">
        {visible.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href + label} href={href} className="card p-4 flex flex-col gap-1.5">
            <Icon size={18} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
