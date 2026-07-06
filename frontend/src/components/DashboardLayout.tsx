import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', color: 'var(--text-1)' }}>
        {children}
      </main>
    </div>
  )
}