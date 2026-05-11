import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

// Shape of our auth state
interface AuthContextType {
  isLoggedIn: boolean
  token: string | null
  login: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

// Create the context (like a global variable accessible anywhere)
const AuthContext = createContext<AuthContextType | null>(null)

// Provider — wraps your whole app, shares auth state everywhere
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('access_token')  // check if already logged in
  )

  const isLoggedIn = !!token  // converts token to true/false

  function login(accessToken: string, refreshToken: string) {
    // Save both tokens to browser storage
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    setToken(accessToken)
  }

  function logout() {
    // Clear everything
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook — any component can call useAuth() to get auth state
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}