'use client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle?: string
  back?: boolean
  backHref?: string
  action?: React.ReactNode
  className?: string
}

export default function ModuleHeader({ title, subtitle, back = true, backHref = '/dashboard', action, className }: Props) {
  return (
    <div className={cn('flex items-center justify-between px-4 pt-4 pb-2', className)}>
      <div className="flex items-center gap-3">
        {back && (
          <Link href={backHref} prefetch aria-label="Back"
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors shrink-0">
            <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
          </Link>
        )}
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {subtitle && <p className="section-label mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
