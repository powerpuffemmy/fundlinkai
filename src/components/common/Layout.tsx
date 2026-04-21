import React, { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from './Button'

interface LayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar }) => {
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      await logout()
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)]">
      {/* Top header */}
      <header className="flex-shrink-0 bg-[var(--card)] border-b border-[var(--line)] px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {sidebar && (
              <button
                onClick={() => setCollapsed(c => !c)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/10 transition-colors text-lg"
                title={collapsed ? 'Abrir menú' : 'Colapsar menú'}
              >
                {collapsed ? '☰' : '✕'}
              </button>
            )}
            <h1 className="text-xl font-black tracking-tight text-white">
              FUNDLINK<span className="text-[var(--primary)]">AI</span>
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-white">{user.nombre}</div>
                <div className="text-xs text-[var(--muted)]">{user.entidad}</div>
              </div>
              <Button onClick={handleLogout} variant="small">
                Cerrar Sesión
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        {sidebar && (
          <aside
            className={`flex-shrink-0 bg-[var(--card)] border-r border-[var(--line)] overflow-y-auto transition-all duration-200 ${
              collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-56 opacity-100'
            }`}
          >
            {sidebar}
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
