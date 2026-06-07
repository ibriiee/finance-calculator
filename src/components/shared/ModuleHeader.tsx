'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle?: string
  back?: boolean
  action?: React.ReactNode
  className?: string
}

export default function ModuleHeader({ title, subtitle, back, action, className }: Props) {
  const router = useRouter()
  return (
    <div className={cn('flex items-center justify-between px-4 pt-4 pb-2', className)}>
      <div className="flex items-center gap-3">
        {back && (
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
            <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{title}</h1>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
