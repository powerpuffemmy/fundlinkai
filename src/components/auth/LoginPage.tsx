import React, { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

export const LoginPage: React.FC = () => {
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Por favor completa todos los campos')
      return
    }

    setLoading(true)

    const result = await login(email, password)

    if (!result.success) {
      setError(result.error || 'Error al iniciar sesión')
      setLoading(false)
    }
    // Si el login es exitoso, el componente App se re-renderizará automáticamente
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            FUNDLINK<span className="text-[var(--primary)]">AI</span>
          </h1>
          <p className="text-[var(--muted)] text-sm">
            Plataforma de Subastas Financieras
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-[var(--card)] backdrop-blur-lg rounded-2xl border border-[var(--line)] p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Iniciar Sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              required
              autoComplete="email"
              disabled={loading}
            />

            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
            />

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Entrar'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[var(--muted)] text-xs">
          <p>© 2026 FUNDLinkAI. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  )
}
