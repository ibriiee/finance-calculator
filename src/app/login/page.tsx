'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Scale, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const ALLOWED = [
    process.env.NEXT_PUBLIC_USER_1_EMAIL,
    process.env.NEXT_PUBLIC_USER_2_EMAIL,
  ]

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!ALLOWED.includes(email)) {
      setError('This app is private. Unauthorised email.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Wrong email or password.'
        : err.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
         style={{ background: 'var(--background)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
             style={{ background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <Scale size={28} style={{ color: 'var(--gold)' }} />
        </div>
        <h1 className="text-3xl font-bold text-gold-gradient">Mizan</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>ميزان — Your Financial Balance</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Sign in to your private account</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: loading ? 'var(--border)' : 'var(--gold)',
                color: '#0a0a0a',
              }}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Private app · Ibrahim & Abu Bakar only
        </p>
      </div>
    </div>
  )
}
