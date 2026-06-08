'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { shortDate } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, FileText, Lock, Eye, EyeOff } from 'lucide-react'
import WasiyyaForm from '@/components/wasiyya/WasiyyaForm'
import type { WasiyyaEntry } from '@/types/database.types'

export default function WasiyyaPage() {
  const [entries, setEntries] = useState<WasiyyaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('wasiyya_entries').select('*')
      .eq('owner_id', user!.id).order('created_at', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleReveal(id: string) {
    setRevealed(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const categoryIcons: Record<string, string> = {
    asset: 'ðŸ¦', debt: 'ðŸ’¸', instruction: 'ðŸ“‹', password: 'ðŸ”‘', contact: 'ðŸ‘¤', message: 'ðŸ’Œ',
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="back Wasiyya" subtitle="Digital will vault Â· private"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {/* Notice */}
      <div className="card-inner p-3 flex items-start gap-2">
        <Lock size={14} style={{ color: 'var(--gold)' }} className="mt-0.5 shrink-0" />
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          This vault is encrypted and private. Only you can see your wasiyya entries. Designate a trusted person by sharing your login.
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={FileText} title="Your digital will is empty"
          description="Record assets, debts, passwords and instructions for those you leave behind" />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(entry => {
            const isRevealed = revealed.has(entry.id)
            return (
              <div key={entry.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 mr-3">
                    <span className="text-xl">{categoryIcons[entry.category] ?? 'ðŸ“„'}</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{entry.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)} Â· {shortDate(entry.created_at)}
                        {entry.is_sensitive && ' Â· ðŸ”’ Sensitive'}
                      </p>
                    </div>
                  </div>
                  {entry.is_sensitive && (
                    <button onClick={() => toggleReveal(entry.id)} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                      {isRevealed ? <EyeOff size={14} style={{ color: 'var(--text-muted)' }} /> : <Eye size={14} style={{ color: 'var(--gold)' }} />}
                    </button>
                  )}
                </div>

                {entry.description && (!entry.is_sensitive || isRevealed) && (
                  <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    {entry.description}
                  </div>
                )}

                {entry.is_sensitive && !isRevealed && (
                  <div className="mt-3 p-3 rounded-lg text-xs text-center" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    ðŸ”’ Tap eye icon to reveal sensitive content
                  </div>
                )}

                {entry.amount && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full"
                      style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                      {entry.currency} {entry.amount.toLocaleString()}
                    </span>
                  </div>
                )}

                {entry.beneficiary_name && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Beneficiary: <span style={{ color: 'var(--text-secondary)' }}>{entry.beneficiary_name}</span>
                    {entry.beneficiary_contact && ` Â· ${entry.beneficiary_contact}`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <WasiyyaForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}

