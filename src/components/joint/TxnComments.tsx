'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Send, Trash2, Loader2 } from 'lucide-react'
import { shortDate } from '@/lib/utils'

interface Comment { id: string; txn_id: string; author_id: string; body: string; created_at: string }

/**
 * A one-line reply thread on a joint transaction (#51) — "was the gas bill in
 * this?" beats a WhatsApp side-channel, because the answer lives next to the
 * number it's about.
 *
 * Renders NOTHING until phase10-upgrades.sql creates joint_txn_comments, so the
 * app is unchanged before the migration runs. RLS lets both brothers read every
 * comment but only delete their own — the UI mirrors that exactly.
 */
export default function TxnComments({ txnId, userId, names }: {
  txnId: string
  userId: string
  names: Record<string, string>
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    const { data, error: err } = await supabase
      .from('joint_txn_comments').select('*').eq('txn_id', txnId).order('created_at')
    if (err) {
      // 42P01 / PGRST205 = table not created yet: hide the feature entirely.
      if (err.code === '42P01' || err.code === 'PGRST205') setAvailable(false)
      return
    }
    setComments((data as any) ?? [])
  }
  useEffect(() => { load() }, [txnId])

  async function post() {
    const text = body.trim()
    if (!text) return
    setBusy(true); setError('')
    const { error: err } = await supabase.from('joint_txn_comments')
      .insert({ txn_id: txnId, author_id: userId, body: text } as any)
    setBusy(false)
    if (err) { setError(err.message); return }
    setBody('')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this comment?')) return
    const { error: err } = await supabase.from('joint_txn_comments').delete().eq('id', id)
    if (err) { alert('Could not delete: ' + err.message); return }
    load()
  }

  if (!available) return null

  return (
    <div className="mt-1">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <MessageCircle size={11} />
        {comments.length > 0 ? `${comments.length} note${comments.length === 1 ? '' : 's'}` : 'Add a note'}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-1">
          {comments.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-2">
              <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--gold)' }}>
                  {c.author_id === userId ? 'You' : (names[c.author_id] ?? 'Brother')}
                </span>{' '}
                {c.body}
                <span style={{ color: 'var(--text-muted)' }}> · {shortDate(c.created_at)}</span>
              </p>
              {c.author_id === userId && (
                <button onClick={() => remove(c.id)} aria-label="Delete comment"
                  className="p-1 rounded shrink-0" style={{ color: '#EF4444' }}>
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-1.5">
            <input value={body} onChange={e => setBody(e.target.value)} maxLength={500}
              onKeyDown={e => { if (e.key === 'Enter') post() }}
              placeholder="Add a note…"
              className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <button onClick={post} disabled={busy || !body.trim()} aria-label="Post note"
              className="p-1.5 rounded-lg disabled:opacity-40"
              style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            </button>
          </div>
          {error && <p className="text-[10px]" style={{ color: '#EF4444' }}>⚠ {error}</p>}
        </div>
      )}
    </div>
  )
}
