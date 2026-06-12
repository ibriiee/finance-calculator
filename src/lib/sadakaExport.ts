// Sadaka record export — CSV (data) + printable PDF (keepsake receipt).
// Client-only: uses Blob/anchor download and a print window. No external deps.
import type { SadakaEntry } from '@/types/database.types'
import { formatCurrency, shortDate } from '@/lib/utils'

const RECIPIENT_LABELS: Record<string, string> = {
  named_relative: 'Relative', anonymous_needy: 'Needy', masjid: 'Masjid', gift: 'Gift', other: 'Other',
}
const LOCATION_LABELS: Record<string, string> = { UAE: 'UAE', Pakistan: 'Pakistan', other: 'Other' }
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', gift: 'Gift', food: 'Food', bank_transfer: 'Bank transfer', other: 'Other',
}

export type ExportScope = { label: string; entries: SadakaEntry[] }

// Only entries with sadaka actually given form a record.
export function givenEntries(entries: SadakaEntry[]): SadakaEntry[] {
  return entries
    .filter(e => Number(e.amount_given) > 0)
    .sort((a, b) => (b.date_given ?? b.created_at).localeCompare(a.date_given ?? a.created_at))
}

function totalsByCurrency(entries: SadakaEntry[]): Record<string, number> {
  const totals: Record<string, number> = {}
  entries.forEach(e => { totals[e.currency] = (totals[e.currency] ?? 0) + Number(e.amount_given) })
  return totals
}

function csvCell(value: string | number): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportSadakaCsv(scope: ExportScope) {
  const rows = givenEntries(scope.entries)
  const header = ['Date given', 'Recipient', 'Type', 'Location', 'Method', 'Amount', 'Currency', 'Status']
  const lines = rows.map(e => [
    e.date_given ? shortDate(e.date_given) : shortDate(e.created_at),
    e.recipient_name ?? (e.source_income_id ? 'Obligation from income' : '—'),
    e.recipient_type ? (RECIPIENT_LABELS[e.recipient_type] ?? e.recipient_type) : '—',
    e.location ? (LOCATION_LABELS[e.location] ?? e.location) : '—',
    e.method ? (METHOD_LABELS[e.method] ?? e.method) : '—',
    Number(e.amount_given),
    e.currency,
    e.status,
  ].map(csvCell).join(','))

  const totals = totalsByCurrency(rows)
  const totalLines = Object.entries(totals).map(([cur, amt]) =>
    ['', '', '', '', `Total ${cur}`, amt, cur, ''].map(csvCell).join(','))

  const csv = [header.join(','), ...lines, '', ...totalLines].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `mizan-sadaka-${slug(scope.label)}.csv`)
}

export function exportSadakaPdf(scope: ExportScope) {
  const rows = givenEntries(scope.entries)
  const totals = totalsByCurrency(rows)
  const totalStr = Object.entries(totals).map(([cur, amt]) => formatCurrency(amt, cur)).join('  ·  ') || '—'
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const body = rows.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:#777;padding:24px">No sadaka given in this period.</td></tr>`
    : rows.map(e => `
      <tr>
        <td>${e.date_given ? shortDate(e.date_given) : shortDate(e.created_at)}</td>
        <td>${esc(e.recipient_name ?? (e.source_income_id ? 'Obligation from income' : '—'))}</td>
        <td>${e.recipient_type ? (RECIPIENT_LABELS[e.recipient_type] ?? e.recipient_type) : '—'}</td>
        <td>${e.location ? (LOCATION_LABELS[e.location] ?? e.location) : '—'}</td>
        <td>${e.method ? (METHOD_LABELS[e.method] ?? e.method) : '—'}</td>
        <td style="text-align:right;font-weight:600">${formatCurrency(Number(e.amount_given), e.currency)}</td>
      </tr>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mizan — Sadaka Record</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 40px; }
    .head { border-bottom: 2px solid #C9A84C; padding-bottom: 16px; margin-bottom: 8px; }
    .brand { font-size: 26px; font-weight: 700; letter-spacing: 0.5px; color: #8a6d1f; }
    .ar { font-size: 16px; color: #C9A84C; margin-left: 8px; }
    .sub { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #777; margin-top: 4px; }
    .period { margin: 18px 0 6px; font-size: 15px; }
    .period b { color: #000; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
    th { text-align: left; border-bottom: 1px solid #999; padding: 8px 6px; font-size: 11px;
         text-transform: uppercase; letter-spacing: 1px; color: #555; }
    th:last-child { text-align: right; }
    td { padding: 8px 6px; border-bottom: 1px solid #eee; }
    .total { margin-top: 18px; text-align: right; font-size: 17px; }
    .total b { color: #8a6d1f; }
    .foot { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { margin: 18mm; } .noprint { display: none; } }
  </style></head><body>
    <div class="head">
      <div class="brand">Mizan <span class="ar">ميزان</span></div>
      <div class="sub">Sadaka Record</div>
    </div>
    <p class="period">Period: <b>${esc(scope.label)}</b> &nbsp;·&nbsp; ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} &nbsp;·&nbsp; generated ${generated}</p>
    <table>
      <thead><tr><th>Date</th><th>Recipient</th><th>Type</th><th>Location</th><th>Method</th><th>Amount</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="total">Total given: <b>${totalStr}</b></p>
    <p class="foot">Generated by Mizan — your private Islamic financial OS. This is a personal record of sadaka given and is not an official receipt.</p>
    <button class="noprint" onclick="window.print()" style="margin-top:24px;padding:10px 18px;background:#C9A84C;border:none;border-radius:8px;font-size:14px;cursor:pointer">Print / Save as PDF</button>
  </body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Allow pop-ups to download the PDF record.'); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
