'use client'
import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

/**
 * Back-to-top for long histories (#20). Pull-to-refresh is deliberately NOT
 * implemented: every mobile browser already does it natively, and a JS version
 * would fight the native gesture for no gain.
 *
 * Sits above the bottom nav, appears only once scrolling actually warrants it.
 */
export default function BackToTop({ showAfter = 600 }: { showAfter?: number }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > showAfter)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [showAfter])

  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed right-4 z-30 rounded-full shadow-lg"
      style={{
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        color: 'var(--gold)', width: 40, height: 40,
      }}>
      <ArrowUp size={17} className="mx-auto" />
    </button>
  )
}
