import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface Stats {
  total_models:    number
  total_datasets:  number
  total_deployed:  number
  total_api_calls: number
  avg_accuracy:    number | null
  recent_models:   RecentModel[]
}

interface RecentModel {
  job_id:       number
  name:         string
  best_model:   string
  problem_type: string
  accuracy:     number | null
  created_at:   string
}



function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/datasets/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    { label: 'Models trained',   value: stats.total_models.toString(),    sub: 'completed training runs',  color: '#6366F1' },
    { label: 'Datasets',         value: stats.total_datasets.toString(),   sub: 'uploaded files',           color: '#3B82F6' },
    { label: 'Deployed APIs',    value: stats.total_deployed.toString(),   sub: 'live endpoints',           color: '#8B5CF6' },
    { label: 'Avg accuracy',     value: stats.avg_accuracy ? `${stats.avg_accuracy}%` : 'N/A', sub: 'across all models', color: '#22C55E' },
  ] : [
    { label: 'Models trained',   value: '—', sub: 'loading...', color: '#6366F1' },
    { label: 'Datasets',         value: '—', sub: 'loading...', color: '#3B82F6' },
    { label: 'Deployed APIs',    value: '—', sub: 'loading...', color: '#8B5CF6' },
    { label: 'Avg accuracy',     value: '—', sub: 'loading...', color: '#22C55E' },
  ]

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-6xl animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Dashboard
          </h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">
            Your ML workspace overview
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s, i) => (
            <div
              key={i}
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl px-5 py-4 hover:border-gray-600 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color }} />
                <p style={{ color: 'var(--text-3)' }} className="text-xs font-medium">{s.label}</p>
              </div>
              <p style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-0.5">{s.value}</p>
              <p style={{ color: 'var(--text-4)' }} className="text-xs">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Content row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent models */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="lg:col-span-2 rounded-xl overflow-hidden">
            <div style={{ borderBottom: '1px solid var(--border)' }}
              className="px-5 py-4 flex items-center justify-between">
              <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                Recent models
              </h2>
              <button
                onClick={() => navigate('/models')}
                style={{ color: '#6366F1' }}
                className="text-xs font-medium hover:underline"
              >
                View all →
              </button>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-center">
                <p style={{ color: 'var(--text-4)' }} className="text-sm">Loading...</p>
              </div>
            ) : stats?.recent_models.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p style={{ color: 'var(--text-4)' }} className="text-sm">No models trained yet</p>
                <button
                  onClick={() => navigate('/upload')}
                  style={{ color: '#6366F1' }}
                  className="text-xs mt-2 hover:underline"
                >
                  Upload your first dataset →
                </button>
              </div>
            ) : (
              <div>
                {stats?.recent_models.map((m, i) => (
                  <div
                    key={i}
                    style={{ borderBottom: i < (stats.recent_models.length - 1) ? '1px solid var(--border)' : 'none' }}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-all cursor-pointer"
                    onClick={() => navigate(`/results/${m.job_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{
                        backgroundColor: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                      }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                        ◈
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-1)' }} className="text-sm font-medium font-mono">
                          {m.name}
                        </p>
                        <p style={{ color: 'var(--text-4)' }} className="text-xs">
                          {m.best_model} · {m.problem_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                          {m.accuracy ? `${(m.accuracy * 100).toFixed(2)}%` : 'N/A'}
                        </p>
                        <p style={{ color: 'var(--text-4)' }} className="text-xs">accuracy</p>
                      </div>
                      <p style={{ color: 'var(--text-4)' }} className="text-xs hidden sm:block">
                        {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick start */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl flex flex-col overflow-hidden">
            <div style={{ borderBottom: '1px solid var(--border)' }} className="px-5 py-4">
              <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">Quick start</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                border: '1px solid rgba(99,102,241,0.2)',
              }} className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4">
                📂
              </div>
              <p style={{ color: 'var(--text-1)' }} className="text-sm font-medium mb-1">
                Upload a dataset
              </p>
              <p style={{ color: 'var(--text-3)' }} className="text-xs mb-6 leading-relaxed">
                Supports CSV, Excel, JSON, Parquet. AI agents train the best model automatically.
              </p>
              <button
                onClick={() => navigate('/upload')}
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all glow-hover w-full"
              >
                Upload Dataset
              </button>
              <button
                onClick={() => navigate('/marketplace')}
                style={{ color: 'var(--text-4)' }}
                className="text-xs mt-3 hover:text-gray-400 transition-all"
              >
                browse marketplace →
              </button>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}