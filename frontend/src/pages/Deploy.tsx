import {  useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface DeployedModel {
  id:           number
  name:         string
  model_name:   string
  problem_type: string
  accuracy:     number
  features:     string[]
  input_features?: string[]
  target_column:string
  metrics:      Record<string, number>
  call_count:   number
  api_key?:     string | null
  api_key_preview?: string | null
}

export default function Deploy() {
  const { jobId }  = useParams()
  const navigate   = useNavigate()

  const [modelName, setModelName]       = useState('')
  const [deploying, setDeploying]       = useState(false)
  const [deployed, setDeployed]         = useState<DeployedModel | null>(null)
  const [error, setError]               = useState('')
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const [urlCopied, setUrlCopied]       = useState(false)
  const [curlCopied, setCurlCopied]     = useState(false)
  const [showKey, setShowKey]           = useState(false)

  const [predInputs, setPredInputs] = useState<Record<string, string>>({})
  const [predResult, setPredResult] = useState<any>(null)
  const [predicting, setPredicting] = useState(false)
  const [predError, setPredError]   = useState('')

  async function handleDeploy() {
    if (!modelName.trim()) {
      setError('Please give your model a name')
      return
    }
    setDeploying(true)
    setError('')
    try {
      const res = await api.post('/deploy/', {
        job_id: parseInt(jobId!),
        name:   modelName,
      })
      const modelRes = await api.get(`/deploy/models/${res.data.deployed_model_id}`)
      const deployedModel = { ...modelRes.data, api_key: res.data.api_key || modelRes.data.api_key }
      setDeployed(deployedModel)
      const inputs: Record<string, string> = {}
      ;(deployedModel.input_features || deployedModel.features).forEach((f: string) => { inputs[f] = '' })
      setPredInputs(inputs)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Deployment failed')
    } finally {
      setDeploying(false)
    }
  }

  async function handlePredict() {
    if (!deployed) return
    setPredicting(true)
    setPredError('')
    setPredResult(null)
    try {
      const data: Record<string, any> = {}
      Object.entries(predInputs).forEach(([key, val]) => {
        const num = parseFloat(val)
        data[key] = isNaN(num) ? val : num
      })
      const res = await api.post(`/deploy/predict/${deployed.id}`, { data })
      setPredResult(res.data)
    } catch (err: any) {
      setPredError(err.response?.data?.detail || 'Prediction failed')
    } finally {
      setPredicting(false)
    }
  }

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const endpoint    = `http://localhost:8000/deploy/v1/predict`
  const testerFeatures = deployed ? (deployed.input_features || deployed.features) : []
  const curlExample = deployed ? `curl -X POST "${endpoint}?api_key=${deployed.api_key || '<your-saved-key>'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      ${testerFeatures.slice(0, 3).map(f => `"${f}": <value>`).join(',\n      ')}
    }
  }'` : ''

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-4xl animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/results/${jobId}`)}
            style={{ color: 'var(--text-3)' }}
            className="text-sm hover:text-gray-400 mb-2 block"
          >
            ← Back to Results
          </button>
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Deploy Model
          </h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">
            Turn your trained model into a live REST API
          </p>
        </div>

        {!deployed ? (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            className="rounded-xl p-6">
            <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
              Name your model
            </h2>
            <p style={{ color: 'var(--text-3)' }} className="text-xs mb-5">
              Give it a descriptive name so you can identify it later
            </p>
            <input
              type="text"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              placeholder="e.g. churn-predictor-v1"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none mb-4 font-mono"
            />
            {error && (
              <p style={{ color: '#FCA5A5' }} className="text-sm mb-4">{error}</p>
            )}
            <button
              onClick={handleDeploy}
              disabled={deploying}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="w-full text-white font-semibold py-3 rounded-xl text-sm glow-hover disabled:opacity-50"
            >
              {deploying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⟳</span>
                  Deploying...
                </span>
              ) : '🚀 Deploy as API'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Success banner */}
            <div style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.3)',
            }} className="rounded-xl p-5 flex items-start gap-4">
              <span className="text-2xl">🎉</span>
              <div>
                <p style={{ color: '#22C55E' }} className="font-semibold mb-0.5">
                  Model deployed successfully!
                </p>
                <p style={{ color: 'var(--text-2)' }} className="text-sm">
                  <strong style={{ color: 'var(--text-1)' }}>{deployed.name}</strong> is live.
                </p>
              </div>
            </div>

            {/* Model info */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl p-5">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-4">
                Model details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Algorithm',   value: deployed.model_name },
                  { label: 'Type',        value: deployed.problem_type },
                  { label: 'Performance', value: deployed.accuracy ? `${(deployed.accuracy * 100).toFixed(2)}%` : 'N/A' },
                  { label: 'Features',    value: `${testerFeatures.length} input features` },
                  { label: 'Target',      value: deployed.target_column },
                  { label: 'API calls',   value: deployed.call_count.toString() },
                ].map((item, i) => (
                  <div key={i}>
                    <p style={{ color: 'var(--text-4)' }} className="text-xs mb-0.5">{item.label}</p>
                    <p style={{ color: 'var(--text-1)' }} className="text-sm font-mono">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl p-5">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
                API Key
              </h3>
              <p style={{ color: 'var(--text-4)' }} className="text-xs mb-4">
                Keep this secret. Anyone with this key can call your model.
              </p>
              <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                className="rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <span style={{ color: '#A5B4FC' }} className="text-sm font-mono flex-1 overflow-hidden">
                  {showKey ? (deployed.api_key || 'API key is shown only when first deployed') : '•'.repeat(40)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    style={{ color: 'var(--text-3)' }}
                    className="text-xs hover:text-gray-400 transition-all"
                  >
                    {showKey ? '🙈 Hide' : '👁 Show'}
                  </button>
                  <button
                    onClick={() => deployed.api_key && copyText(deployed.api_key, setApiKeyCopied)}
                    disabled={!deployed.api_key}
                    style={{
                      backgroundColor: apiKeyCopied ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                      border: `1px solid ${apiKeyCopied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                      color: apiKeyCopied ? '#22C55E' : '#A5B4FC',
                    }}
                    className="text-xs px-3 py-1 rounded-lg transition-all"
                  >
                    {apiKeyCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Endpoint */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl p-5">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
                Endpoint URL
              </h3>
              <p style={{ color: 'var(--text-4)' }} className="text-xs mb-4">
                Send POST requests to this URL with your API key
              </p>
              <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                className="rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <span style={{ color: 'var(--text-2)' }} className="text-sm font-mono">
                  {endpoint}
                </span>
                <button
                  onClick={() => copyText(endpoint, setUrlCopied)}
                  style={{
                    backgroundColor: urlCopied ? 'rgba(34,197,94,0.1)' : 'var(--border)',
                    border: `1px solid ${urlCopied ? 'rgba(34,197,94,0.3)' : 'var(--border-2)'}`,
                    color: urlCopied ? '#22C55E' : 'var(--text-2)',
                  }}
                  className="text-xs px-3 py-1 rounded-lg shrink-0 transition-all"
                >
                  {urlCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* cURL Example */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl overflow-hidden">
              <div style={{ borderBottom: '1px solid var(--border)' }}
                className="px-5 py-3.5 flex items-center justify-between">
                <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold">
                  cURL Example
                </h3>
                <button
                  onClick={() => copyText(curlExample, setCurlCopied)}
                  style={{
                    backgroundColor: curlCopied ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
                    border: `1px solid ${curlCopied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                    color: curlCopied ? '#22C55E' : '#A5B4FC',
                  }}
                  className="text-xs px-3 py-1 rounded-lg transition-all"
                >
                  {curlCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre style={{
                backgroundColor: 'var(--surface-2)', color: 'var(--text-2)',
                padding: '16px 20px', fontSize: '12px',
                fontFamily: 'JetBrains Mono, monospace',
                overflowX: 'auto', margin: 0,
              }}>
                {curlExample}
              </pre>
            </div>

            {/* Required features */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl p-5">
              <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
                Required input features
              </h3>
              <p style={{ color: 'var(--text-4)' }} className="text-xs mb-4">
                Your request must include all of these fields
              </p>
              <div className="flex flex-wrap gap-2">
                {testerFeatures.map((f, i) => (
                  <span key={i} style={{
                    backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-2)', fontSize: '11px',
                    padding: '4px 10px', borderRadius: '6px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Live Prediction Tester */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-xl overflow-hidden">
              <div style={{ borderBottom: '1px solid var(--border)' }} className="px-5 py-4">
                <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-0.5">
                  🧪 Live Prediction Tester
                </h3>
                <p style={{ color: 'var(--text-4)' }} className="text-xs">
                  Test your deployed model right here
                </p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {testerFeatures.map((feature) => (
                    <div key={feature}>
                      <label style={{ color: 'var(--text-3)' }} className="text-xs block mb-1 font-mono">
                        {feature}
                      </label>
                      <input
                        type="text"
                        value={predInputs[feature] || ''}
                        onChange={e => setPredInputs(prev => ({ ...prev, [feature]: e.target.value }))}
                        placeholder="enter value"
                        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                        className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handlePredict}
                  disabled={predicting}
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                  className="w-full text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50 mb-4"
                >
                  {predicting ? '⟳ Predicting...' : 'Run Prediction'}
                </button>

                {predError && (
                  <p style={{ color: '#FCA5A5' }} className="text-sm mb-4">{predError}</p>
                )}

                {predResult && (
                  <div className="space-y-4 animate-fade-in">

                    {/* Prediction value */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.1))',
                      border: '1px solid rgba(99,102,241,0.3)',
                    }} className="rounded-xl p-4">
                      <p style={{ color: 'var(--text-3)' }} className="text-xs mb-1">Prediction</p>
                      <p style={{ color: '#A5B4FC' }} className="text-3xl font-bold font-mono">
                        {predResult.prediction_label || predResult.prediction?.toFixed(2)}
                      </p>
                      {predResult.probability && (
                        <p style={{ color: 'var(--text-3)' }} className="text-xs mt-1">
                          Confidence: {(predResult.probability * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>

                    {/* Plain English */}
                    <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      className="rounded-lg p-4">
                      <p style={{ color: 'var(--text-4)' }} className="text-xs mb-2 uppercase tracking-wide">
                        Why this prediction?
                      </p>
                      <p style={{ color: 'var(--text-2)' }} className="text-sm leading-relaxed">
                        {predResult.plain_english}
                      </p>
                    </div>

                    {/* SHAP breakdown */}
                    {predResult.shap_explanation?.length > 0 && (
                      <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        className="rounded-lg p-4">
                        <p style={{ color: 'var(--text-4)' }} className="text-xs mb-3 uppercase tracking-wide">
                          SHAP breakdown — this specific prediction
                        </p>
                        <div className="space-y-3">
                          {predResult.shap_explanation.slice(0, 6).map((s: any, i: number) => {
                            const isPos   = s.shap_value >= 0
                            const maxShap = Math.abs(predResult.shap_explanation[0].shap_value)
                            const barW    = `${(Math.abs(s.shap_value) / maxShap) * 100}%`
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span style={{ color: isPos ? '#6366F1' : '#EF4444', fontSize: '10px', fontWeight: '700' }}>
                                      {isPos ? '+' : '−'}
                                    </span>
                                    <span style={{ color: 'var(--text-2)' }} className="text-xs font-mono">
                                      {s.feature} = {s.value}
                                    </span>
                                  </div>
                                  <span style={{
                                    color: isPos ? '#A5B4FC' : '#FCA5A5',
                                    fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
                                  }}>
                                    {isPos ? '+' : ''}{s.shap_value.toFixed(4)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                                    {!isPos && (
                                      <div style={{
                                        height: '4px', width: barW,
                                        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                        borderRadius: '3px 0 0 3px',
                                      }} />
                                    )}
                                  </div>
                                  <div style={{ width: '1px', height: '8px', backgroundColor: 'var(--border-2)' }} />
                                  <div style={{ width: '50%' }}>
                                    {isPos && (
                                      <div style={{
                                        height: '4px', width: barW,
                                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                                        borderRadius: '0 3px 3px 0',
                                      }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
