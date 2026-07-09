import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

interface PlanInfo {
  is_pro:      boolean
  plan:        string
  model_count: number
  job_count:   number
  model_limit: number | null
  can_train:   boolean
  amount:      number
  currency:    string
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export default function Upgrade() {
  const navigate = useNavigate()
  const [planInfo, setPlanInfo]   = useState<PlanInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [paying, setPaying]       = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    api.get('/payments/plan')
      .then(r => setPlanInfo(r.data))
      .catch(() => setError('Failed to load plan info'))
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade() {
    setPaying(true)
    setError('')

    try {
      // Step 1 — Create order on our backend
      const orderRes = await api.post('/payments/create-order')
      const { order_id, amount, currency, key_id } = orderRes.data

      // Step 2 — Open Razorpay checkout
      // This opens the payment modal
      const options = {
        key:      key_id,
        amount:   amount,
        currency: currency,
        name:     'AutoLab',
        description: 'Pro Plan — Unlimited Models',
        order_id: order_id,
        theme:    { color: '#6366F1' },

        // Called when payment succeeds
        handler: async (response: any) => {
          try {
            // Step 3 — Verify payment with our backend
            const verifyRes = await api.post('/payments/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            })

            if (verifyRes.data.success) {
              setSuccess(true)
              // Refresh plan info
              const planRes = await api.get('/payments/plan')
              setPlanInfo(planRes.data)
            }
          } catch {
            setError('Payment verification failed. Contact support.')
          } finally {
            setPaying(false)
          }
        },

        // Called when user closes checkout without paying
        modal: {
          ondismiss: () => setPaying(false)
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to initiate payment')
      setPaying(false)
    }
  }

  if (loading) return (
    <DashboardLayout>
      <div className="px-8 py-8 flex items-center gap-3">
        <span className="animate-spin" style={{ color: '#6366F1' }}>⟳</span>
        <p style={{ color: 'var(--text-2)' }}>Loading plan info...</p>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-4xl animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
            Upgrade to Pro
          </h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">
            Unlock unlimited models and priority training
          </p>
        </div>

        {/* Success state */}
        {success && (
          <div style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
          }} className="rounded-2xl p-8 text-center mb-8">
            <div className="text-5xl mb-4">🎉</div>
            <h2 style={{ color: '#22C55E' }} className="text-2xl font-semibold mb-2">
              Welcome to Pro!
            </h2>
            <p style={{ color: 'var(--text-2)' }} className="mb-6">
              You now have unlimited access to all AutoLab features.
            </p>
            <button
              onClick={() => navigate('/upload')}
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              className="text-white font-semibold px-8 py-3 rounded-xl text-sm"
            >
              Start Training →
            </button>
          </div>
        )}

        {/* Already Pro */}
        {planInfo?.is_pro && !success && (
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.3)',
          }} className="rounded-2xl p-6 mb-8 flex items-center gap-4">
            <span className="text-3xl">✨</span>
            <div>
              <p style={{ color: '#A5B4FC' }} className="font-semibold">
                You're already on Pro!
              </p>
              <p style={{ color: 'var(--text-3)' }} className="text-sm">
                Enjoy unlimited models and all features.
              </p>
            </div>
          </div>
        )}

        {/* Plan comparison */}
        {!planInfo?.is_pro && !success && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* Free plan */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              className="rounded-2xl p-6">
              <div className="mb-6">
                <p style={{ color: 'var(--text-3)' }} className="text-xs uppercase tracking-widest mb-2">
                  Current Plan
                </p>
                <h2 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
                  Free
                </h2>
                <p style={{ color: 'var(--text-4)' }} className="text-3xl font-bold">₹0</p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { text: `${planInfo?.model_limit} models max`, included: true },
                  { text: 'Basic training',                      included: true },
                  { text: 'All algorithms',                      included: true },
                  { text: 'Unlimited models',                    included: false },
                  { text: 'Priority training',                   included: false },
                  { text: 'API deployment',                      included: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span style={{ color: item.included ? '#22C55E' : 'var(--border-2)' }}>
                      {item.included ? '✓' : '✗'}
                    </span>
                    <span style={{ color: item.included ? 'var(--text-2)' : 'var(--border-2)' }}
                      className="text-sm">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Usage meter */}
              <div style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }} className="rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: 'var(--text-3)' }} className="text-xs">Models used</span>
                  <span style={{ color: 'var(--text-2)' }} className="text-xs font-mono">
                    {planInfo?.job_count} / {planInfo?.model_limit}
                  </span>
                </div>
                <div style={{ backgroundColor: 'var(--border)' }} className="w-full rounded-full h-1.5">
                  <div style={{
                    width: `${Math.min(((planInfo?.job_count ?? 0) / (planInfo?.model_limit ?? 3)) * 100, 100)}%`,
                    background: (planInfo?.job_count ?? 0) >= (planInfo?.model_limit ?? 3)
                      ? '#EF4444'
                      : 'linear-gradient(135deg, #3B82F6, #6366F1)',
                  }} className="h-1.5 rounded-full" />
                </div>
              </div>
            </div>

            {/* Pro plan */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.08))',
              border: '1px solid rgba(99,102,241,0.4)',
            }} className="rounded-2xl p-6 relative overflow-hidden">

              {/* Popular badge */}
              <div style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                color: 'white', fontSize: '10px', fontWeight: '600',
                padding: '3px 10px', borderRadius: '20px',
              }}>
                RECOMMENDED
              </div>

              <div className="mb-6">
                <p style={{ color: '#A5B4FC' }} className="text-xs uppercase tracking-widest mb-2">
                  Pro Plan
                </p>
                <h2 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">
                  Pro
                </h2>
                <div className="flex items-baseline gap-1">
                  <p style={{ color: 'var(--text-1)' }} className="text-3xl font-bold">₹499</p>
                  <p style={{ color: 'var(--text-3)' }} className="text-sm">/month</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  'Unlimited models',
                  'Priority training queue',
                  'API deployment + keys',
                  'All algorithms + tuning',
                  'SHAP explainability',
                  'Email support',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span style={{ color: '#6366F1' }}>✓</span>
                    <span style={{ color: 'var(--text-2)' }} className="text-sm">{text}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p style={{ color: '#FCA5A5' }} className="text-sm mb-4">{error}</p>
              )}

              <button
                onClick={handleUpgrade}
                disabled={paying}
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                className="w-full text-white font-semibold py-3 rounded-xl text-sm glow-hover disabled:opacity-50 transition-all"
              >
                {paying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Opening payment...
                  </span>
                ) : '⚡ Upgrade to Pro — ₹499/month'}
              </button>

              <p style={{ color: 'var(--text-4)' }} className="text-xs text-center mt-3">
                Secure payment via Razorpay · Cancel anytime
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-xl p-6">
          <h3 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-4">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            {[
              {
                q: 'What counts as a model?',
                a: 'Each CSV upload that completes training counts as one model. Free plan allows 3 completed training runs.'
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Pro plan is monthly. You can cancel before your next billing date and keep access until period ends.'
              },
              {
                q: 'Is my payment secure?',
                a: 'Yes. Payments are processed by Razorpay — PCI DSS compliant. We never store your card details.'
              },
              {
                q: 'What happens to my models if I downgrade?',
                a: 'Your existing models remain accessible. You just cannot train new ones until you upgrade again.'
              },
            ].map((item, i) => (
              <div key={i}>
                <p style={{ color: 'var(--text-1)' }} className="text-sm font-medium mb-1">
                  {item.q}
                </p>
                <p style={{ color: 'var(--text-3)' }} className="text-sm">
                  {item.a}
                </p>
                {i < 3 && (
                  <div style={{ borderBottom: '1px solid var(--border)' }} className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}