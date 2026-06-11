import { cn, formatCurrency } from '@/lib/utils'

interface Props {
  amount: number
  currency: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  colorize?: boolean   // green positive, red negative
  compact?: boolean
  className?: string
  showSign?: boolean
}

const SIZE_CLASSES = {
  xs: 'text-xs', sm: 'text-sm', md: 'text-base',
  lg: 'text-lg font-semibold', xl: 'text-xl font-bold', '2xl': 'text-2xl font-bold'
}

export default function AmountDisplay({ amount, currency, size = 'md', colorize = false, compact, className, showSign }: Props) {
  const color = colorize
    ? amount >= 0 ? 'text-emerald-400' : 'text-red-400'
    : 'text-[var(--text-primary)]'

  return (
    <span className={cn(SIZE_CLASSES[size], color, 'font-display tracking-tight', className)}>
      {showSign && amount > 0 && '+'}
      {formatCurrency(amount, currency, compact)}
    </span>
  )
}
