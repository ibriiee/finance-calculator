'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'

const USERS = [
  {
    name: 'Ibrahim',
    email: 'ibrahim_naeem@outlook.com',
    avatar: 'I',
    title: 'Co-founder · Dubai',
    gradient: 'linear-gradient(135deg, #C9A84C, #F5D78E)',
  },
  {
    name: 'Abu Bakar',
    avatar: 'A',
    email: process.env.NEXT_PUBLIC_USER_2_EMAIL ?? '',
    title: 'Co-founder · Dubai',
    gradient: 'linear-gradient(135deg, #7C6A2D, #C9A84C)',
  },
]

// Floating orb component
function Orb({ style }: { style: React.CSSProperties }) {
  return (
    <div className="absolute rounded-full pointer-events-none" style={{
      filter: 'blur(80px)',
      opacity: 0.18,
      ...style,
    }} />
  )
}

// Animated coin/particle
function Particle({ delay, x }: { delay: number; x: number }) {
  return (
    <div className="absolute bottom-0 pointer-events-none animate-float-up"
      style={{
        left: `${x}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${4 + Math.random() * 3}s`,
      }}>
      <div style={{
        width: 4, height: 4, borderRadius: '50%',
        background: 'var(--gold)', opacity: 0.4,
      }} />
    </div>
  )
}

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState<typeof USERS[0] | null>(null)
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'pick' | 'password'>('pick')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { setMounted(true) }, [])

  function selectUser(user: typeof USERS[0]) {
    setSelectedUser(user)
    setError('')
    setPassword('')
    setStep('password')
  }

  function goBack() {
    setStep('pick')
    setSelectedUser(null)
    setError('')
    setPassword('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: selectedUser.email,
      password,
    })
    setLoading(false)
    if (err) {
      setError('Wrong password. Try again.')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: '#080808' }}>

      {/* Animated background orbs */}
      <Orb style={{ width: 500, height: 500, background: '#C9A84C', top: '-20%', left: '-20%' }} />
      <Orb style={{ width: 400, height: 400, background: '#7C6A2D', bottom: '-10%', right: '-10%' }} />
      <Orb style={{ width: 300, height: 300, background: '#C9A84C', top: '40%', right: '20%', opacity: 0.08 }} />

      {/* Floating particles */}
      {mounted && Array.from({ length: 12 }).map((_, i) => (
        <Particle key={i} delay={i * 0.7} x={5 + i * 8} />
      ))}

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Content */}
      <div className={`relative z-10 w-full max-w-sm transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          {/* Animated scale icon */}
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-3xl animate-pulse-gold"
              style={{ background: 'var(--gold-dim)', filter: 'blur(20px)', transform: 'scale(1.4)' }} />
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1a1505, #2a2008)',
                border: '1px solid rgba(201,168,76,0.4)',
                boxShadow: '0 0 40px rgba(201,168,76,0.15)',
              }}>
              {/* Custom scale SVG */}
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 4V32M18 4L4 10M18 4L32 10" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="4" cy="18" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201,168,76,0.1)"/>
                <circle cx="32" cy="18" r="6" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201,168,76,0.1)"/>
                <path d="M4 10 C4 10 1 14 4 18" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M32 10 C32 10 35 14 32 18" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 32 H22" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gold-gradient">Mizan</h1>
          <p className="text-base mt-1 font-light" style={{ color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em' }}>
            ميزان
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Your Islamic Financial OS
          </p>
        </div>

        {/* STEP 1: Pick user */}
        {step === 'pick' && (
          <div className="animate-slide-up">
            <p className="text-center text-sm mb-6 font-medium" style={{ color: 'var(--text-secondary)' }}>
              Who's signing in?
            </p>
            <div className="flex flex-col gap-3">
              {USERS.map(user => (
                <button key={user.name} onClick={() => selectUser(user)}
                  className="group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 active:scale-[0.98] hover:scale-[1.02]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(201,168,76,0.15)',
                    backdropFilter: 'blur(10px)',
                  }}>

                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'rgba(201,168,76,0.04)', boxShadow: 'inset 0 0 20px rgba(201,168,76,0.05)' }} />

                  {/* Avatar */}
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: user.gradient, boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}>
                    <span className="text-xl font-bold text-black">{user.avatar}</span>
                  </div>

                  {/* Info */}
                  <div className="text-left flex-1">
                    <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.title}</p>
                  </div>

                  {/* Arrow */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1"
                    style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
              🔒 Private app · Ibrahim & Abu Bakar only
            </p>
          </div>
        )}

        {/* STEP 2: Enter password */}
        {step === 'password' && selectedUser && (
          <div className="animate-slide-up">
            {/* Back button */}
            <button onClick={goBack} className="flex items-center gap-2 mb-5 text-sm transition-all hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={15} /> Back
            </button>

            {/* Selected user card */}
            <div className="flex items-center gap-3 p-4 rounded-2xl mb-6"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: selectedUser.gradient }}>
                <span className="font-bold text-black">{selectedUser.avatar}</span>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Welcome back, {selectedUser.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter your password to continue</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    autoFocus
                    className="w-full px-4 py-4 pr-12 rounded-xl text-base transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(201,168,76,0.25)'}`,
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxShadow: error ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                    }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm animate-slide-up"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button type="submit" disabled={loading || !password}
                className="relative w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] overflow-hidden disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
                {/* Shimmer effect */}
                {!loading && (
                  <div className="absolute inset-0 -skew-x-12 translate-x-[-200%] animate-shimmer"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', width: '50%' }} />
                )}
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                  : `Sign in as ${selectedUser.name}`
                }
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom watermark */}
      <p className="absolute bottom-6 text-xs" style={{ color: 'rgba(255,255,255,0.1)' }}>
        Mizan v1.0 · Built with ✦
      </p>
    </div>
  )
}
