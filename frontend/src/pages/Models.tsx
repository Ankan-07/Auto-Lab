import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface Model {
  job_id:       number
  name:         string
  best_model:   string
  problem_type: string
  accuracy:     number | null
  created_at:   string
}

interface DeployedInfo {
  id:     number
  job_id: number
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins  = Math.floor(diff / 60000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

export default function Models() {
  const navigate = useNavigate()
  const [models, setModels]     = useState<Model[]>([])
  const [deployed, setDeployed] = useState<DeployedInfo[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/datasets/stats'),
      api.get('/deploy/models'),
    ]).then(([statsRes, deployRes]) => {
      setModels(statsRes.data.recent_models || [])
      // deployRes.data is now array of objects with job_id
      setDeployed((deployRes.data || [])
        .filter((d: any) => d.job_id !== undefined && d.job_id !== null)
        .map((d: any) => ({
          id:     Number(d.id),
          job_id: Number(d.job_id),
        })))
    }).catch(() => {})
    .finally(() => setLoading(false))
  }, [])

  function getDeployedInfo(jobId: number): DeployedInfo | null {
    return deployed.find(d => d.job_id === Number(jobId)) || null
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-5xl animate-fade-in">

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
              My Models
            </h1>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              All your trained models
            </p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg glow-hover"
          >
            + Train New Model
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-8">
            <span className="animate-spin" style={{ color: '#6366F1' }}>⟳</span>
            <p style={{ color: 'var(--text-3)' }}>Loading models...</p>
          </div>
        ) : models.length === 0 ? (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h3 style={{ color: 'var(--text-1)' }} className="text-lg font-semibold mb-2">
              No models yet
            </h3>
            <p style={{ color: 'var(--text-3)' }} className="text-sm mb-6">
              Upload a dataset to train your first model
            </p>
            <button
              onClick={() => navigate('/upload')}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="text-white font-semibold px-6 py-3 rounded-xl text-sm glow-hover"
            >
              Upload Dataset
            </button>
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl overflow-hidden">
            {/* Header row */}
            <div style={{ borderBottom: '1px solid var(--border)' }}
              className="px-5 py-3 grid grid-cols-5 gap-4">
              {['Dataset', 'Algorithm', 'Type', 'Accuracy', 'Actions'].map((h, i) => (
                <p key={i} style={{ color: 'var(--text-4)' }}
                  className="text-xs font-medium uppercase tracking-wide">
                  {h}
                </p>
              ))}
            </div>

            {models.map((m, i) => {
              const deployInfo = getDeployedInfo(m.job_id)
              const isAlreadyDeployed = !!deployInfo

              return (
                <div
                  key={i}
                  style={{
                    borderBottom: i < models.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  className="px-5 py-4 grid grid-cols-5 gap-4 items-center transition-all"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover-bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  {/* Name */}
                  <div className="flex items-center gap-3">
                    <div style={{
                      backgroundColor: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0">
                      ◈
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-1)' }} className="text-sm font-mono">
                        {m.name.length > 18 ? m.name.slice(0, 18) + '...' : m.name}
                      </p>
                      <p style={{ color: 'var(--text-4)' }} className="text-xs">
                        {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Algorithm */}
                  <p style={{ color: 'var(--text-2)' }} className="text-sm">{m.best_model}</p>

                  {/* Type badge */}
                  <span style={{
                    backgroundColor: m.problem_type === 'classification'
                      ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)',
                    color: m.problem_type === 'classification' ? '#A5B4FC' : '#93C5FD',
                    border: `1px solid ${m.problem_type === 'classification'
                      ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    fontSize: '11px', padding: '2px 8px',
                    borderRadius: '20px', display: 'inline-block',
                  }}>
                    {m.problem_type}
                  </span>

                  {/* Accuracy */}
                  <p style={{ color: 'var(--text-1)' }} className="text-sm font-mono font-semibold">
                    {m.accuracy ? `${(m.accuracy * 100).toFixed(2)}%` : 'N/A'}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/results/${m.job_id}`)}
                      style={{
                        color: 'var(--text-2)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'transparent',
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all"
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-1)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-2)'
                      }}
                    >
                      Results
                    </button>

                    {isAlreadyDeployed ? (
                      <button
                        onClick={() => navigate('/apis')}
                        style={{
                          backgroundColor: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          color: '#22C55E',
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                      >
                        View API ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/deploy/${m.job_id}`)}
                        style={{
                          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                          color: 'white',
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                      >
                        Deploy
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
