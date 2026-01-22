import React, { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { Button } from '@/components/common/Button'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('cliente@demo.com')
  const { login, isLoading } = useAuthStore()
  const [error, setError] = useState('')

  const usuarios = [
    { value: 'cliente@demo.com', label: 'Cliente - Juan Pérez' },
    { value: 'tesoreria@agrosol.com', label: 'Cliente - Agro Sol' },
    { value: 'admin@bancoatlas.com', label: 'Banco Atlas - Admin' },
    { value: 'mesa@bancoatlas.com', label: 'Banco Atlas - Mesa' },
    { value: 'auditor@bancoatlas.com', label: 'Banco Atlas - Auditor' },
    { value: 'admin@banconova.com', label: 'Banco Nova - Admin' },
    { value: 'mesa@banconova.com', label: 'Banco Nova - Mesa' },
    { value: 'admin@fundlink.ai', label: 'WebAdmin - Super Admin' },
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      await login(selectedRole)
    } catch (err) {
      setError('Error al iniciar sesión. Por favor intenta de nuevo.')
    }
  }

  const handleQuickLogin = async (userEmail: string) => {
    setError('')
    try {
      await login(userEmail)
    } catch (err) {
      setError('Error al iniciar sesión. Por favor intenta de nuevo.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2">
            FUND<span className="text-[var(--link)]">Link</span>
            <span className="text-[#9b7bff]">AI</span>
          </h1>
          <p className="text-[var(--muted)] text-sm">Sistema de Subastas Financieras</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-xl font-bold mb-4">Acceso al Sistema</h2>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Correo Electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />

              <Select
                label="Seleccionar Usuario"
                options={usuarios}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              />

              {error && (
                <div className="text-[var(--bad)] text-sm bg-red-900/20 border border-red-900/50 rounded p-2">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                variant="primary" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Ingresando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-[var(--line)]">
              <p className="text-xs text-[var(--muted)] mb-2">Acceso rápido:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="small" 
                  onClick={() => handleQuickLogin('cliente@demo.com')}
                  disabled={isLoading}
                >
                  Cliente
                </Button>
                <Button 
                  variant="small" 
                  onClick={() => handleQuickLogin('admin@bancoatlas.com')}
                  disabled={isLoading}
                >
                  Banco Admin
                </Button>
                <Button 
                  variant="small" 
                  onClick={() => handleQuickLogin('mesa@bancoatlas.com')}
                  disabled={isLoading}
                >
                  Banco Mesa
                </Button>
                <Button 
                  variant="small" 
                  onClick={() => handleQuickLogin('admin@fundlink.ai')}
                  disabled={isLoading}
                >
                  WebAdmin
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-bold mb-3">Información del Sistema</h3>
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p>✓ Sistema de subastas en tiempo real</p>
              <p>✓ Múltiples tipos de subasta (abierta, sellada, holandesa)</p>
              <p>✓ Gestión de compromisos y vencimientos</p>
              <p>✓ Ofertas PUSH proactivas</p>
              <p>✓ Auditoría completa de operaciones</p>
              <p>✓ Panel de control por rol</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}