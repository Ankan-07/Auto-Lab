import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { email, password })
      login(response.data.access_token, response.data.refresh_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ backgroundColor: 'var(--bg)' }}
      className="min-h-screen flex"
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

      {/* Left panel */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span style={{ color: 'var(--text-1)' }} className="font-semibold text-base">
            AutoLab
          </span>
        </div>

        <div>
          <div
            style={{ color: 'var(--text-4)' }}
            className="text-xs font-mono uppercase tracking-widest mb-4"
          >
            AutoML Platform v1.0
          </div>

          <h1
            style={{ color: 'var(--text-1)' }}
            className="text-4xl font-semibold leading-snug mb-4"
          >
            Upload data.<br />
            Get a model.<br />
            <span className="gradient-text">Ship in minutes.</span>
          </h1>

          <p style={{ color: 'var(--text-2)' }} className="text-base leading-relaxed">
            AI agents handle the entire ML pipeline.<br />
            No expertise required.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: '⚡', text: 'AI agents clean and prepare your data' },
            { icon: '🧠', text: 'Trains 10+ algorithms, picks the best' },
            { icon: '🚀', text: 'Deploy as REST API in one click' },
          ].map((f, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
            >
              <span className="text-lg">{f.icon}</span>
              <span style={{ color: 'var(--text-2)' }} className="text-sm">
                {f.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">

          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
            >
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span style={{ color: 'var(--text-1)' }} className="font-semibold">
              AutoLab
            </span>
          </div>

          <h2 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Welcome back
          </h2>

          <p style={{ color: 'var(--text-4)' }} className="text-sm mb-8">
            Sign in to your AutoLab account
          </p>

          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5',
              }}
              className="px-4 py-3 rounded-lg mb-6 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                style={{ color: 'var(--text-2)' }}
                className="text-xs font-medium block mb-1.5 uppercase tracking-wide"
              >
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                }}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition placeholder-gray-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  style={{ color: 'var(--text-2)' }}
                  className="text-xs font-medium uppercase tracking-wide"
                >
                  Password
                </label>

                <span
                  style={{ color: '#6366F1' }}
                  className="text-xs cursor-pointer hover:underline"
                >
                  Forgot password?
                </span>
              </div>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                }}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition placeholder-gray-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="w-full text-white font-semibold py-2.5 rounded-lg transition text-sm glow-hover disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ color: 'var(--text-4)' }} className="text-center mt-6 text-sm">
            No account?{' '}
            <Link
              to="/register"
              style={{ color: '#6366F1' }}
              className="font-medium hover:underline"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}