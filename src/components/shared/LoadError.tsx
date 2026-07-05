// ponytail: deliberately mechanical — one flag, one banner, one retry button
// per page. No retry-with-backoff, no state machine. A paused/waking Supabase
// project or a network blip must never render as a fake "No entries yet".
interface Props { onRetry: () => void }

export default function LoadError({ onRetry }: Props) {
  return (
    <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 m-4"
         style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
      <p className="text-xs" style={{ color: '#F59E0B' }}>
        ⚠ Couldn't load your data — the server may be waking up.
      </p>
      <button onClick={onRetry}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
        Try again
      </button>
    </div>
  )
}
