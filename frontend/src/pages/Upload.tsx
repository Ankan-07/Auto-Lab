import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface ParsedData {
  headers:   string[]
  rows:      string[][]
  totalRows: number
}

interface CacheResult {
  job_id:        number
  dataset_id:    number
  cache_message: string
}

export default function Upload() {
  const navigate     = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile]             = useState<File | null>(null)
  const [parsed, setParsed]         = useState<ParsedData | null>(null)
  const [targetColumn, setTarget]   = useState('')
  const [dragging, setDragging]     = useState(false)
  const [error, setError]           = useState('')
  const [uploading, setUploading]   = useState(false)
  const [cacheResult, setCacheResult] = useState<CacheResult | null>(null)

  const ALLOWED = ['.csv', '.xlsx', '.xls', '.json', '.parquet', '.tsv']

  function parseFile(f: File) {
    setError('')
    setFile(null)
    setParsed(null)
    setTarget('')
    setCacheResult(null)

    if (!ALLOWED.some(ext => f.name.toLowerCase().endsWith(ext))) {
      setError(`Unsupported file. Allowed: ${ALLOWED.join(', ')}`)
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum 50MB')
      return
    }

    if (f.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(f, {
        complete: (results) => {
          const allRows = results.data as string[][]
          const headers = allRows[0]
          const dataRows = allRows.slice(1).filter(r => r.some(c => c !== ''))
          if (!headers || headers.length === 0) {
            setError('CSV appears to be empty')
            return
          }
          setParsed({ headers, rows: dataRows.slice(0, 5), totalRows: dataRows.length })
          setFile(f)
          setTarget(headers[headers.length - 1])
        },
        error: () => setError('Failed to parse CSV'),
      })
    } else {
      setFile(f)
      setParsed({ headers: [], rows: [], totalRows: 0 })
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }, [])

  async function handleUpload(forceRetrain = false) {
    if (!file || !targetColumn) return
    setUploading(true)
    setError('')
    setCacheResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('target_column', targetColumn)
      if (forceRetrain) {
        formData.append('force_retrain', 'true')
      }

      const res = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (res.data.cached && !forceRetrain) {
        // Show cache prompt
        setCacheResult({
          job_id:        res.data.job_id,
          dataset_id:    res.data.dataset.id,
          cache_message: res.data.cache_message,
        })
        setUploading(false)
        return
      }

      navigate(`/jobs/${res.data.job_id}`)

    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Upload failed'
      setError(detail)
    } finally {
      setUploading(false)
    }
  }

  async function handleForceRetrain() {
    if (!cacheResult) return
    setUploading(true)
    try {
      const res = await api.post(`/datasets/${cacheResult.dataset_id}/retrain`)
      navigate(`/jobs/${res.data.job_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Retrain failed')
    } finally {
      setUploading(false)
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const isNonCSV = file && !file.name.toLowerCase().endsWith('.csv')

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-4xl animate-fade-in">

        <div className="mb-8">
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Upload Dataset
          </h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">
            Supports CSV, Excel, JSON, Parquet, TSV — up to 50MB
          </p>
        </div>

        {/* Cache found prompt */}
        {cacheResult && (
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid rgba(99,102,241,0.4)',
          }} className="rounded-2xl p-6 mb-6 animate-fade-in">
            <div className="flex items-start gap-4 mb-5">
              <span className="text-3xl">⚡</span>
              <div>
                <h3 style={{ color: 'var(--text-1)' }} className="font-semibold mb-1">
                  Existing model found!
                </h3>
                <p style={{ color: 'var(--text-3)' }} className="text-sm leading-relaxed">
                  {cacheResult.cache_message}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/results/${cacheResult.job_id}`)}
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                className="flex-1 text-white font-semibold py-2.5 rounded-lg text-sm glow-hover"
              >
                View Existing Results →
              </button>
              <button
                onClick={handleForceRetrain}
                disabled={uploading}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                }}
                className="flex-1 font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50"
              >
                {uploading ? '⟳ Starting...' : '↺ Force Retrain'}
              </button>
            </div>
          </div>
        )}

        {/* Drop zone */}
        {!cacheResult && (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={{
                backgroundColor: dragging
                  ? 'rgba(99,102,241,0.08)' : 'var(--surface)',
                border: `2px dashed ${dragging ? '#6366F1' : file ? '#22C55E' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
              className="rounded-2xl p-12 text-center mb-6 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json,.parquet,.tsv"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }}
                className="hidden"
              />

              {file ? (
                <div>
                  <div style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    width: '56px', height: '56px', borderRadius: '16px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '24px',
                    margin: '0 auto 16px',
                  }}>✅</div>
                  <p style={{ color: 'var(--text-1)' }} className="font-semibold text-lg mb-1">
                    {file.name}
                  </p>
                  <p style={{ color: 'var(--text-3)' }} className="text-sm">
                    {formatSize(file.size)}
                    {parsed?.totalRows ? ` · ${parsed.totalRows.toLocaleString()} rows · ${parsed.headers.length} cols` : ''}
                  </p>
                  <p style={{ color: 'var(--text-4)' }} className="text-xs mt-2">
                    Click to choose different file
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                    border: '1px solid rgba(99,102,241,0.2)',
                    width: '56px', height: '56px', borderRadius: '16px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '24px',
                    margin: '0 auto 16px',
                  }}>📂</div>
                  <p style={{ color: 'var(--text-1)' }} className="font-semibold text-lg mb-1">
                    Drop your file here
                  </p>
                  <p style={{ color: 'var(--text-3)' }} className="text-sm mb-3">
                    or click to browse
                  </p>
                  <span style={{
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    color: '#A5B4FC', fontSize: '12px',
                    padding: '4px 12px', borderRadius: '20px',
                  }}>
                    CSV · Excel · JSON · Parquet · TSV
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5',
              }} className="px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            {isNonCSV && (
              <div style={{
                backgroundColor: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#FCD34D',
              }} className="px-4 py-3 rounded-lg mb-6 text-sm">
                ℹ️ Preview not available for {file?.name.split('.').pop()?.toUpperCase()} files.
                Enter your target column name below.
              </div>
            )}

            {file && (
              <div className="space-y-6 animate-fade-in">
                {/* CSV Preview */}
                {!isNonCSV && parsed && parsed.headers.length > 0 && (
                  <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                    className="rounded-xl overflow-hidden">
                    <div style={{ borderBottom: '1px solid var(--border)' }}
                      className="px-5 py-3.5 flex items-center justify-between">
                      <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                        Preview
                      </h2>
                      <span style={{ color: 'var(--text-4)' }} className="text-xs font-mono">
                        {parsed.rows.length} of {parsed.totalRows.toLocaleString()} rows
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                            {parsed.headers.map((h, i) => (
                              <th key={i} style={{
                                color: h === targetColumn ? '#A5B4FC' : 'var(--text-3)',
                                borderRight: '1px solid var(--border)',
                                padding: '10px 16px', textAlign: 'left',
                                fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
                                whiteSpace: 'nowrap',
                              }}>
                                {h}
                                {h === targetColumn && (
                                  <span style={{
                                    backgroundColor: 'rgba(99,102,241,0.2)',
                                    color: '#A5B4FC', fontSize: '9px',
                                    padding: '1px 5px', borderRadius: '20px', marginLeft: '6px',
                                  }}>target</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.rows.map((row, i) => (
                            <tr key={i} style={{
                              borderBottom: i < parsed.rows.length - 1
                                ? '1px solid var(--border)' : 'none'
                            }}>
                              {row.map((cell, j) => (
                                <td key={j} style={{
                                  color: parsed.headers[j] === targetColumn
                                    ? '#C7D2FE' : 'var(--text-2)',
                                  borderRight: '1px solid var(--border)',
                                  padding: '10px 16px',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontSize: '11px', whiteSpace: 'nowrap',
                                }}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Target selector */}
                <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                  className="rounded-xl p-5">
                  <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
                    Target column
                  </h2>
                  <p style={{ color: 'var(--text-3)' }} className="text-xs mb-4">
                    Which column do you want to predict?
                  </p>

                  {!isNonCSV && parsed?.headers.length ? (
                    <div className="flex flex-wrap gap-2">
                      {parsed.headers.map(col => (
                        <button
                          key={col}
                          onClick={() => setTarget(col)}
                          style={targetColumn === col ? {
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',
                            border: '1px solid rgba(99,102,241,0.5)',
                            color: '#A5B4FC',
                          } : {
                            backgroundColor: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-3)',
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={targetColumn}
                      onChange={e => setTarget(e.target.value)}
                      placeholder="Enter exact column name..."
                      style={{
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-1)',
                      }}
                      className="w-full rounded-lg px-4 py-2.5 text-sm font-mono outline-none"
                    />
                  )}
                </div>

                <button
                  onClick={() => handleUpload(false)}
                  disabled={uploading || !targetColumn}
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                  className="w-full text-white font-semibold py-3 rounded-xl glow-hover disabled:opacity-50 text-sm"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⟳</span>
                      Uploading...
                    </span>
                  ) : '🚀 Upload and Start Training'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}