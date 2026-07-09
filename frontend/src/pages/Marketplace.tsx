import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface MarketplaceModel {
  id:           number
  name:         string
  model_name:   string
  problem_type: string
  accuracy:     number | null
  features:     string[]
  target_column:string
  call_count:   number
  owner:        string
  description:  string
  endpoint:     string
  created_at:   string
}

export default function Marketplace() {
  const [models, setModels]         = useState<MarketplaceModel[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [creatingId, setCreatingId] = useState<number | null>(null)
  const [copiedId, setCopiedId]     = useState<number | null>(null)
  const [generatedKeys, setGeneratedKeys] = useState<Record<number, {
    key: string | null
    preview: string
    message: string
  }>>({})

  useEffect(() => {
    api.get('/marketplace/')
      .then(r => setModels(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleUseApi(modelId: number) {
    setCreatingId(modelId)
    try {
      const res = await api.post('/marketplace/keys', { deployed_model_id: modelId })
      setGeneratedKeys(prev => ({
        ...prev,
        [modelId]: {
          key: res.data.api_key,
          preview: res.data.api_key_preview,
          message: res.data.message,
        },
      }))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not create API key')
    } finally {
      setCreatingId(null)
    }
  }

  function copyKey(id: number, key: string) {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = models.filter(m => {
    const matchSearch = search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.model_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || m.problem_type === filter
    return matchSearch && matchFilter
  })

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-6xl animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Marketplace
          </h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">
            Discover and use publicly available ML models
          </p>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models..."
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none placeholder-gray-600"
          />
          {['all', 'classification', 'regression'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={filter === f ? {
                background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                color: 'white',
              } : {
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-3)',
              }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition-all"
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-8">
            <span className="animate-spin" style={{ color: '#6366F1' }}>⟳</span>
            <p style={{ color: 'var(--text-3)' }}>Loading marketplace...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">🛒</div>
            <h3 style={{ color: 'var(--text-1)' }} className="text-lg font-semibold mb-2">
              No models found
            </h3>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              {models.length === 0
                ? 'No models have been deployed yet. Be the first!'
                : 'Try a different search term'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((m) => (
              <div
                key={m.id}
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                className="rounded-xl overflow-hidden hover:border-gray-600 transition-all"
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p style={{ color: 'var(--text-1)' }} className="font-semibold mb-0.5">
                        {m.name}
                      </p>
                      <p style={{ color: 'var(--text-4)' }} className="text-xs">
                        by {m.owner}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{
                        backgroundColor: m.problem_type === 'classification'
                          ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)',
                        color: m.problem_type === 'classification' ? '#A5B4FC' : '#93C5FD',
                        border: `1px solid ${m.problem_type === 'classification'
                          ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                      }}>
                        {m.problem_type}
                      </span>
                    </div>
                  </div>

                  {m.description && (
                    <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed mb-4">
                      {m.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Algorithm', value: m.model_name },
                      { label: 'Accuracy',  value: m.accuracy ? `${(m.accuracy * 100).toFixed(1)}%` : 'N/A' },
                      { label: 'API Calls', value: m.call_count.toString() },
                    ].map((stat, i) => (
                      <div key={i} style={{ backgroundColor: 'var(--surface-2)', borderRadius: '8px' }}
                        className="p-2.5">
                        <p style={{ color: 'var(--text-4)' }} className="text-xs mb-0.5">{stat.label}</p>
                        <p style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Features */}
                  <div className="mb-4">
                    <p style={{ color: 'var(--text-4)' }} className="text-xs mb-1.5">
                      Predicts: <strong style={{ color: 'var(--text-2)' }}>{m.target_column}</strong>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {m.features?.slice(0, 5).map((f, i) => (
                        <span key={i} style={{
                          backgroundColor: 'var(--border)',
                          color: 'var(--text-3)',
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {f}
                        </span>
                      ))}
                      {(m.features?.length || 0) > 5 && (
                        <span style={{ color: 'var(--text-4)', fontSize: '10px' }}>
                          +{m.features.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {generatedKeys[m.id] && (
                    <div
                      style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      className="rounded-lg p-3 mb-3"
                    >
                      <p style={{ color: 'var(--text-4)' }} className="text-xs mb-1">
                        Your API Key
                      </p>
                      <div className="flex items-center gap-2">
                        <code style={{ color: '#A5B4FC' }} className="text-xs flex-1 overflow-hidden">
                          {generatedKeys[m.id].key || `${generatedKeys[m.id].preview} (already created)`}
                        </code>
                        {generatedKeys[m.id].key && (
                          <button
                            onClick={() => copyKey(m.id, generatedKeys[m.id].key!)}
                            style={{
                              backgroundColor: copiedId === m.id ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                              border: `1px solid ${copiedId === m.id ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                              color: copiedId === m.id ? '#22C55E' : '#A5B4FC',
                            }}
                            className="text-xs px-3 py-1 rounded-lg"
                          >
                            {copiedId === m.id ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-4)' }} className="text-xs mt-2">
                        {generatedKeys[m.id].message}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => handleUseApi(m.id)}
                    disabled={creatingId === m.id}
                    style={{
                      backgroundColor: 'var(--border)',
                      border: '1px solid var(--border-2)',
                      color: 'var(--text-2)',
                    }}
                    className="w-full text-sm font-medium py-2 rounded-lg transition-all disabled:opacity-60"
                  >
                    {creatingId === m.id ? 'Creating key...' : 'Use API'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
