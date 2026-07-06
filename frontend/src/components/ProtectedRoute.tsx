import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wraps pages that need login
// If not logged in → redirect to /login automatically
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}