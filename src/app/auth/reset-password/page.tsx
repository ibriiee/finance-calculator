'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase puts the token in the URL hash — the client picks it up automatically
    // Just check we have an active session from the recovery link
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also check if session already set (page reload case)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: '#080808' }}>

      {/* Background orbs */}
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: 500, height: 500, background: '#C9A84C', top: '-20%', left: '-20%', filter: 'blur(80px)', opacity: 0.15 }} />
      <div className="absolute rounded-full pointer-events-none"
        style={{ width: 400, height: 400, background: '#7C6A2D', bottom: '-10%', right: '-10%', filter: 'blur(80px)', opacity: 0.15 }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-3xl animate-pulse-gold"
              style={{ background: 'var(--gold-dim)', filter: 'blur(20px)', transform: 'scale(1.4)' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1a1505, #2a2008)', border: '1px solid rgba(201,168,76,0.4)' }}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <path d="M18 4V32M18 4L4 10M18 4L32 10" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="4" cy="18" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201,168,76,0.1)"/>
                <circle cx="32" cy="18" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201,168,76,0.1)"/>
                <path d="M14 32 H22" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gold-gradient">Set New Password</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Mizan · Private Access</p>
        </div>

        {/* Success state */}
        {done ? (
          <div className="flex flex-col items-center gap-4 p-6 rounded-2xl text-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 size={40} className="text-emerald-400" />
            <div>
              <p className="font-bold text-emerald-400 text-lg">Password Updated!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Taking you to login…</p>
            </div>
          </div>

        ) : !ready ? (
          /* Loading / invalid link state */
          <div className="p-6 rounded-2xl text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <Loader2 size={24} className="animate-spin mx-auto mb-3" style={{ color: 'var(--gold)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Verifying reset link…</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              If this takes too long, the link may have expired.{' '}
              <button onClick={() => router.push('/login')} className="underline" style={{ color: 'var(--gold)' }}>
                Go back
              </button>
            </p>
          </div>

        ) : (
          /* Password form */
          <div className="p-6 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)', backdropFilter: 'blur(10px)' }}>

            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    autoFocus
                    className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(201,168,76,0.25)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full px-4 py-3.5 rounded-xl text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${confirm && confirm !== password ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.25)'}`,
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="flex gap-1.5">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{
                        background: password.length >= i * 3
                          ? i <= 2 ? '#EF4444' : i === 3 ? '#F59E0B' : '#10B981'
                          : 'var(--border)'
                      }} />
                  ))}
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                    {password.length < 6 ? 'Too short' : password.length < 9 ? 'Fair' : password.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={loading || !password || !confirm}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
