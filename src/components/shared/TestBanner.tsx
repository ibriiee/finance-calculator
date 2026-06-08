'use client'
import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'

export default function TestBanner() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const read = () => setOn(localStorage.getItem('mizan_test_mode') === '1')
    read()
    window.addEventListener('storage', read)
    const i = setInterval(read, 1500) // reflect toggle from Settings without reload
    return () => { window.removeEventListener('storage', read); clearInterval(i) }
  }, [])

  if (!on) return null
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold"
      style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', borderBottom: '1px solid rgba(201,168,76,0.25)' }}>
      <FlaskConical size={12} /> TEST MODE — data here is for testing
    </div>
  )
}
