import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface DeployedModel {
  id:           number
  name:         string
  model_name:   string
  problem_type: string
  accuracy:     number | null
  call_count:   number
  api_key:      string | null
  api_key_preview?: string | null
  features:     string[]
  target_column:string
  created_at:   string
}

export default function APIs() {
  const [models, setModels]         = useState<DeployedModel[]>([])
  const [loading, setLoading]       = useState(true)
  const [copiedId, setCopiedId]     = useState<number | null>(null)
  const [revealedId, setRevealedId] = useState<number | null>(null)

  useEffect(() => {
    api.get('/deploy/models')
      .then(async (r) => {
        // Fetch api key for each model
        const modelsWithKeys = await Promise.all(
          r.data.map(async (m: any) => {
            try {
              const detail = await api.get(`/deploy/models/${m.id}`)
              return { ...m, api_key: detail.data.api_key, api_key_preview: detail.data.api_key_preview }
            } catch {
              return { ...m, api_key: null }
            }
          })
        )
        setModels(modelsWithKeys)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function copyKey(id: number, key: string) {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-5xl animate-fade-in">

        <div className="mb-8">
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Deployed APIs
          </h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">
            Your live model endpoints and API keys
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3">
            <span className="animate-spin" style={{ color: '#6366F1' }}>⟳</span>
            <p style={{ color: 'var(--text-3)' }}>Loading...</p>
          </div>
        ) : models.length === 0 ? (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h3 style={{ color: 'var(--text-1)' }} className="text-lg font-semibold mb-2">
              No deployed APIs yet
            </h3>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              Train a model and click "Deploy as API" to create your first endpoint
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {models.map((m) => (
              <div
                key={m.id}
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                className="rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div style={{ borderBottom: '1px solid var(--border)' }}
                  className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: '#22C55E',
                    }} />
                    <div>
                      <p style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                        {m.name}
                      </p>
                      <p style={{ color: 'var(--text-4)' }} className="text-xs">
                        {m.model_name} · {m.problem_type} ·{' '}
                        {m.accuracy ? `${(m.accuracy * 100).toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22C55E',
                    fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                  }}>
                    {m.call_count} calls
                  </div>
                </div>

                {/* API Key */}
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <p style={{ color: 'var(--text-4)' }} className="text-xs mb-1.5">API Key</p>
                    <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      className="rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                      <span style={{ color: '#A5B4FC' }} className="text-sm font-mono flex-1 overflow-hidden">
                        {revealedId === m.id
                          ? (m.api_key || `${m.api_key_preview || 'Hidden'} (shown only when first deployed)`)
                          : '•'.repeat(48)
                        }
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setRevealedId(revealedId === m.id ? null : m.id)}
                          style={{ color: 'var(--text-3)' }}
                          className="text-xs hover:text-gray-400"
                        >
                          {revealedId === m.id ? '🙈' : '👁'}
                        </button>
                        {m.api_key && (
                          <button
                            onClick={() => m.api_key && copyKey(m.id, m.api_key)}
                            style={{
                              backgroundColor: copiedId === m.id
                                ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                              border: `1px solid ${copiedId === m.id
                                ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                              color: copiedId === m.id ? '#22C55E' : '#A5B4FC',
                            }}
                            className="text-xs px-3 py-1 rounded-lg transition-all"
                          >
                            {copiedId === m.id ? '✓ Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Endpoint */}
                  <div>
                    <p style={{ color: 'var(--text-4)' }} className="text-xs mb-1.5">Endpoint</p>
                    <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      className="rounded-lg px-4 py-2.5">
                      <span style={{ color: 'var(--text-2)' }} className="text-xs font-mono">
                        POST http://localhost:8000/deploy/v1/predict?api_key={m.api_key ? `${m.api_key.slice(0, 20)}...` : '<your saved key>'}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <p style={{ color: 'var(--text-4)' }} className="text-xs mb-1.5">
                      Required features ({m.features?.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.features?.slice(0, 10).map((f, i) => (
                        <span key={i} style={{
                          backgroundColor: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-3)',
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {f}
                        </span>
                      ))}
                      {(m.features?.length || 0) > 10 && (
                        <span style={{ color: 'var(--text-4)' }} className="text-xs">
                          +{m.features.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
