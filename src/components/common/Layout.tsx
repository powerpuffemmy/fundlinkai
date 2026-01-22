import React from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from './Button'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()

  if (!user) return null

  const getRoleLabel = () => {
    switch (user.role) {
      case 'cliente': return 'Cliente'
      case 'banco_admin': return 'Banco - Admin'
      case 'banco_mesa': return 'Banco - Mesa'
      case 'banco_auditor': return 'Banco - Auditor'
      case 'webadmin': return 'WebAdmin'
      default: return user.role
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-[rgba(17,24,39,0.85)] backdrop-blur-md border-b border-[var(--line)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black">
              FUND<span className="text-[var(--link)]">Link</span>
              <span className="text-[#9b7bff]">AI</span>
            </h1>
            <span className="text-xs bg-[#0e1a33] border border-[#253b66] text-[#9bd1ff] px-2 py-1 rounded-full">
              {getRoleLabel()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-semibold">{user.nombre}</div>
              <div className="text-xs text-[var(--muted)]">{user.entidad}</div>
            </div>
            <Button variant="small" onClick={logout}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {children}
      </main>
    </div>
  )
}