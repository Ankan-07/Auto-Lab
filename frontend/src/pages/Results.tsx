import { Fragment, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface Metrics {
  accuracy?:  number
  f1_score?:  number
  precision?: number
  recall?:    number
  r2_score?:  number
  rmse?:      number
  mae?:       number
  confusion_matrix?: number[][]
  confusion_labels?: string[]
}

interface ModelResult {
  model_name:    string
  metrics:       Metrics
  primary_score: number
  tuned:         boolean
  best_params?:  Record<string, any>
}

interface FeatureImportance {
  feature:    string
  importance: number
}

interface ShapSummary {
  feature:       string
  mean_shap:     number
  sample_values: number[]
}

interface Results {
  problem_type:        string
  best_model:          string
  best_metrics:        Metrics
  all_models:          ModelResult[]
  feature_importance:  FeatureImportance[]
  shap_summary:        ShapSummary[]
  dataset_size:        number
  cleaning_report?:    Record<string, any>
  engineering_report?: Record<string, any>
}

function rateMetric(value: number, metricKey: string): { label: string; color: string } {
  if (['rmse', 'mae'].includes(metricKey)) {
    return { label: 'lower is better', color: 'var(--text-3)' }
  }
  if (value >= 0.95) return { label: 'Excellent', color: '#22C55E' }
  if (value >= 0.90) return { label: 'Very Good', color: '#22C55E' }
  if (value >= 0.80) return { label: 'Good', color: '#6366F1' }
  if (value >= 0.70) return { label: 'Fair', color: '#F59E0B' }
  return { label: 'Needs Work', color: '#EF4444' }
}

function getDescription(metricKey: string, value: number): string {
  if (value === undefined || value === null) return 'Not available'
  const pct = (value * 100).toFixed(2)

  switch (metricKey) {
    case 'accuracy':
      return `Correctly predicts ${pct}% of cases. Out of 100 predictions, ${Math.round(value * 100)} will be right.`
    case 'f1_score':
      return `Balances precision and recall. ${pct}% means the model handles false positives and false negatives well.`
    case 'precision':
      return `When model predicts positive, it's correct ${pct}% of the time. Measures false alarm rate.`
    case 'recall':
      return `Catches ${pct}% of all actual positive cases. Measures how many real positives are found.`
    case 'r2_score':
      return `Explains ${pct}% of the variance in your target. Closer to 100% is better.`
    case 'rmse':
      return `Average prediction error is ${value.toFixed(4)} units. Lower means more accurate predictions.`
    case 'mae':
      return `Typical prediction is off by ${value.toFixed(4)} units from the real value.`
    default:
      return ''
  }
}

function getOverallVerdict(primaryScore: number): {
  title: string
  color: string
  bg: string
  border: string
  message: string
} {
  if (primaryScore >= 0.99) {
    return {
      title: '⚠️ Possible Overfitting',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.3)',
      message: `${(primaryScore * 100).toFixed(2)}% accuracy is suspiciously high. This may indicate overfitting — the model memorized training data instead of learning patterns. Test on completely new real-world data before deploying.`
    }
  }

  if (primaryScore >= 0.95) {
    return {
      title: '🏆 Exceptional Model',
      color: '#22C55E',
      bg: 'rgba(34,197,94,0.08)',
      border: 'rgba(34,197,94,0.3)',
      message: `${(primaryScore * 100).toFixed(2)}% — top-tier performance. Production-ready for high-stakes decisions.`
    }
  }

  if (primaryScore >= 0.90) {
    return {
      title: '✅ Strong Model',
      color: '#6366F1',
      bg: 'rgba(99,102,241,0.08)',
      border: 'rgba(99,102,241,0.3)',
      message: `${(primaryScore * 100).toFixed(2)}% is strong performance. Production-ready for most business use cases.`
    }
  }

  if (primaryScore >= 0.80) {
    return {
      title: '👍 Good Model',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.08)',
      border: 'rgba(59,130,246,0.3)',
      message: `${(primaryScore * 100).toFixed(2)}% is solid. Works well for most applications, may benefit from more data.`
    }
  }

  if (primaryScore >= 0.70) {
    return {
      title: '⚠️ Fair Model',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.3)',
      message: `${(primaryScore * 100).toFixed(2)}% is acceptable but has room for improvement. Consider adding more data or features.`
    }
  }

  return {
    title: '❌ Needs Improvement',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    message: `${(primaryScore * 100).toFixed(2)}% suggests the model is struggling. Try more data or check your target column.`
  }
}

export default function Results() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedModel, setExpandedModel] = useState<number | null>(null)
  const [isDeployed, setIsDeployed] = useState(false)

  useEffect(() => {
    if (!jobId) return

    api.get(`/datasets/jobs/${jobId}/results`)
      .then(r => {
        setResults(r.data)
      })
      .catch(() => setError('Failed to load results'))
      .finally(() => setLoading(false))
  }, [jobId])

  useEffect(() => {
    if (!jobId) return

    api.get('/deploy/models')
      .then(r => {
        const found = r.data.find((m: any) => m.job_id === parseInt(jobId))
        if (found) setIsDeployed(true)
      })
      .catch(() => {})
  }, [jobId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="px-8 py-8 flex items-center gap-3">
          <span className="animate-spin text-xl" style={{ color: '#6366F1' }}>⟳</span>
          <p style={{ color: 'var(--text-2)' }}>Loading results...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !results) {
    return (
      <DashboardLayout>
        <div className="px-8 py-8">
          <p style={{ color: '#EF4444' }}>{error || 'No results found'}</p>
        </div>
      </DashboardLayout>
    )
  }

  const isClassification = results.problem_type === 'classification'

  const primaryScore = isClassification
    ? (results.best_metrics?.accuracy ?? 0)
    : (results.best_metrics?.r2_score ?? 0)

  const primaryLabel = isClassification ? 'Accuracy' : 'R² Score'

  const maxImportance = Math.max(...(results.feature_importance?.map(f => f.importance) ?? [1]))
  const confusionMatrix = results.best_metrics?.confusion_matrix
  const confusionLabels = results.best_metrics?.confusion_labels || []

  const maxShap = results.shap_summary?.length > 0
    ? Math.abs(results.shap_summary[0].mean_shap)
    : 1

  const verdict = getOverallVerdict(primaryScore)

  const metricsList = isClassification
    ? [
        { key: 'accuracy', label: 'Accuracy', value: results.best_metrics?.accuracy, color: '#6366F1', isPercent: true },
        { key: 'f1_score', label: 'F1 Score', value: results.best_metrics?.f1_score, color: '#3B82F6', isPercent: true },
        { key: 'precision', label: 'Precision', value: results.best_metrics?.precision, color: '#8B5CF6', isPercent: true },
        { key: 'recall', label: 'Recall', value: results.best_metrics?.recall, color: '#22C55E', isPercent: true },
      ]
    : [
        { key: 'r2_score', label: 'R² Score', value: results.best_metrics?.r2_score, color: '#6366F1', isPercent: true },
        { key: 'rmse', label: 'RMSE', value: results.best_metrics?.rmse, color: '#EF4444', isPercent: false },
        { key: 'mae', label: 'MAE', value: results.best_metrics?.mae, color: '#F59E0B', isPercent: false },
      ]

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-6xl animate-fade-in">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ color: 'var(--text-3)' }}
              className="text-sm hover:text-gray-400 transition-all mb-2 block"
            >
              ← Dashboard
            </button>

            <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
              Training Results
            </h1>

            <p style={{ color: 'var(--text-3)' }} className="text-sm">
              Job #{jobId} · {results.problem_type} ·{' '}
              {results.dataset_size?.toLocaleString()} rows ·{' '}
              {results.all_models?.length} models trained
            </p>
          </div>

          <div
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
            className="px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22C55E'
              }}
            />
            <span style={{ color: '#22C55E' }} className="text-sm font-medium">
              Completed
            </span>
          </div>
        </div>

        {/* Verdict card */}
        <div
          style={{
            backgroundColor: verdict.bg,
            border: `1px solid ${verdict.border}`
          }}
          className="rounded-2xl p-5 mb-6"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 style={{ color: verdict.color }} className="text-lg font-semibold mb-1">
                {verdict.title}
              </h2>

              <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed max-w-2xl">
                {verdict.message}
              </p>
            </div>

            <div className="text-right">
              <p style={{ color: 'var(--text-3)' }} className="text-xs uppercase tracking-widest mb-1">
                {primaryLabel}
              </p>

              <p
                style={{
                  color: verdict.color,
                  fontSize: '40px',
                  fontWeight: '700',
                  lineHeight: 1
                }}
                className="font-mono"
              >
                {(primaryScore * 100).toFixed(2)}%
              </p>

              <p style={{ color: verdict.color }} className="text-xs font-medium mt-1">
                {rateMetric(primaryScore, isClassification ? 'accuracy' : 'r2_score').label}
              </p>
            </div>
          </div>
        </div>

        {/* Best model row */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.08))',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
          className="rounded-xl px-5 py-4 mb-6 flex items-center gap-4"
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
          >
            🏆
          </div>

          <div>
            <p style={{ color: 'var(--text-3)' }} className="text-xs mb-0.5">
              Best performing algorithm
            </p>
            <p style={{ color: 'var(--text-1)' }} className="text-lg font-semibold">
              {results.best_model}
            </p>
          </div>

          {results.all_models?.[0]?.tuned && (
            <span
              style={{
                backgroundColor: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#A5B4FC',
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '20px',
              }}
            >
              hyperparameter tuned ✓
            </span>
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metricsList.map((m) => (
            <MetricCard
              key={m.key}
              label={m.label}
              value={m.value}
              color={m.color}
              isPercent={m.isPercent}
              metricKey={m.key}
            />
          ))}
        </div>

        {isClassification && confusionMatrix && confusionMatrix.length > 0 && (
          <div
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl overflow-hidden mb-8"
          >
            <div style={{ borderBottom: '1px solid var(--border)' }} className="px-5 py-4">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-0.5">
                Confusion Matrix
              </h3>
              <p style={{ color: 'var(--text-4)' }} className="text-xs">
                Actual classes by predicted classes
              </p>
            </div>
            <div className="p-5 overflow-x-auto">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `120px repeat(${confusionMatrix.length}, minmax(72px, 1fr))` }}
              >
                <div />
                {confusionLabels.map((label, i) => (
                  <div key={`pred-${i}`} style={{ color: 'var(--text-3)' }} className="text-xs text-center">
                    Pred {label}
                  </div>
                ))}
                {confusionMatrix.map((row, rowIndex) => (
                  <Fragment key={`row-${rowIndex}`}>
                    <div key={`actual-${rowIndex}`} style={{ color: 'var(--text-3)' }} className="text-xs flex items-center">
                      Actual {confusionLabels[rowIndex] ?? rowIndex}
                    </div>
                    {row.map((value, colIndex) => {
                      const rowMax = Math.max(...row, 1)
                      const intensity = value / rowMax
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          style={{
                            backgroundColor: rowIndex === colIndex
                              ? `rgba(34,197,94,${0.12 + intensity * 0.28})`
                              : `rgba(239,68,68,${0.08 + intensity * 0.22})`,
                            border: `1px solid ${rowIndex === colIndex ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.22)'}`,
                            color: 'var(--text-1)',
                          }}
                          className="rounded-lg min-h-12 flex items-center justify-center text-sm font-mono font-semibold"
                        >
                          {value}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feature importance + Model comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Feature Importance */}
          <div
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl overflow-hidden"
          >
            <div style={{ borderBottom: '1px solid var(--border)' }} className="px-5 py-4">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-0.5">
                Feature Importance
              </h3>
              <p style={{ color: 'var(--text-4)' }} className="text-xs">
                What matters most to the model overall
              </p>
            </div>

            <div className="p-5 space-y-4">
              {results.feature_importance?.slice(0, 8).map((f, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {i < 3 && (
                        <span style={{ color: '#F59E0B', fontSize: '10px' }}>
                          {i === 0 ? '①' : i === 1 ? '②' : '③'}
                        </span>
                      )}

                      <span style={{ color: 'var(--text-2)' }} className="text-xs font-mono">
                        {f.feature}
                      </span>
                    </div>

                    <span style={{ color: 'var(--text-3)' }} className="text-xs font-mono">
                      {(f.importance * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div style={{ backgroundColor: 'var(--border)' }} className="w-full rounded-full h-1.5">
                    <div
                      style={{
                        width: `${(f.importance / maxImportance) * 100}%`,
                        background: i === 0
                          ? 'linear-gradient(135deg, #3B82F6, #6366F1)'
                          : i === 1
                            ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                            : 'var(--border-2)',
                        transition: 'width 0.8s ease',
                      }}
                      className="h-1.5 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Comparison */}
          <div
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl overflow-hidden"
          >
            <div style={{ borderBottom: '1px solid var(--border)' }} className="px-5 py-4">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-0.5">
                All Models Ranked
              </h3>
              <p style={{ color: 'var(--text-4)' }} className="text-xs">
                {results.all_models?.length} algorithms compared
              </p>
            </div>

            <div>
              {results.all_models?.map((m, i) => (
                <div key={i}>
                  <div
                    onClick={() => setExpandedModel(expandedModel === i ? null : i)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          color: i === 0 ? '#F59E0B' : 'var(--text-4)',
                          fontSize: '12px',
                          fontWeight: '600',
                          width: '24px',
                        }}
                      >
                        {i === 0 ? '🏆' : `#${i + 1}`}
                      </span>

                      <div>
                        <p style={{ color: 'var(--text-1)' }} className="text-sm font-medium">
                          {m.model_name}
                        </p>

                        {m.tuned && (
                          <span
                            style={{
                              backgroundColor: 'rgba(99,102,241,0.1)',
                              color: '#A5B4FC',
                              border: '1px solid rgba(99,102,241,0.2)',
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '20px',
                            }}
                          >
                            tuned
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p
                          style={{ color: i === 0 ? '#A5B4FC' : 'var(--text-1)' }}
                          className="text-sm font-mono font-semibold"
                        >
                          {(m.primary_score * 100).toFixed(2)}%
                        </p>

                        <p style={{ color: 'var(--text-4)' }} className="text-xs">
                          {isClassification ? 'accuracy' : 'R²'}
                        </p>
                      </div>

                      <span style={{ color: 'var(--text-4)', fontSize: '10px' }}>
                        {expandedModel === i ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {expandedModel === i && (
                    <div
                      style={{
                        backgroundColor: 'var(--surface-2)',
                        borderBottom: '1px solid var(--border)'
                      }}
                      className="px-5 py-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(m.metrics).map(([key, val]) => (
                          <div key={key}>
                            <p style={{ color: 'var(--text-4)' }} className="text-xs mb-0.5 capitalize">
                              {key.replace('_', ' ')}
                            </p>

                            <p style={{ color: 'var(--text-2)' }} className="text-sm font-mono">
                              {typeof val === 'number'
                                ? !['rmse', 'mae'].includes(key)
                                  ? `${(val * 100).toFixed(2)}%`
                                  : val.toFixed(4)
                                : String(val)
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SHAP Section */}
        {results.shap_summary && results.shap_summary.length > 0 && (
          <div
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl overflow-hidden mb-8"
          >
            <div style={{ borderBottom: '1px solid var(--border)' }} className="px-5 py-4">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-0.5">
                SHAP Explainability
              </h3>

              <p style={{ color: 'var(--text-4)' }} className="text-xs leading-relaxed">
                Feature importance tells you WHAT matters. SHAP tells you HOW —
                does this feature push predictions up (purple) or down (red)?
                Per-prediction SHAP is available in the deployment tester.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {results.shap_summary.slice(0, 8).map((s, i) => {
                const isPositive = s.mean_shap >= 0
                const absVal = Math.abs(s.mean_shap)
                const barWidth = `${(absVal / maxShap) * 100}%`

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            color: isPositive ? '#6366F1' : '#EF4444',
                            fontSize: '10px',
                            fontWeight: '700',
                            width: '12px',
                          }}
                        >
                          {isPositive ? '+' : '−'}
                        </span>

                        <span style={{ color: 'var(--text-2)' }} className="text-xs font-mono">
                          {s.feature}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            color: isPositive ? '#A5B4FC' : '#FCA5A5',
                            fontSize: '11px',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {isPositive ? '+' : ''}
                          {s.mean_shap.toFixed(4)}
                        </span>

                        <span
                          style={{
                            backgroundColor: isPositive ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)',
                            color: isPositive ? '#A5B4FC' : '#FCA5A5',
                            border: `1px solid ${isPositive ? 'rgba(99,102,241,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            fontSize: '9px',
                            padding: '1px 6px',
                            borderRadius: '20px',
                          }}
                        >
                          {isPositive ? '↑ increases' : '↓ decreases'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                        {!isPositive && (
                          <div
                            style={{
                              height: '6px',
                              width: barWidth,
                              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                              borderRadius: '3px 0 0 3px',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-2)' }} />

                      <div style={{ width: '50%' }}>
                        {isPositive && (
                          <div
                            style={{
                              height: '6px',
                              width: barWidth,
                              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                              borderRadius: '0 3px 3px 0',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              <div
                className="flex items-center gap-6 mt-4 pt-4"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: '24px',
                      height: '6px',
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      borderRadius: '3px',
                    }}
                  />
                  <span style={{ color: 'var(--text-3)' }} className="text-xs">
                    Pushes prediction higher
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: '24px',
                      height: '6px',
                      background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                      borderRadius: '3px',
                    }}
                  />
                  <span style={{ color: 'var(--text-3)' }} className="text-xs">
                    Pushes prediction lower
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plain English Explanation */}
        <div
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-xl p-6 mb-6"
        >
          <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
            📖 Plain English Explanation
          </h3>

          <p style={{ color: 'var(--text-4)' }} className="text-xs mb-5">
            What your results mean in simple terms
          </p>

          <div className="space-y-4">
            <div style={{ borderLeft: '2px solid #6366F1' }} className="pl-4">
              <p style={{ color: 'var(--text-3)' }} className="text-xs font-medium uppercase tracking-wide mb-1">
                What happened
              </p>

              <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed">
                Your <strong style={{ color: 'var(--text-1)' }}>{results.dataset_size?.toLocaleString()}-row</strong> dataset
                was processed through 5 AI agents — cleaning, feature engineering, training, tuning, and explanation.{' '}
                <strong style={{ color: 'var(--text-1)' }}>{results.all_models?.length} different algorithms</strong> competed,
                and <strong style={{ color: '#A5B4FC' }}>{results.best_model}</strong> won.
              </p>
            </div>

            <div style={{ borderLeft: `2px solid ${verdict.color}` }} className="pl-4">
              <p style={{ color: 'var(--text-3)' }} className="text-xs font-medium uppercase tracking-wide mb-1">
                Is this result good?
              </p>

              <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed">
                <strong style={{ color: verdict.color }}>
                  {verdict.title.replace(/[🏆✅👍⚠️❌]/g, '').trim()}
                </strong>{' '}
                — {verdict.message}
              </p>
            </div>

            {results.feature_importance?.length > 0 && (
              <div style={{ borderLeft: '2px solid #F59E0B' }} className="pl-4">
                <p style={{ color: 'var(--text-3)' }} className="text-xs font-medium uppercase tracking-wide mb-1">
                  What drives predictions
                </p>

                <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed">
                  The most important factor is{' '}
                  <strong style={{ color: 'var(--text-1)' }}>
                    {results.feature_importance[0]?.feature}
                  </strong>{' '}
                  ({(results.feature_importance[0]?.importance * 100).toFixed(2)}% importance).

                  {results.feature_importance[1] && (
                    <>
                      {' '}Followed by{' '}
                      <strong style={{ color: 'var(--text-1)' }}>
                        {results.feature_importance[1]?.feature}
                      </strong>

                      {results.feature_importance[2] && (
                        <>
                          {' '}and{' '}
                          <strong style={{ color: 'var(--text-1)' }}>
                            {results.feature_importance[2]?.feature}
                          </strong>
                        </>
                      )}
                      .
                    </>
                  )}

                  {' '}Focus on these if you want to improve accuracy further.
                </p>
              </div>
            )}

            <div style={{ borderLeft: '2px solid #22C55E' }} className="pl-4">
              <p style={{ color: 'var(--text-3)' }} className="text-xs font-medium uppercase tracking-wide mb-1">
                What to do next
              </p>

              <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed">
                {primaryScore >= 0.85
                  ? isDeployed
                    ? 'Your model is already deployed. Click "View API" to see the live endpoint.'
                    : 'Your model is ready to deploy. Click "Deploy as API" to get a live endpoint.'
                  : primaryScore >= 0.70
                    ? 'Your model is usable. To improve: collect more data, add features, or remove irrelevant columns.'
                    : 'This model needs improvement before deployment. Try: more training data, better features, or check your target column.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 flex-wrap">
          {isDeployed ? (
            <button
              onClick={() => navigate('/apis')}
              style={{
                backgroundColor: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#22C55E',
              }}
              className="font-semibold px-6 py-3 rounded-xl text-sm transition-all"
            >
              ✓ Already Deployed — View API
            </button>
          ) : (
            <button
              onClick={() => navigate(`/deploy/${jobId}`)}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="text-white font-semibold px-6 py-3 rounded-xl text-sm glow-hover transition-all"
            >
              🚀 Deploy as API
            </button>
          )}

          <button
            onClick={() => navigate(`/jobs/${jobId}`)}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)'
            }}
            className="font-semibold px-6 py-3 rounded-xl text-sm hover:border-gray-500 transition-all"
          >
            View Training Logs
          </button>

          <button
            onClick={() => navigate('/upload')}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)'
            }}
            className="font-semibold px-6 py-3 rounded-xl text-sm hover:border-gray-500 transition-all"
          >
            Upload New Dataset
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}

function MetricCard({
  label,
  value,
  color,
  isPercent,
  metricKey
}: {
  label:     string
  value:     number | undefined
  color:     string
  isPercent: boolean
  metricKey: string
}) {
  let displayVal = 'N/A'

  if (value !== undefined && value !== null) {
    if (isPercent) {
      displayVal = `${(value * 100).toFixed(2)}%`
    } else {
      displayVal = value.toFixed(4)
    }
  }

  const rating = rateMetric(value ?? 0, metricKey)
  const description = value !== undefined ? getDescription(metricKey, value) : 'Not available'

  return (
    <div
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      className="rounded-xl p-4 hover:border-gray-600 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: color,
            }}
          />

          <p style={{ color: 'var(--text-3)' }} className="text-xs font-medium">
            {label}
          </p>
        </div>

        {value !== undefined && (
          <span style={{ color: rating.color, fontSize: '10px', fontWeight: '500' }}>
            {rating.label}
          </span>
        )}
      </div>

      <p
        style={{ color: value !== undefined ? 'var(--text-1)' : 'var(--text-4)' }}
        className="text-2xl font-semibold font-mono mb-2"
      >
        {displayVal}
      </p>

      <p style={{ color: 'var(--text-4)' }} className="text-xs leading-relaxed">
        {description}
      </p>
    </div>
  )
}
