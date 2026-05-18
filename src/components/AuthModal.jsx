import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Account created! Signing you in…')
        // sign in immediately after signup
        await supabase.auth.signInWithPassword({ email, password })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>
            <span style={s.logoIcon}>✦</span>
            <span style={s.logoText}>Sync your boards</span>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={s.sub}>
          {mode === 'login'
            ? 'Sign in to access your boards on any device'
            : 'Create a free account to save your progress'}
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={s.input}
            autoFocus
          />

          <label style={s.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            required
            minLength={6}
            style={s.input}
          />

          {error && <p style={s.error}>{error}</p>}
          {info  && <p style={s.infoMsg}>{info}</p>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={s.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
            style={s.toggleBtn}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p style={s.note}>No account needed to use Taskly locally.</p>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
    backdropFilter: 'blur(4px)',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: 'var(--bg-card)',
    border: 'var(--chrome-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px 28px',
    boxShadow: 'var(--shadow)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    fontSize: '18px',
    color: 'var(--accent)',
  },
  logoText: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-1)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    lineHeight: 1,
  },
  sub: {
    fontSize: '13px',
    color: 'var(--text-2)',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-2)',
    marginTop: '8px',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    color: 'var(--text-1)',
    fontSize: '14px',
    outline: 'none',
  },
  btn: {
    marginTop: '16px',
    padding: '10px 0',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    marginTop: '6px',
    padding: '9px 12px',
    background: 'rgba(255,80,80,0.1)',
    border: '1px solid rgba(255,80,80,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: '#ff6b6b',
    fontSize: '13px',
  },
  infoMsg: {
    marginTop: '6px',
    padding: '9px 12px',
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent)',
    fontSize: '13px',
  },
  toggle: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--text-2)',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    padding: 0,
  },
  note: {
    marginTop: '12px',
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--text-3)',
  },
}
