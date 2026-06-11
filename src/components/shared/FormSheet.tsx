'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
  children: React.ReactNode
  /** Optional wider dialog on desktop (e.g. multi-column forms). Default max-w-md. */
  wide?: boolean
}

/**
 * Responsive modal shell for every add/edit form.
 *  - Mobile: bottom sheet (slides up, rounded top, full width).
 *  - Desktop (sm+): centered dialog, aligned with the app column.
 * Rendered in a portal on <body> so it's always viewport-relative and never
 * clipped by an ancestor's transform/overflow. Esc closes; body scroll locks.
 */
export default function FormSheet({ onClose, children, wide }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} animate-sheet-in rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[90vh] sm:max-h-[88vh] overflow-y-auto`}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
