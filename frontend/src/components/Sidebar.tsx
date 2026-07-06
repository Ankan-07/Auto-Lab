import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../services/api'

const navItems = [
  { label: 'Dashboard',      path: '/dashboard',  icon: '▦' },
  { label: 'Upload dataset', path: '/upload',      icon: '↑' },
  { label: 'My models',      path: '/models',      icon: '◈' },
  { label: 'Experiments',    path: '/experiments', icon: '⚗' },
  { label: 'Datasets',       path: '/datasets',    icon: '◫' },
]

const bottomItems = [
  { label: 'APIs',        path: '/apis',        icon: '⚡' },
  { label: 'Marketplace', path: '/marketplace', icon: '◎' },
  { label: 'Settings',    path: '/settings',    icon: '◌' },
]

interface PlanInfo {
  is_pro:      boolean
  job_count:   number
  model_limit: number | null
  can_train:   boolean
}

export default function Sidebar() {
  const location = useLocation()
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [isDark, setIsDark]     = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )

  useEffect(() => {
    api.get('/payments/plan').then(r => setPlanInfo(r.data)).catch(() => {})
  }, [])

  function toggleTheme() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setIsDark(!isDark)
  }

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
    setIsDark(saved !== 'light')
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const usedModels = planInfo?.job_count ?? 0
  const modelLimit = planInfo?.model_limit ?? 3
  const isPro      = planInfo?.is_pro ?? false
  const usagePct   = isPro ? 0 : Math.min((usedModels / modelLimit) * 100, 100)
  const atLimit    = !isPro && usedModels >= modelLimit
  const nearLimit  = !isPro && usedModels >= modelLimit - 1

  return (
    <aside style={{
      backgroundColor: 'var(--surface-2)',
      borderRight: '1px solid var(--border)',
      width: '220px',
    }} className="shrink-0 min-h-screen flex flex-col">

      {/* Logo */}
      <div style={{ borderBottom: '1px solid var(--border)' }} className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <span style={{ color: 'var(--text-1)' }} className="font-semibold text-sm">
            AutoLab
          </span>
          {isPro && (
            <span style={{
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              color: 'white', fontSize: '8px', fontWeight: '700',
              padding: '2px 5px', borderRadius: '20px',
            }}>PRO</span>
          )}
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              marginLeft: 'auto',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-3)',
              fontSize: '12px',
              padding: '2px 6px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            title="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p style={{ color: 'var(--text-4)' }}
          className="text-xs font-medium px-2 mb-2 uppercase tracking-widest">
          Workspace
        </p>

        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              style={active ? {
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#A5B4FC',
              } : {
                color: 'var(--text-3)',
                border: '1px solid transparent',
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover-bg)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-2)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-3)'
                }
              }}
            >
              <span className="font-mono text-xs w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4">
          <p style={{ color: 'var(--text-4)' }}
            className="text-xs font-medium px-2 mb-2 uppercase tracking-widest">
            Other
          </p>
          {bottomItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                style={active ? {
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#A5B4FC',
                } : {
                  color: 'var(--text-3)',
                  border: '1px solid transparent',
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover-bg)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text-2)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text-3)'
                  }
                }}
              >
                <span className="font-mono text-xs w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid var(--border)' }} className="px-3 py-4 space-y-2">
        {!isPro ? (
          <div style={{
            backgroundColor: atLimit ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
            border: `1px solid ${atLimit ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`,
          }} className="px-3 py-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: atLimit ? '#FCA5A5' : '#A5B4FC' }}
                className="text-xs font-medium">Free plan</span>
              <span style={{ color: 'var(--text-3)' }} className="text-xs font-mono">
                {usedModels} / {modelLimit}
              </span>
            </div>
            <div style={{ backgroundColor: 'var(--border)' }} className="w-full rounded-full h-1">
              <div style={{
                background: atLimit ? '#EF4444' : nearLimit ? '#F59E0B'
                  : 'linear-gradient(135deg, #3B82F6, #6366F1)',
                width: `${usagePct}%`,
              }} className="h-1 rounded-full" />
            </div>
            <p style={{ color: 'var(--text-4)' }} className="text-xs mt-2">models used</p>
            <Link to="/upgrade" style={{
              display: 'block', marginTop: '8px', textAlign: 'center',
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              color: 'white', fontSize: '11px', fontWeight: '600',
              padding: '5px 0', borderRadius: '6px', textDecoration: 'none',
            }}>
              {atLimit ? '⚠️ Upgrade Now' : '⚡ Upgrade to Pro'}
            </Link>
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
          }} className="px-3 py-2.5 rounded-lg flex items-center gap-2">
            <span>✨</span>
            <div>
              <p style={{ color: '#A5B4FC' }} className="text-xs font-semibold">Pro Plan</p>
              <p style={{ color: 'var(--text-4)' }} className="text-xs">Unlimited models</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{ color: 'var(--text-3)' }}
          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover-bg)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
          }}
        >
          <span className="text-xs">→</span> Logout
        </button>
      </div>
    </aside>
  )
}