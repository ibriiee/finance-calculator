'use client'
import { formatCurrency } from '@/lib/utils'

const GOLD = '#C9A84C'

/** Donut chart from segments [{label, value, color}] */
export function Donut({ segments, centerLabel, centerValue }: {
  segments: { label: string; value: number; color: string }[]
  centerLabel?: string
  centerValue?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const R = 52, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-5">
      <svg width="130" height="130" viewBox="0 0 130 130" className="shrink-0">
        <circle cx="65" cy="65" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        {total > 0 && segments.map((s, i) => {
          const frac = s.value / total
          const dash = frac * C
          const el = (
            <circle key={i} cx="65" cy="65" r={R} fill="none" stroke={s.color} strokeWidth="14"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
              transform="rotate(-90 65 65)" strokeLinecap="butt" />
          )
          offset += dash
          return el
        })}
        {centerValue && (
          <>
            <text x="65" y="62" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text-primary)">{centerValue}</text>
            <text x="65" y="78" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{centerLabel}</text>
          </>
        )}
      </svg>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            </span>
            <span className="font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stacked bars — one bar per period, split into coloured parts (category trends, #73). */
export function StackedBars({ data, currency = 'AED' }: {
  data: { label: string; parts: { key: string; value: number; color: string }[] }[]
  currency?: string
}) {
  const totals = data.map(d => d.parts.reduce((s, p) => s + p.value, 0))
  const max = Math.max(1, ...totals)
  return (
    <div className="flex items-end justify-between gap-2 h-40 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <div className="w-full flex flex-col justify-end items-center" style={{ height: 120 }}
            title={`${d.label}: ${formatCurrency(totals[i], currency)}`}>
            {/* Tallest slice on top reads best; parts arrive pre-sorted by the page. */}
            {d.parts.filter(p => p.value > 0).map((p, j) => (
              <div key={j} className="w-2/3"
                style={{
                  height: `${(p.value / max) * 100}%`, background: p.color, minHeight: 2,
                  borderTopLeftRadius: j === 0 ? 3 : 0, borderTopRightRadius: j === 0 ? 3 : 0,
                }}
                title={`${p.key}: ${formatCurrency(p.value, currency)}`} />
            ))}
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Two opposing series side by side (money in vs money out, #76). */
export function GroupedBars({ data, labelA, labelB, colorA = '#10B981', colorB = '#EF4444', currency = 'AED' }: {
  data: { label: string; a: number; b: number }[]
  labelA: string; labelB: string
  colorA?: string; colorB?: string; currency?: string
}) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b)))
  return (
    <div className="flex items-end justify-between gap-2 h-40 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: 120 }}>
            <div className="w-1/2 rounded-t" style={{ height: `${(d.a / max) * 100}%`, background: colorA, minHeight: d.a > 0 ? 3 : 0 }}
              title={`${labelA} ${formatCurrency(d.a, currency)}`} />
            <div className="w-1/2 rounded-t" style={{ height: `${(d.b / max) * 100}%`, background: colorB, minHeight: d.b > 0 ? 3 : 0 }}
              title={`${labelB} ${formatCurrency(d.b, currency)}`} />
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Grouped monthly bars: earned vs sadaka given */
export function MonthlyBars({ data }: { data: { month: string; earned: number; sadaka: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.earned))
  return (
    <div className="flex items-end justify-between gap-2 h-40 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: 120 }}>
            <div className="w-1/2 rounded-t" style={{ height: `${(d.earned / max) * 100}%`, background: GOLD, minHeight: d.earned > 0 ? 3 : 0 }} title={`Earned ${formatCurrency(d.earned, 'AED')}`} />
            <div className="w-1/2 rounded-t" style={{ height: `${(d.sadaka / max) * 100}%`, background: '#10B981', minHeight: d.sadaka > 0 ? 3 : 0 }} title={`Sadaka ${formatCurrency(d.sadaka, 'AED')}`} />
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.month}</span>
        </div>
      ))}
    </div>
  )
}
