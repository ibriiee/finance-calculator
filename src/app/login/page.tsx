'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'

const USERS = [
  {
    name: 'Ibrahim',
    email: 'ibrahim_naeem@outlook.com',
    avatar: 'I',
    photo: '/avatars/ibrahim.jpeg',
    gradient: 'linear-gradient(135deg, #C9A84C, #F5D78E)',
  },
  {
    name: 'Abu Bakar',
    avatar: 'A',
    photo: '/avatars/abubakar.png',
    email: process.env.NEXT_PUBLIC_USER_2_EMAIL ?? '',
    gradient: 'linear-gradient(135deg, #7C6A2D, #C9A84C)',
  },
]

function Orb({ style }: { style: React.CSSProperties }) {
  return <div className="absolute rounded-full pointer-events-none" style={{ filter: 'blur(80px)', opacity: 0.18, ...style }} />
}

function Particle({ delay, x }: { delay: number; x: number }) {
  return (
    <div className="absolute bottom-0 pointer-events-none animate-float-up"
      style={{ left: `${x}%`, animationDelay: `${delay}s`, animationDuration: `${4 + (x % 3)}s` }}>
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)', opacity: 0.4 }} />
    </div>
  )
}

// 6-box OTP input component
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const next = value.slice(0, -1)
      onChange(next)
      if (i > 0) inputs.current[i - 1]?.focus()
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    if (!char) return
    const arr = digits.map((d, idx) => idx === i ? char : d)
    const next = arr.join('').slice(0, 6)
    onChange(next)
    if (i < 5) inputs.current[i + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    inputs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          className="w-11 h-14 text-center text-xl font-bold rounded-xl transition-all"
          style={{
            background: d ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${d ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.2)'}`,
            color: 'var(--text-primary)',
            outline: 'none',
            caretColor: 'var(--gold)',
          }}
        />
      ))}
    </div>
  )
}

type Step = 'pick' | 'password' | 'forgot-confirm' | 'otp' | 'new-password' | 'done'

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState<typeof USERS[0] | null>(null)
  const [password, setPassword]         = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPass, setConfirmPass]   = useState('')
  const [otp, setOtp]                   = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [step, setStep]                 = useState<Step>('pick')
  const [mounted, setMounted]           = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { setMounted(true) }, [])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  function reset(keepUser = false) {
    setError(''); setPassword(''); setOtp(''); setNewPassword(''); setConfirmPass('')
    if (!keepUser) setSelectedUser(null)
  }

  function selectUser(user: typeof USERS[0]) {
    setSelectedUser(user); reset(true); setStep('password')
  }

  function goBack() {
    reset(); setStep('pick')
  }

  // ── SIGN IN ──────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: selectedUser.email, password })
    setLoading(false)
    if (err) setError('Wrong password. Try again.')
    else { router.push('/dashboard'); router.refresh() }
  }

  // ── SEND OTP CODE ────────────────────────────────────────
  async function sendOtp() {
    if (!selectedUser) return
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('otp')
    setResendCooldown(60)
  }

  // ── VERIFY OTP & GO TO NEW PASSWORD ─────────────────────
  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || otp.length < 6) return
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.verifyOtp({
      email: selectedUser.email,
      token: otp,
      type: 'recovery',
    })
    setLoading(false)
    if (err) setError('Wrong or expired code. Check your email.')
    else setStep('new-password')
  }

  // ── SET NEW PASSWORD ─────────────────────────────────────
  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPass) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (err) setError(err.message)
    else { setStep('done'); setTimeout(() => { reset(); setStep('pick') }, 2500) }
  }

  // ── SHARED BACKGROUND ────────────────────────────────────
  const bg = (
    <>
      <Orb style={{ width: 500, height: 500, background: '#C9A84C', top: '-20%', left: '-20%' }} />
      <Orb style={{ width: 400, height: 400, background: '#7C6A2D', bottom: '-10%', right: '-10%' }} />
      <Orb style={{ width: 300, height: 300, background: '#C9A84C', top: '40%', right: '20%', opacity: 0.08 }} />
      {mounted && Array.from({ length: 12 }).map((_, i) => <Particle key={i} delay={i * 0.7} x={5 + i * 8} />)}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
    </>
  )

  const logo = (
    <div className="flex flex-col items-center mb-10">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl animate-pulse-gold"
          style={{ background: 'var(--gold-dim)', filter: 'blur(20px)', transform: 'scale(1.4)' }} />
        <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1a1505, #2a2008)', border: '1px solid rgba(201,168,76,0.4)', boxShadow: '0 0 40px rgba(201,168,76,0.15)' }}>
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
      <p className="text-base mt-1 font-light" style={{ color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em' }}>ميزان</p>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Your Islamic Financial OS</p>
    </div>
  )

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: '#080808' }}>
      {bg}

      <div className={`relative z-10 w-full max-w-sm transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {logo}

        {/* ── STEP: PICK USER ── */}
        {step === 'pick' && (
          <div className="animate-slide-up">
            <div className="grid grid-cols-2 gap-4">
              {USERS.map(user => (
                <button key={user.name} onClick={() => selectUser(user)}
                  className="group relative flex flex-col items-center gap-3 p-5 rounded-3xl transition-all duration-300 active:scale-[0.96] hover:scale-[1.03]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(201,168,76,0.15)',
                    backdropFilter: 'blur(12px)',
                  }}>

                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300"
                    style={{ background: 'rgba(201,168,76,0.05)', boxShadow: '0 0 30px rgba(201,168,76,0.08) inset' }} />

                  {/* Gold ring around photo */}
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `conic-gradient(from 0deg, #C9A84C, #F5D78E, #7C6A2D, #C9A84C)`, borderRadius: '50%' }} />
                    <div className="relative w-20 h-20 rounded-full overflow-hidden"
                      style={{ border: '2px solid #080808' }}>
                      {/* Try to load photo, fall back to initial */}
                      <img
                        src={user.photo}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style') }}
                      />
                      {/* Fallback initial — hidden when photo loads */}
                      <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-black"
                        style={{ background: user.gradient, display: 'none' }}>
                        {user.avatar}
                      </div>
                    </div>
                  </div>

                  {/* Name */}
                  <p className="relative font-bold text-base tracking-wide" style={{ color: 'var(--text-primary)' }}>
                    {user.name}
                  </p>

                  {/* Subtle gold underline on hover */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 h-0.5 rounded-full w-0 group-hover:w-8 transition-all duration-300"
                    style={{ background: 'var(--gold)' }} />
                </button>
              ))}
            </div>
            <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>🔒 Private · tap your name to sign in</p>
          </div>
        )}

        {/* ── STEP: PASSWORD ── */}
        {step === 'password' && selectedUser && (
          <div className="animate-slide-up">
            <button onClick={goBack} className="flex items-center gap-2 mb-5 text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={15} /> Back
            </button>
            <div className="flex items-center gap-3 p-4 rounded-2xl mb-6"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: selectedUser.gradient }}>
                <span className="font-bold text-black">{selectedUser.avatar}</span>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Welcome back, {selectedUser.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter your password to continue</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••••"
                  required autoFocus
                  className="w-full px-4 py-4 pr-12 rounded-xl text-base"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(201,168,76,0.25)'}`, color: 'var(--text-primary)', outline: 'none' }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  ⚠ {error}
                </div>
              )}
              <button type="submit" disabled={loading || !password}
                className="relative w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
                {!loading && <div className="absolute inset-0 -skew-x-12 translate-x-[-200%] animate-shimmer"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', width: '50%' }} />}
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : `Sign in as ${selectedUser.name}`}
              </button>
              {/* Forgot password link */}
              <button type="button" onClick={() => { setError(''); setStep('forgot-confirm') }}
                className="text-center text-xs py-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--gold)' }}>
                Forgot password?
              </button>
            </form>
          </div>
        )}

        {/* ── STEP: FORGOT — CONFIRM SEND ── */}
        {step === 'forgot-confirm' && selectedUser && (
          <div className="animate-slide-up">
            <button onClick={() => setStep('password')} className="flex items-center gap-2 mb-5 text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={15} /> Back
            </button>
            <div className="p-6 rounded-2xl text-center flex flex-col items-center gap-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)', backdropFilter: 'blur(10px)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)' }}>
                <Mail size={24} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <p className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Reset Password</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  We'll send a 6-digit code to
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--gold)' }}>
                  {selectedUser.email}
                </p>
              </div>
              {error && (
                <div className="w-full px-3 py-2.5 rounded-xl text-sm text-left"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  ⚠ {error}
                </div>
              )}
              <button onClick={sendOtp} disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
                {loading ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : '📨 Send Reset Code'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: OTP CODE ENTRY ── */}
        {step === 'otp' && selectedUser && (
          <div className="animate-slide-up">
            <button onClick={() => setStep('forgot-confirm')} className="flex items-center gap-2 mb-5 text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={15} /> Back
            </button>
            <div className="p-6 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)', backdropFilter: 'blur(10px)' }}>
              <div className="text-center mb-6">
                <p className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Check your email</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Enter the 6-digit code sent to
                </p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--gold)' }}>{selectedUser.email}</p>
              </div>

              <form onSubmit={verifyOtp} className="flex flex-col gap-5">
                <OtpInput value={otp} onChange={setOtp} />

                {error && (
                  <div className="px-3 py-2.5 rounded-xl text-sm text-center"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                    ⚠ {error}
                  </div>
                )}

                <button type="submit" disabled={loading || otp.length < 6}
                  className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : 'Verify Code →'}
                </button>

                {/* Resend */}
                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Resend code in {resendCooldown}s</p>
                  ) : (
                    <button type="button" onClick={sendOtp}
                      className="text-xs hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--gold)' }}>
                      Didn't get it? Resend code
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── STEP: NEW PASSWORD ── */}
        {step === 'new-password' && (
          <div className="animate-slide-up">
            <div className="p-6 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)', backdropFilter: 'blur(10px)' }}>
              <p className="font-bold text-base mb-1 text-center" style={{ color: 'var(--text-primary)' }}>Set New Password</p>
              <p className="text-xs text-center mb-6" style={{ color: 'var(--text-muted)' }}>Choose something you'll remember</p>

              <form onSubmit={handleNewPassword} className="flex flex-col gap-4">
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} placeholder="New password"
                    required autoFocus
                    className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--text-primary)', outline: 'none' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{ background: newPassword.length >= i * 3 ? i <= 2 ? '#EF4444' : i === 3 ? '#F59E0B' : '#10B981' : 'var(--border)' }} />
                    ))}
                    <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                      {newPassword.length < 6 ? 'Too short' : newPassword.length < 9 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                )}

                <input type="password" value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)} placeholder="Confirm password"
                  required
                  className="w-full px-4 py-3.5 rounded-xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${confirmPass && confirmPass !== newPassword ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.25)'}`, color: 'var(--text-primary)', outline: 'none' }} />

                {error && (
                  <div className="px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                    ⚠ {error}
                  </div>
                )}

                <button type="submit" disabled={loading || !newPassword || !confirmPass}
                  className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'var(--gold)', color: '#0a0a0a' }}>
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : '✓ Set New Password'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && (
          <div className="animate-slide-up flex flex-col items-center gap-4 p-8 rounded-2xl text-center"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 size={48} className="text-emerald-400" />
            <div>
              <p className="font-bold text-emerald-400 text-xl">Password Updated!</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Taking you back to login…</p>
            </div>
          </div>
        )}
      </div>

      <p className="absolute bottom-6 text-xs" style={{ color: 'rgba(255,255,255,0.1)' }}>
        Mizan v1.0 · Built with ✦
      </p>
    </div>
  )
}
