import Link from 'next/link'

// Shown for any unknown URL instead of a bare 404. Renders inside the root layout.
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div>
        <p style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Page not found</p>
        <Link href="/dashboard" style={{ display: 'inline-block', marginTop: 16, color: '#C9A84C', fontSize: 14 }}>
          Back to home →
        </Link>
      </div>
    </div>
  )
}
