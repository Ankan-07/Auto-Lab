import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Settings() {
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [success, setSuccess]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleChangePassword() {
    if (newPw !== confirmPw) { setError('Passwords do not match'); return }
    if (newPw.length < 6)   { setError('Min 6 characters'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      await api.post('/auth/change-password', {
        current_password: currentPw,
        new_password:     newPw,
      })
      setSuccess('Password updated!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-2xl animate-fade-in">
        <div className="mb-8">
          <h1 style={{ color: 'var(--text-1)' }} className="text-2xl font-semibold mb-1">Settings</h1>
          <p style={{ color: 'var(--text-3)' }} className="text-sm">Manage your account</p>
        </div>

        {/* Change Password */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          className="rounded-xl p-6 mb-6">
          <h2 style={{ color: 'var(--text-1)' }} className="text-sm font-semibold mb-1">
            Change Password
          </h2>
          <p style={{ color: 'var(--text-4)' }} className="text-xs mb-5">
            Update your account password
          </p>
          <div className="space-y-3">
            {[
              { label: 'Current Password', val: currentPw, set: setCurrentPw },
              { label: 'New Password',     val: newPw,     set: setNewPw },
              { label: 'Confirm Password', val: confirmPw, set: setConfirmPw },
            ].map((f, i) => (
              <div key={i}>
                <label style={{ color: 'var(--text-3)' }} className="text-xs block mb-1">{f.label}</label>
                <input
                  type="password"
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                    width: '100%', borderRadius: '10px',
                    padding: '10px 14px', fontSize: '14px', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
          {error   && <p style={{ color: '#FCA5A5' }} className="text-sm mt-3">{error}</p>}
          {success && <p style={{ color: '#22C55E' }} className="text-sm mt-3">{success}</p>}
          <button
            onClick={handleChangePassword}
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            className="mt-4 text-white font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{
          backgroundColor: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.2)',
        }} className="rounded-xl p-6">
          <h2 style={{ color: '#EF4444' }} className="text-sm font-semibold mb-1">Danger Zone</h2>
          <p style={{ color: 'var(--text-4)' }} className="text-xs mb-5">
            Irreversible actions — proceed with caution
          </p>
          <button
            onClick={() => { logout(); navigate('/login') }}
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5',
            }}
            className="text-sm font-semibold px-6 py-2.5 rounded-lg transition-all"
          >
            Sign out of all devices
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}