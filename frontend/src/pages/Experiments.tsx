import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface Experiment {
  job_id:            number
  dataset_name:      string
  target_column:     string | null
  problem_type:      string | null
  best_model:        string | null
  accuracy:          number | null
  f1_score:          number | null
  precision:         number | null
  recall:            number | null
  r2_score:          number | null
  rmse:              number | null
  mae:               number | null
  dataset_size:      number | null
  feature_count:     number
  model_count:       number
  duration_seconds:  number | null
  created_at:        string | null
}

type SortKey = 'created_at' | 'score' | 'dataset_size' | 'duration'

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function fmtNum(v: number | null, digits = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(digits)
}

function fmtDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return '—'
  if (sec < 60) return `${sec.toFixed(0)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${s}s`
}

function primaryScore(e: Experiment): number | null {
  return e.problem_type === 'regression' ? e.r2_score : e.accuracy
}

export default function Experiments() {
  const navigate = useNavigate()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading]         = useState(true)
  const [sortKey, setSortKey]         = useState<SortKey>('created_at')
  const [problemFilter, setProblemFilter] = useState<string>('all')

  useEffect(() => {
    api.get('/datasets/experiments')
      .then(r => setExperiments(r.data.experiments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = experiments.filter(e =>
    problemFilter === 'all' || e.problem_type === problemFilter
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'created_at') {
      return (b.created_at || '').localeCompare(a.created_at || '')
    }
    if (sortKey === 'score') {
      return (primaryScore(b) ?? -1) - (primaryScore(a) ?? -1)
    }
    if (sortKey === 'dataset_size') {
      return (b.dataset_size ?? 0) - (a.dataset_size ?? 0)
    }
    return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0)
  })

  const maxScore = Math.max(0.01, ...filtered.map(e => primaryScore(e) ?? 0))
  const chartData = [...filtered]
    .filter(e => primaryScore(e) !== null)
    .sort((a, b) => (primaryScore(b) ?? 0) - (primaryScore(a) ?? 0))
    .slice(0, 10)

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-7xl animate-fade-in">

        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
              Experiments
            </h1>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              Compare every training run side by side
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={problemFilter}
              onChange={e => setProblemFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
              className="text-xs rounded-lg px-3 py-2"
            >
              <option value="all">All problem types</option>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
              className="text-xs rounded-lg px-3 py-2"
            >
              <option value="created_at">Sort: newest</option>
              <option value="score">Sort: best score</option>
              <option value="dataset_size">Sort: largest dataset</option>
              <option value="duration">Sort: longest run</option>
            </select>
          </div>
        </div>

        {/* Loading / empty */}
        {loading ? (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl px-5 py-12 text-center">
            <p style={{ color: 'var(--text-4)' }} className="text-sm">Loading experiments...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl px-5 py-12 text-center">
            <p style={{ color: 'var(--text-3)' }} className="text-sm mb-2">No experiments yet</p>
            <button
              onClick={() => navigate('/upload')}
              style={{ color: '#6366F1' }}
              className="text-xs hover:underline"
            >
              Upload a dataset to run your first experiment →
            </button>
          </div>
        ) : (
          <>
            {/* Chart — top 10 by primary score */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl mb-6 overflow-hidden">
              <div style={{ borderBottom: '1px solid var(--border)' }}
                className="px-5 py-4">
                <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                  Top experiments by score
                </h2>
                <p style={{ color: 'var(--text-4)' }} className="text-xs mt-0.5">
                  Accuracy for classification · R² for regression
                </p>
              </div>
              <div className="px-5 py-5 space-y-2">
                {chartData.map(e => {
                  const score = primaryScore(e) ?? 0
                  const pct = (score / maxScore) * 100
                  return (
                    <div
                      key={e.job_id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] px-2 py-1.5 rounded-lg"
                      onClick={() => navigate(`/results/${e.job_id}`)}
                    >
                      <div className="w-40 truncate" style={{ color: 'var(--text-2)' }}>
                        <span className="text-xs font-mono">{e.dataset_name}</span>
                      </div>
                      <div className="flex-1 relative h-5">
                        <div style={{
                          background: 'linear-gradient(90deg, #3B82F6, #6366F1)',
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <div className="w-20 text-right">
                        <span style={{ color: 'var(--text-1)' }} className="text-xs font-semibold font-mono">
                          {e.problem_type === 'regression' ? fmtNum(score) : fmtPct(score)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Comparison table */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl overflow-hidden">
              <div style={{ borderBottom: '1px solid var(--border)' }}
                className="px-5 py-4 flex items-center justify-between">
                <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                  All experiments ({sorted.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ color: 'var(--text-2)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-4)' }}>
                      <th className="text-left px-5 py-3 font-medium uppercase tracking-wider">Dataset</th>
                      <th className="text-left px-3 py-3 font-medium uppercase tracking-wider">Type</th>
                      <th className="text-left px-3 py-3 font-medium uppercase tracking-wider">Best model</th>
                      <th className="text-right px-3 py-3 font-medium uppercase tracking-wider">Acc / R²</th>
                      <th className="text-right px-3 py-3 font-medium uppercase tracking-wider">F1 / RMSE</th>
                      <th className="text-right px-3 py-3 font-medium uppercase tracking-wider">Rows</th>
                      <th className="text-right px-3 py-3 font-medium uppercase tracking-wider">Features</th>
                      <th className="text-right px-3 py-3 font-medium uppercase tracking-wider">Duration</th>
                      <th className="text-right px-5 py-3 font-medium uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((e, i) => {
                      const primary = primaryScore(e)
                      const secondary = e.problem_type === 'regression' ? e.rmse : e.f1_score
                      return (
                        <tr
                          key={e.job_id}
                          style={{
                            borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer',
                          }}
                          className="hover:bg-white/[0.02] transition-all"
                          onClick={() => navigate(`/results/${e.job_id}`)}
                        >
                          <td className="px-5 py-3 font-mono truncate max-w-[200px]" style={{ color: 'var(--text-1)' }}>
                            {e.dataset_name}
                          </td>
                          <td className="px-3 py-3">
                            <span style={{
                              backgroundColor: e.problem_type === 'regression' ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                              color: e.problem_type === 'regression' ? '#C4B5FD' : '#93C5FD',
                              border: `1px solid ${e.problem_type === 'regression' ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}`,
                            }} className="text-xs px-2 py-0.5 rounded-md">
                              {e.problem_type || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3">{e.best_model || '—'}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold" style={{ color: 'var(--text-1)' }}>
                            {e.problem_type === 'regression' ? fmtNum(primary) : fmtPct(primary)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {e.problem_type === 'regression' ? fmtNum(secondary) : fmtPct(secondary)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {e.dataset_size?.toLocaleString() ?? '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{e.feature_count}</td>
                          <td className="px-3 py-3 text-right font-mono">{fmtDuration(e.duration_seconds)}</td>
                          <td className="px-5 py-3 text-right" style={{ color: 'var(--text-4)' }}>
                            {e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
