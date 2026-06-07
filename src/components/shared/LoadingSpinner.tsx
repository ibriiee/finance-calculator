import { cn } from '@/lib/utils'

export default function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--gold)] animate-spin" />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--border)] border-t-[var(--gold)] animate-spin" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Mizan…</p>
      </div>
    </div>
  )
}
