import React from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from './Button'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      await logout()
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-[var(--card)] backdrop-blur-lg border-b border-[var(--line)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div>
              <h1 className="text-2xl font-black text-white">
                FUNDLINK<span className="text-[var(--primary)]">AI</span>
              </h1>
            </div>

            {/* User info + Logout */}
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <div className="text-right hidden md:block">
                    <div className="text-sm font-semibold text-white">
                      {user.nombre}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {user.entidad}
                    </div>
                  </div>
                  <Button onClick={handleLogout} variant="small">
                    Cerrar Sesión
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
