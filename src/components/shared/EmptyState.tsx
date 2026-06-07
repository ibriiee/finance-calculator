import { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
           style={{ background: 'var(--gold-dim)' }}>
        <Icon size={24} style={{ color: 'var(--gold)' }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {description && <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      {action}
    </div>
  )
}
