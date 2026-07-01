'use client'

// Catches any render/data error in an (app) page so a single bad query shows a
// recoverable screen instead of a dead page. Next.js resets the segment on retry.
import Link from 'next/link'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ minHeight: '70vh' }}>
      <p className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Something went wrong
      </p>
      <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        This page hit an error. Your data is safe — try again, or head back home.
      </p>
      <div className="flex gap-2">
        <button onClick={() => reset()} className="text-xs px-4 py-2 rounded-xl font-medium"
          style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.4)' }}>
          Try again
        </button>
        <Link href="/dashboard" className="text-xs px-4 py-2 rounded-xl font-medium"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          Home
        </Link>
      </div>
      {error?.digest && (
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ref: {error.digest}</p>
      )}
    </div>
  )
}
