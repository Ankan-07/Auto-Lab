import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login       from './pages/Login'
import Register    from './pages/Register'
import Dashboard   from './pages/Dashboard'
import Upload      from './pages/Upload'
import Training    from './pages/Training'
import Results     from './pages/Results'
import Deploy      from './pages/Deploy'
import Upgrade     from './pages/Upgrade'
import Models      from './pages/Models'
import APIs        from './pages/APIs'
import Marketplace from './pages/Marketplace'
import Datasets    from './pages/Datasets'
import Settings    from './pages/Settings'

// Apply saved theme on first load
const savedTheme = localStorage.getItem('theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/upload"         element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/jobs/:jobId"    element={<ProtectedRoute><Training /></ProtectedRoute>} />
          <Route path="/results/:jobId" element={<ProtectedRoute><Results /></ProtectedRoute>} />
          <Route path="/deploy/:jobId"  element={<ProtectedRoute><Deploy /></ProtectedRoute>} />
          <Route path="/upgrade"        element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
          <Route path="/models"         element={<ProtectedRoute><Models /></ProtectedRoute>} />
          <Route path="/apis"           element={<ProtectedRoute><APIs /></ProtectedRoute>} />
          <Route path="/marketplace"    element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
          <Route path="/datasets"       element={<ProtectedRoute><Datasets /></ProtectedRoute>} />
          <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}