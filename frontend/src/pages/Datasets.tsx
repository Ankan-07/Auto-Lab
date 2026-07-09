import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface Dataset {
  id:           number
  name:         string
  file_size:    number
  row_count:    number | null
  column_count: number | null
  target_column:string | null
  status:       string
  created_at:   string
}

interface DatasetGroup {
  name:     string
  versions: Dataset[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'recently'
}

export default function Datasets() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [retraining, setRetraining] = useState<number | null>(null)

  useEffect(() => {
    api.get('/datasets/')
      .then(r => setDatasets(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const grouped: DatasetGroup[] = []
  const seen: Record<string, DatasetGroup> = {}

  datasets.forEach(d => {
    if (!seen[d.name]) {
      seen[d.name] = { name: d.name, versions: [] }
      grouped.push(seen[d.name])
    }
    seen[d.name].versions.push(d)
  })

  async function handleDelete(id: number) {
    if (!confirm('Delete this dataset? This cannot be undone.')) return

    setDeleting(id)

    try {
      await api.delete(`/datasets/${id}`)
      setDatasets(prev => prev.filter(d => d.id !== id))
    } catch {
      alert('Failed to delete dataset')
    } finally {
      setDeleting(null)
    }
  }

  async function handleRetrain(
    datasetId: number,
    datasetName: string,
    targetColumn: string | null
  ) {
    setRetraining(datasetId)

    try {
      const res = await api.post(`/datasets/${datasetId}/retrain`)
      navigate(`/jobs/${res.data.job_id}`)
    } catch (err: any) {
      const detail = err.response?.data?.detail

      if (
        err.response?.status === 409 &&
        typeof detail === 'object' &&
        detail.error === 'file_not_on_disk'
      ) {
        const confirmed = confirm(
          `File "${datasetName}" is not on server disk (production limitation).\n\n` +
          `To retrain: go to Upload page, upload "${datasetName}" again with target "${targetColumn}".\n\n` +
          `Go to upload page now?`
        )

        if (confirmed) navigate('/upload')
      } else {
        alert(typeof detail === 'string' ? detail : 'Retrain failed')
      }
    } finally {
      setRetraining(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-5xl animate-fade-in">

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
              Datasets
            </h1>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              All uploaded datasets · same filename = versions
            </p>
          </div>

          <button
            onClick={() => navigate('/upload')}
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg glow-hover"
          >
            + Upload New
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3">
            <span className="animate-spin" style={{ color: '#6366F1' }}>⟳</span>
            <p style={{ color: 'var(--text-3)' }}>Loading datasets...</p>
          </div>
        ) : grouped.length === 0 ? (
          <div
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-2xl p-16 text-center"
          >
            <div className="text-5xl mb-4">📊</div>
            <h3 style={{ color: 'var(--text-1)' }} className="text-lg font-semibold mb-2">
              No datasets yet
            </h3>
            <p style={{ color: 'var(--text-3)' }} className="text-sm mb-6">
              Upload a CSV, Excel, or JSON file to get started
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
          <div className="space-y-4">
            {grouped.map((group) => {
              const latestVersion = group.versions[group.versions.length - 1]

              return (
                <div
                  key={group.name}
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                  className="rounded-xl overflow-hidden"
                >
                  <div
                    style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📊</span>
                      <div>
                        <p style={{ color: 'var(--text-1)' }} className="text-sm font-semibold font-mono">
                          {group.name}
                        </p>
                        <p style={{ color: 'var(--text-4)' }} className="text-xs">
                          {group.versions.length} version{group.versions.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRetrain(
                        latestVersion.id,
                        group.name,
                        latestVersion.target_column
                      )}
                      disabled={retraining === latestVersion.id}
                      style={{
                        background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                        color: 'white',
                      }}
                      className="text-xs px-4 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                    >
                      {retraining === latestVersion.id
                        ? '⟳ Starting...'
                        : '↺ Retrain'
                      }
                    </button>
                  </div>

                  {group.versions.map((d, i) => (
                    <div
                      key={d.id}
                      style={{
                        borderBottom: i < group.versions.length - 1
                          ? '1px solid var(--border)'
                          : 'none'
                      }}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          style={{
                            backgroundColor: 'rgba(99,102,241,0.1)',
                            border: '1px solid rgba(99,102,241,0.2)',
                            color: '#A5B4FC',
                            fontSize: '10px',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          v{i + 1}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--text-3)' }} className="text-xs">
                              {formatSize(d.file_size)}
                            </span>

                            {d.row_count && (
                              <span style={{ color: 'var(--text-3)' }} className="text-xs">
                                · {d.row_count.toLocaleString()} rows
                              </span>
                            )}

                            {d.column_count && (
                              <span style={{ color: 'var(--text-3)' }} className="text-xs">
                                · {d.column_count} cols
                              </span>
                            )}
                          </div>

                          <p style={{ color: 'var(--text-4)' }} className="text-xs">
                            {timeAgo(d.created_at)}
                            {d.target_column && ` · target: ${d.target_column}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            backgroundColor: d.status === 'ready'
                              ? 'rgba(34,197,94,0.1)'
                              : 'rgba(245,158,11,0.1)',
                            color: d.status === 'ready' ? '#22C55E' : '#F59E0B',
                            border: `1px solid ${
                              d.status === 'ready'
                                ? 'rgba(34,197,94,0.3)'
                                : 'rgba(245,158,11,0.3)'
                            }`,
                            fontSize: '10px',
                            padding: '2px 8px',
                            borderRadius: '20px',
                          }}
                        >
                          {d.status}
                        </span>

                        <button
                          onClick={() => handleDelete(d.id)}
                          disabled={deleting === d.id}
                          style={{
                            color: '#EF4444',
                            border: '1px solid rgba(239,68,68,0.2)',
                          }}
                          className="text-xs px-2 py-1 rounded-lg hover:border-red-500 transition-all disabled:opacity-50"
                        >
                          {deleting === d.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}