import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
    setIsDark(saved !== 'light')
  }, [])

  function toggleTheme() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setIsDark(!isDark)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/register', { email, password })
      const loginRes = await api.post('/auth/login', { email, password })

      login(loginRes.data.access_token, loginRes.data.refresh_token)

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <button
        onClick={toggleTheme}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-3)',
          padding: '6px 12px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          zIndex: 50,
        }}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className="flex items-center gap-2.5 mb-8">
        <div
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
        >
          <span className="text-white font-bold text-sm">M</span>
        </div>

        <span style={{ color: 'var(--text-1)' }} className="text-xl font-semibold">
          AutoLab
        </span>
      </div>

      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h1 style={{ color: 'var(--text-1)' }} className="text-xl font-semibold mb-1">
          Create account
        </h1>

        <p style={{ color: 'var(--text-3)' }} className="text-sm mb-6">
          Start training ML models in minutes
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label style={{ color: 'var(--text-3)' }} className="text-xs block mb-1.5">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-1)',
              }}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          <div>
            <label style={{ color: 'var(--text-3)' }} className="text-xs block mb-1.5">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="6+ characters"
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-1)',
              }}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          <div>
            <label style={{ color: 'var(--text-3)' }} className="text-xs block mb-1.5">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Same as above"
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-1)',
              }}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5',
              }}
              className="px-4 py-2.5 rounded-lg text-sm"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            className="w-full text-white font-semibold py-3 rounded-xl text-sm glow-hover disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span> Creating account...
              </span>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p style={{ color: 'var(--text-4)' }} className="text-center text-sm mt-5">
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6366F1' }} className="font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}