import { format, formatDistanceToNowStrict, parseISO, formatDistanceStrict } from 'date-fns'

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
  SEK: 'kr',
  DKK: 'kr',
  CAD: 'C$',
  AUD: 'A$',
}

export function currency(value: number, code = 'GBP'): string {
  const symbol = CURRENCY_SYMBOL[code] ?? ''
  const rounded = Math.round(value)
  const formatted = Math.abs(rounded).toLocaleString('en-GB')
  const sign = rounded < 0 ? '-' : ''
  // Trailing-symbol currencies (Nordic) read more naturally after the number.
  if (code === 'SEK' || code === 'DKK') return `${sign}${formatted} ${symbol}`
  return `${sign}${symbol}${formatted}`
}

export function compactCurrency(value: number, code = 'GBP'): string {
  const symbol = CURRENCY_SYMBOL[code] ?? ''
  const abs = Math.abs(value)
  let body: string
  if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1)}M`
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}k`
  else body = `${Math.round(abs)}`
  const sign = value < 0 ? '-' : ''
  if (code === 'SEK' || code === 'DKK') return `${sign}${body} ${symbol}`
  return `${sign}${symbol}${body}`
}

export function pct(value: number, digits = 0): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function safeParse(iso: string): Date | null {
  const d = parseISO(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function shortDate(iso: string): string {
  const d = safeParse(iso)
  return d ? format(d, 'd MMM') : ''
}

export function dateTime(iso: string): string {
  const d = safeParse(iso)
  return d ? format(d, 'd MMM yyyy, HH:mm') : iso
}

/** "3 days ago". With `anchor` (the data as-of date), the distance is measured
 *  from that date instead of now — for data timestamps in a historical or
 *  synthetic portfolio. Times after the anchor fall back to the wall clock. */
export function relativeTime(iso: string, anchor?: string | null): string {
  const d = safeParse(iso)
  if (!d) return ''
  const a = anchor ? safeParse(anchor) : null
  if (a && d.getTime() <= a.getTime()) {
    const days = Math.round((a.getTime() - d.getTime()) / 86_400_000)
    if (days === 0) return `on ${format(d, 'd MMM yyyy')}`
    return `${formatDistanceStrict(d, a)} ago`
  }
  return `${formatDistanceToNowStrict(d)} ago`
}
