'use client'

/**
 * Content-shaped loading placeholders (#61). A spinner tells you "something is
 * happening"; a skeleton tells you "a list of cards is coming", which reads as
 * faster even at identical latency.
 *
 * The shimmer is a plain CSS animation, so `prefers-reduced-motion` (globals.css)
 * already stills it — no extra handling needed here.
 */
function Bar({ w = '100%', h = 12 }: { w?: string; h?: number }) {
  return (
    <div className="rounded animate-pulse-gold"
      style={{ width: w, height: h, background: 'var(--surface-2)' }} />
  )
}

/** A stack of card-shaped placeholders — matches every module's list layout. */
export default function Skeleton({ cards = 3, header = true }: { cards?: number; header?: boolean }) {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {header && (
        <div className="flex flex-col gap-2">
          <Bar w="45%" h={18} />
          <Bar w="30%" h={11} />
        </div>
      )}
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <Bar w="40%" h={13} />
            <Bar w="22%" h={16} />
          </div>
          <Bar w="60%" h={10} />
          <Bar w="35%" h={10} />
        </div>
      ))}
    </div>
  )
}

/** Two stat tiles above a card list — the dashboard/analytics shape. */
export function SkeletonStats() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <div key={i} className="card p-3 flex flex-col gap-2">
            <Bar w="55%" h={10} />
            <Bar w="70%" h={18} />
          </div>
        ))}
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <Bar w="35%" h={12} />
        <Bar w="60%" h={30} />
        <Bar w="80%" h={10} />
      </div>
    </div>
  )
}
