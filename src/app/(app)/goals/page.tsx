'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate, calcMonthsRemaining } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import { Plus, Target, TrendingUp } from 'lucide-react'
import GoalForm from '@/components/goals/GoalForm'
import type { FinancialGoal, GoalContribution } from '@/types/database.types'

interface GoalWithProgress extends FinancialGoal {
  saved: number; pct: number; contributions: GoalContribution[]
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [contributing, setContributing] = useState<string | null>(null)
  const [contribAmount, setContribAmount] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: g }, { data: c }, { data: profs }] = await Promise.all([
      supabase.from('financial_goals').select('*').or(`owner_id.eq.${user!.id},goal_type.eq.joint`).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('goal_contributions').select('*'),
      supabase.from('profiles').select('id, display_name'),
    ])
    const nameMap: Record<string, string> = {}
    ;(profs ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name ?? 'User' })
    setNames(nameMap)
    const withProgress = (g ?? []).map(goal => {
      const contribs = (c ?? []).filter(x => x.goal_id === goal.id)
      const saved = contribs.reduce((s, x) => s + x.amount, 0)
      return { ...goal, saved, pct: goal.target_amount > 0 ? Math.min(100, Math.round((saved / goal.target_amount) * 100)) : 0, contributions: contribs }
    })
    setGoals(withProgress)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addContribution(goalId: string) {
    if (!contribAmount) return
    await supabase.from('goal_contributions').insert({
      goal_id: goalId, contributor_id: userId,
      amount: parseFloat(contribAmount),
      contribution_date: new Date().toISOString().split('T')[0],
      source: 'manual',
    })
    setContributing(null); setContribAmount(''); load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="flex flex-col gap-4 p-4 animate-slide-up">
      <ModuleHeader title="Financial Goals" subtitle={`${goals.length} active goals`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
            <Plus size={14} /> Add
          </button>
        } />

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet"
          description="Set shared or individual financial goals with monthly targets" />
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map(goal => {
            const monthsLeft = goal.target_date ? calcMonthsRemaining(goal.target_date) : null
            const monthlyNeeded = monthsLeft && monthsLeft > 0
              ? (goal.target_amount - goal.saved) / monthsLeft : null
            const color = goal.pct >= 80 ? '#10B981' : goal.pct >= 50 ? 'var(--gold)' : '#EF4444'
            // per-person totals keyed by actual contributor, not hardcoded names
            const byPerson: Record<string, number> = {}
            goal.contributions.forEach(c => {
              if (c.contributor_id) byPerson[c.contributor_id] = (byPerson[c.contributor_id] ?? 0) + c.amount
            })
            const personIds = Object.keys(names)

            return (
              <div key={goal.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: goal.goal_type === 'joint' ? 'rgba(168,85,247,0.15)' : 'var(--gold-dim)', color: goal.goal_type === 'joint' ? '#a855f7' : 'var(--gold)' }}>
                        {goal.goal_type === 'joint' ? '👥 Joint' : '👤 Individual'}
                      </span>
                    </div>
                    <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{goal.name}</h3>
                    {goal.target_date && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Target: {shortDate(goal.target_date)} · {monthsLeft ?? 0} months left
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color }}>{goal.pct}%</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>complete</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full animate-fill"
                       style={{ width: `${goal.pct}%`, background: color }} />
                </div>

                {/* Amounts */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(goal.saved, goal.currency, true)} saved
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    / {formatCurrency(goal.target_amount, goal.currency, true)}
                  </span>
                </div>

                {/* Joint breakdown */}
                {goal.goal_type === 'joint' && goal.saved > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {personIds.map(id => (
                      <div key={id} className="card-inner p-2 text-center">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{names[id]}{id === userId ? ' (you)' : ''}</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>{formatCurrency(byPerson[id] ?? 0, goal.currency, true)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Monthly needed */}
                {monthlyNeeded !== null && monthlyNeeded > 0 && goal.pct < 100 && (
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    <TrendingUp size={10} className="inline mr-1" />
                    Need {formatCurrency(monthlyNeeded, goal.currency, true)}/month to hit goal on time
                  </p>
                )}

                {/* Contribute */}
                {goal.pct < 100 && (
                  contributing === goal.id ? (
                    <div className="flex gap-2">
                      <input type="number" placeholder="Amount" value={contribAmount}
                        onChange={e => setContribAmount(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                      <button onClick={() => addContribution(goal.id)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: 'var(--gold)', color: '#0a0a0a' }}>Add</button>
                      <button onClick={() => setContributing(null)}
                        className="px-3 py-2 rounded-lg text-sm"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setContributing(goal.id)}
                      className="w-full py-2 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                      + Add Contribution
                    </button>
                  )
                )}
                {goal.pct >= 100 && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                    <span>🎉</span> Goal reached!
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <GoalForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}
