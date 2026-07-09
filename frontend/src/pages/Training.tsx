import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface Job {
  id: number
  status: string
  progress: number
  stage: string
  logs: string[]
  result: any
  error: string | null
}

const STAGES = [
  { key: 'loading',     label: 'Loading data',            icon: '📂' },
  { key: 'cleaning',    label: 'Cleaning data',           icon: '🧹' },
  { key: 'engineering', label: 'Feature engineering',     icon: '⚙️'  },
  { key: 'training',    label: 'Training models',         icon: '🧠' },
  { key: 'tuning',      label: 'Hyperparameter tuning',   icon: '🔬' },
  { key: 'importance',  label: 'Feature importance',      icon: '📊' },
  { key: 'completed',   label: 'Complete',                icon: '🎉' },
]

function getStageIndex(stage: string) {
  return STAGES.findIndex(s => s.key === stage)
}

export default function Training() {
  const { jobId } = useParams()
  const navigate  = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId) return

    // Poll every 2 seconds
    const poll = async () => {
      try {
        const res = await api.get(`/datasets/jobs/${jobId}`)
        setJob(res.data)

        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(interval)
        }
      } catch (e) {
        setError('Failed to fetch job status')
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  if (error) return (
    <DashboardLayout>
      <div className="px-8 py-8">
        <p style={{ color: '#EF4444' }}>{error}</p>
      </div>
    </DashboardLayout>
  )

  if (!job) return (
    <DashboardLayout>
      <div className="px-8 py-8 flex items-center gap-3">
        <div className="animate-spin text-xl">⟳</div>
        <p style={{ color: 'var(--text-2)' }}>Loading job...</p>
      </div>
    </DashboardLayout>
  )

  const currentStageIdx = getStageIndex(job.stage)
  const isFailed    = job.status === 'failed'
  const isCompleted = job.status === 'completed'

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-5xl animate-fade-in">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
              {isCompleted ? 'Training Complete 🎉' : isFailed ? 'Training Failed ✗' : 'Training in Progress...'}
            </h1>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              Job #{jobId} · {isCompleted ? 'Finished' : isFailed ? 'Failed' : 'Running'}
            </p>
          </div>

          {isCompleted && (
            <button
              onClick={() => navigate(`/results/${jobId}`)}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="text-white font-semibold px-6 py-2.5 rounded-lg text-sm glow-hover"
            >
              View Results →
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: 'var(--text-2)' }} className="text-sm font-medium">
              Overall progress
            </span>
            <span style={{ color: 'var(--text-1)' }} className="text-sm font-mono font-semibold">
              {job.progress}%
            </span>
          </div>
          <div style={{ backgroundColor: 'var(--border)' }} className="w-full rounded-full h-2 mb-6">
            <div
              style={{
                background: isFailed
                  ? '#EF4444'
                  : isCompleted
                  ? '#22C55E'
                  : 'linear-gradient(135deg, #3B82F6, #6366F1)',
                width: `${job.progress}%`,
                transition: 'width 0.5s ease',
              }}
              className="h-2 rounded-full"
            />
          </div>

          {/* Pipeline stages */}
          <div className="grid grid-cols-7 gap-1">
            {STAGES.map((stage, idx) => {
              const isDone    = idx < currentStageIdx
              const isCurrent = idx === currentStageIdx
              

              return (
                <div key={stage.key} className="flex flex-col items-center gap-1.5">
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      backgroundColor: isDone
                        ? 'rgba(34,197,94,0.15)'
                        : isCurrent
                        ? 'rgba(99,102,241,0.2)'
                        : 'var(--border)',
                      border: isDone
                        ? '1px solid rgba(34,197,94,0.4)'
                        : isCurrent
                        ? '1px solid rgba(99,102,241,0.5)'
                        : '1px solid var(--border-2)',
                    }}
                    className={isCurrent ? 'animate-pulse-slow' : ''}
                  >
                    {isDone ? '✓' : stage.icon}
                  </div>
                  <span
                    style={{
                      color: isDone ? '#22C55E' : isCurrent ? '#A5B4FC' : 'var(--text-4)',
                      fontSize: '9px',
                      textAlign: 'center',
                      lineHeight: '1.2',
                    }}
                  >
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Logs */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-xl overflow-hidden">
          <div style={{ borderBottom: '1px solid var(--border)' }}
            className="px-5 py-3.5 flex items-center gap-2">
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: isCompleted ? '#22C55E' : isFailed ? '#EF4444' : '#6366F1',
            }}
              className={(!isCompleted && !isFailed) ? 'animate-pulse' : ''}
            />
            <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
              Live logs
            </h2>
          </div>

          <div
            style={{ backgroundColor: 'var(--surface-2)', maxHeight: '400px', overflowY: 'auto' }}
            className="p-5 font-mono text-xs space-y-1.5"
          >
            {job.logs && job.logs.length > 0 ? (
              job.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span style={{ color: 'var(--border-2)' }} className="shrink-0 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{
                    color: log.includes('✓') || log.includes('🎉') ? '#22C55E'
                         : log.includes('✗') || log.includes('failed') ? '#EF4444'
                         : log.includes('🏆') ? '#F59E0B'
                         : log.includes('⟳') ? '#6366F1'
                         : 'var(--text-2)'
                  }}>
                    {log}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--border-2)' }}>Waiting for logs...</span>
            )}

            {/* Live indicator */}
            {!isCompleted && !isFailed && (
              <div className="flex items-center gap-2 pt-1">
                <span style={{ color: 'var(--border-2)' }}>──</span>
                <span style={{ color: '#6366F1' }} className="animate-pulse">
                  training...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {isFailed && job.error && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
          }} className="rounded-xl p-5 mt-6">
            <p style={{ color: '#FCA5A5' }} className="text-sm font-mono">{job.error}</p>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}