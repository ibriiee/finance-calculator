'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, shortDate, calcMonthsRemaining, validateAmount } from '@/lib/utils'
import ModuleHeader from '@/components/shared/ModuleHeader'
import EmptyState from '@/components/shared/EmptyState'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import LoadError from '@/components/shared/LoadError'
import { Plus, Target, TrendingUp, Pencil, Trash2, Check, X } from 'lucide-react'
import GoalForm from '@/components/goals/GoalForm'
import type { FinancialGoal, GoalContribution } from '@/types/database.types'

interface GoalWithProgress extends FinancialGoal {
  saved: number; pct: number; contributions: GoalContribution[]
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<FinancialGoal | null>(null)
  const [contributing, setContributing] = useState<string | null>(null)
  const [contribAmount, setContribAmount] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [editingContrib, setEditingContrib] = useState<GoalContribution | null>(null)
  const [editContribAmount, setEditContribAmount] = useState('')
  const [editContribDate, setEditContribDate] = useState('')
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user!.id)
    const [{ data: g, error }, { data: c }, { data: profs }] = await Promise.all([
      supabase.from('financial_goals').select('*').or(`owner_id.eq.${user!.id},goal_type.eq.joint`).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('goal_contributions').select('*'),
      supabase.from('profiles').select('id, display_name'),
    ])
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
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
    const goal = goals.find(g => g.id === goalId)
    const amtErr = validateAmount(contribAmount, goal?.currency)
    if (amtErr) { alert(amtErr); return }
    const { error } = await supabase.from('goal_contributions').insert({
      goal_id: goalId, contributor_id: userId,
      amount: parseFloat(contribAmount),
      contribution_date: new Date().toISOString().split('T')[0],
      source: 'manual',
    })
    if (error) { alert('Could not save contribution: ' + error.message); return }
    setContributing(null); setContribAmount(''); load()
  }

  async function deleteGoal(goal: GoalWithProgress) {
    const n = goal.contributions.length
    const detail = n > 0 ? ` Its ${n} contribution${n === 1 ? '' : 's'} (${formatCurrency(goal.saved, goal.currency, true)} saved) will be removed with it.` : ''
    if (!confirm(`Delete goal "${goal.name}"?${detail}`)) return
    const { error } = await supabase.from('financial_goals').delete().eq('id', goal.id)
    if (error) { alert(`Could not delete: ${error.message}`); return }
    load()
  }

  function startEditContrib(c: GoalContribution) {
    setEditingContrib(c)
    setEditContribAmount(String(c.amount))
    setEditContribDate(c.contribution_date ?? new Date().toISOString().split('T')[0])
  }

  async function saveContribEdit(goal: GoalWithProgress) {
    const amtErr = validateAmount(editContribAmount, goal.currency)
    if (amtErr) { alert(amtErr); return }
    const { error } = await supabase.from('goal_contributions')
      .update({ amount: parseFloat(editContribAmount), contribution_date: editContribDate })
      .eq('id', editingContrib!.id)
    if (error) { alert(`Could not save: ${error.message}`); return }
    setEditingContrib(null); load()
  }

  async function deleteContrib(c: GoalContribution, goal: GoalWithProgress) {
    if (!confirm(`Delete this ${formatCurrency(c.amount, goal.currency)} contribution?`)) return
    const { error } = await supabase.from('goal_contributions').delete().eq('id', c.id)
    if (error) { alert(`Could not delete: ${error.message}`); return }
    load()
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <ModuleHeader title="Financial Goals" />
      <LoadError onRetry={load} />
    </div>
  )

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
          description="Set shared or individual financial goals with monthly targets"
          action={
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
              Add First Goal
            </button>
          } />
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
                    {(goal as any).niyyah && goal.pct < 100 && (
                      <p className="text-xs italic mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        “{(goal as any).niyyah}”
                      </p>
                    )}
                    {goal.target_date && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Target: {shortDate(goal.target_date)} · {monthsLeft ?? 0} months left
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color }}>{goal.pct}%</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>complete</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setEditGoal(goal); setShowForm(true) }} aria-label="Edit goal"
                        className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => deleteGoal(goal)} aria-label="Delete goal"
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
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

                {/* Contribution history — every saved amount stays editable */}
                {goal.contributions.length > 0 && (
                  <div className="mb-3">
                    <button onClick={() => setHistoryFor(historyFor === goal.id ? null : goal.id)}
                      className="text-xs w-full text-center py-2 rounded-lg"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {historyFor === goal.id ? 'Hide' : `Show ${goal.contributions.length} contribution${goal.contributions.length === 1 ? '' : 's'}`}
                    </button>
                    {historyFor === goal.id && (
                      <div className="flex flex-col mt-2">
                        {[...goal.contributions]
                          .sort((a, b) => (b.contribution_date ?? '').localeCompare(a.contribution_date ?? ''))
                          .map(c => (
                          <div key={c.id} className="flex items-center justify-between py-2 px-1 border-t" style={{ borderColor: 'var(--border)' }}>
                            {editingContrib?.id === c.id ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <input type="number" inputMode="decimal" value={editContribAmount} onChange={e => setEditContribAmount(e.target.value)}
                                  className="w-24 px-2 py-1.5 rounded-lg text-xs"
                                  style={{ background: 'var(--surface-2)', border: '1px solid var(--gold)', color: 'var(--text-primary)' }} />
                                <input type="date" value={editContribDate} onChange={e => setEditContribDate(e.target.value)}
                                  className="flex-1 px-2 py-1.5 rounded-lg text-xs"
                                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                <button onClick={() => saveContribEdit(goal)} aria-label="Save"
                                  className="p-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                                  <Check size={12} />
                                </button>
                                <button onClick={() => setEditingContrib(null)} aria-label="Cancel"
                                  className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                    +{formatCurrency(c.amount, goal.currency, true)}
                                  </p>
                                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {c.contributor_id ? `${names[c.contributor_id] ?? 'User'}${c.contributor_id === userId ? ' (you)' : ''} · ` : ''}
                                    {c.contribution_date ? shortDate(c.contribution_date) : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => startEditContrib(c)} aria-label="Edit contribution"
                                    className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => deleteContrib(c, goal)} aria-label="Delete contribution"
                                    className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Contribute */}
                {goal.pct < 100 && (
                  contributing === goal.id ? (
                    <div className="flex gap-2">
                      <input type="number" inputMode="decimal" placeholder="Amount" value={contribAmount}
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                      <span>🎉</span> Goal reached!
                    </div>
                    {/* The niyyah is the point of the goal — surface it on completion (#48) */}
                    {(goal as any).niyyah && (
                      <p className="text-xs italic" style={{ color: 'var(--gold)' }}>
                        “{(goal as any).niyyah}”
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <GoalForm onClose={() => { setShowForm(false); setEditGoal(null) }} onSaved={load} editGoal={editGoal} />}
    </div>
  )
}
