import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string, compact = false): string {
  const absAmount = Math.abs(amount)
  let formatted: string

  if (compact && absAmount >= 1_000_000) {
    const m = absAmount / 1_000_000
    formatted = m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`
  } else if (compact && absAmount >= 1000) {
    const k = absAmount / 1000
    formatted = k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`
  } else {
    formatted = absAmount.toLocaleString('en-US', {
      minimumFractionDigits: currency === 'gold_grams' || currency === 'silver_grams' ? 2 : 0,
      maximumFractionDigits: currency === 'gold_grams' || currency === 'silver_grams' ? 4 : 0,
    })
  }

  const symbols: Record<string, string> = {
    AED: 'AED ', PKR: 'PKR ', USD: '$ ', gold_grams: '', silver_grams: ''
  }
  const suffix = currency === 'gold_grams' ? 'g gold' : currency === 'silver_grams' ? 'g silver' : ''
  const prefix = symbols[currency] ?? `${currency} `

  return `${amount < 0 ? '-' : ''}${prefix}${formatted}${suffix}`
}

// Maps the two account holders to income `ownership` values by email,
// so renaming a profile in Settings never breaks income attribution.
export const USER_OWNERSHIP: Record<string, 'ibrahim' | 'abu_bakar'> = {
  'ibrahim_naeem@outlook.com': 'ibrahim',
  'bakarnaeem@hotmail.com': 'abu_bakar',
}

export function ownershipForEmail(email: string | null | undefined): 'ibrahim' | 'abu_bakar' | null {
  if (!email) return null
  return USER_OWNERSHIP[email.toLowerCase()] ?? null
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function daysAgo(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export function daysUntil(date: string): number {
  return Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function getLagDays(workDate: string, receivedDate?: string | null): number {
  const end = receivedDate ? new Date(receivedDate) : new Date()
  return Math.floor((end.getTime() - new Date(workDate).getTime()) / (1000 * 60 * 60 * 24))
}

export function getLagColor(days: number): string {
  if (days <= 30) return 'text-emerald-400'
  if (days <= 45) return 'text-amber-400'
  return 'text-red-400'
}

export function getProgressColor(pct: number): string {
  if (pct >= 80) return '#10B981'
  if (pct >= 50) return '#C9A84C'
  return '#EF4444'
}

export function calcMonthsRemaining(targetDate: string): number {
  const now = new Date()
  const target = new Date(targetDate)
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth())
}

/** Returns an error string if invalid, null if OK. Max 10M (AED) to catch
 *  fat-finger entries — 100M for PKR, since a legitimate PKR income can
 *  exceed 10M (≈ AED 132k) while the AED cap stays tight. */
export function validateAmount(raw: string, currency?: string): string | null {
  const n = parseFloat(raw)
  if (!raw || isNaN(n)) return 'Enter a valid number'
  if (n <= 0) return 'Amount must be greater than 0'
  const cap = currency === 'PKR' ? 100_000_000 : 10_000_000
  if (n > cap) return 'Amount seems too large — check and re-enter'
  return null
}

export function shortDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function monthYear(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
