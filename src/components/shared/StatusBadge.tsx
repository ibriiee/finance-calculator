import { cn } from '@/lib/utils'

const VARIANTS = {
  pending:          'bg-amber-500/15 text-amber-400 border-amber-500/20',
  received:         'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  given:            'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  outstanding:      'bg-red-500/15 text-red-400 border-red-500/20',
  cleared:          'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  partial:          'bg-amber-500/15 text-amber-400 border-amber-500/20',
  advance_given:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  partially_given:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  cancelled:        'bg-gray-500/15 text-gray-400 border-gray-500/20',
  on_track:         'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  behind:           'bg-red-500/15 text-red-400 border-red-500/20',
  wajib:            'bg-red-500/15 text-red-400 border-red-500/20',
  not_wajib:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  gold:             'bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/20',
  joint:            'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

const LABELS: Record<string, string> = {
  pending: 'Pending', received: 'Received', given: 'Given',
  outstanding: 'Outstanding', cleared: 'Cleared', partial: 'Partial',
  advance_given: 'Advance', partially_given: 'Partial', cancelled: 'Cancelled',
  on_track: 'On Track', behind: 'Behind', wajib: 'Wajib', not_wajib: 'Not Due',
  gold: 'Gold', joint: 'Joint',
}

interface Props {
  status: string
  label?: string
  size?: 'sm' | 'xs'
}

export default function StatusBadge({ status, label, size = 'sm' }: Props) {
  const variant = VARIANTS[status] ?? VARIANTS.pending
  const text = label ?? LABELS[status] ?? status
  return (
    <span className={cn(
      'inline-flex items-center font-medium border rounded-full',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      variant
    )}>
      {text}
    </span>
  )
}
