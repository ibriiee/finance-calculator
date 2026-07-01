'use client'

// Last-resort boundary: catches errors in the ROOT layout itself, where the normal
// error.tsx can't reach. Must render its own <html>/<body> and use inline styles
// (the app's CSS/theme layer may not have loaded). Kept deliberately dumb.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0A0A0A', color: '#E5E5E5', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: '#A3A3A3', marginTop: 8 }}>
            The app hit an unexpected error. Your data is safe.
          </p>
          <button onClick={() => reset()} style={{
            marginTop: 16, padding: '8px 16px', borderRadius: 12, fontSize: 13, cursor: 'pointer',
            background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)',
          }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
