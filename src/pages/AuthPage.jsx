import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
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
        setInfo('Check your email for a confirmation link, then sign in.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // main.jsx auth listener will pick up the session automatically
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoIcon}>✦</span>
          <span style={styles.logoText}>Taskly</span>
        </div>

        <h1 style={styles.heading}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={styles.sub}>
          {mode === 'login'
            ? 'Sign in to access your boards'
            : 'Start organising your work'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={styles.input}
            autoFocus
          />

          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            required
            minLength={6}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}
          {info  && <p style={styles.infoMsg}>{info}</p>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading
              ? 'Please wait…'
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={styles.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
            style={styles.toggleBtn}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-app)',
    backgroundImage: 'var(--page-wash)',
    fontFamily: 'var(--font)',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--bg-card)',
    border: 'var(--chrome-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 36px',
    boxShadow: 'var(--shadow)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '28px',
  },
  logoIcon: {
    fontSize: '22px',
    color: 'var(--accent)',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-1)',
    letterSpacing: '-0.3px',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-1)',
    marginBottom: '6px',
  },
  sub: {
    fontSize: '14px',
    color: 'var(--text-2)',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-2)',
    marginTop: '8px',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    color: 'var(--text-1)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  btn: {
    marginTop: '20px',
    padding: '11px 0',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  error: {
    marginTop: '8px',
    padding: '10px 14px',
    background: 'rgba(255,80,80,0.1)',
    border: '1px solid rgba(255,80,80,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: '#ff6b6b',
    fontSize: '13px',
  },
  infoMsg: {
    marginTop: '8px',
    padding: '10px 14px',
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent)',
    fontSize: '13px',
  },
  toggle: {
    marginTop: '24px',
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
}
