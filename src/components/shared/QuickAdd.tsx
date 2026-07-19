'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, X, Receipt, Briefcase, HandHeart, Landmark, ArrowLeftRight } from 'lucide-react'

// Floating quick-add: one tap → the module opens with its form already up (?add=1).
const ACTIONS = [
  { href: '/expenses?add=1', icon: Receipt,        label: 'Expense' },
  { href: '/income?add=1',   icon: Briefcase,      label: 'Income' },
  { href: '/sadaka?add=1',   icon: HandHeart,      label: 'Sadaka' },
  { href: '/joint?add=1',    icon: Landmark,       label: 'Joint txn' },
  { href: '/ledger?add=1',   icon: ArrowLeftRight, label: 'IOU' },
]

export default function QuickAdd() {
  const [openMenu, setOpenMenu] = useState(false)
  return (
    <>
      {openMenu && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpenMenu(false)} />
      )}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2"
           style={{ maxWidth: '28rem' }}>
        {openMenu && ACTIONS.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} onClick={() => setOpenMenu(false)}
            className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-xs font-semibold animate-slide-up"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }}>
            <Icon size={14} style={{ color: 'var(--gold)' }} /> {label}
          </Link>
        ))}
        <button onClick={() => setOpenMenu(o => !o)} aria-label="Quick add"
          className="w-13 h-13 p-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--gold)', color: '#0a0a0a', boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }}>
          {openMenu ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>
    </>
  )
}
