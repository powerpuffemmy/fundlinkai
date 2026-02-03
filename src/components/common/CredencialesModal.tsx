import React from 'react'
import { Button } from './Button'

interface CredencialesModalProps {
  email: string
  password: string
  role: string
  onClose: () => void
}

export const CredencialesModal: React.FC<CredencialesModalProps> = ({
  email,
  password,
  role,
  onClose
}) => {
  const handleCopyCredentials = () => {
    const texto = `Email: ${email}\nContraseña: ${password}`
    navigator.clipboard.writeText(texto)
    alert('Credenciales copiadas al portapapeles')
  }

  const handleOpenSupabase = () => {
    window.open('https://supabase.com/dashboard/project/ewcvkvnnixrxmiruzmie/auth/users', '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4 text-green-400">
          ✅ Usuario creado en la base de datos
        </h3>

        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg">
          <p className="text-sm text-blue-200 mb-3">
            <strong>📋 PASO ADICIONAL REQUERIDO:</strong>
          </p>
          <p className="text-sm text-blue-200 mb-3">
            Debes crear la cuenta de autenticación manualmente en Supabase.
          </p>
          
          <ol className="text-sm text-blue-200 space-y-2 list-decimal list-inside mb-3">
            <li>Click en "Abrir Supabase Auth"</li>
            <li>Click <strong>"Add user"</strong> → <strong>"Create new user"</strong></li>
            <li>Pega el email y password de abajo</li>
            <li>Marca <strong>"Auto Confirm User" ✓</strong></li>
            <li>Click <strong>"Create user"</strong></li>
          </ol>

          <Button
            variant="primary"
            onClick={handleOpenSupabase}
            className="w-full mb-3"
          >
            🔗 Abrir Supabase Auth
          </Button>
        </div>

        <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-xs text-[var(--muted)] mb-3">
            <strong>Credenciales para crear en Supabase:</strong>
          </p>
          
          <div className="space-y-2">
            <div>
              <label className="text-xs text-[var(--muted)]">Email:</label>
              <div className="font-mono text-sm bg-black/20 p-2 rounded mt-1">
                {email}
              </div>
            </div>
            
            <div>
              <label className="text-xs text-[var(--muted)]">Password:</label>
              <div className="font-mono text-sm bg-black/20 p-2 rounded mt-1 break-all">
                {password}
              </div>
            </div>
          </div>

          <Button
            variant="small"
            onClick={handleCopyCredentials}
            className="w-full mt-3"
          >
            📋 Copiar credenciales
          </Button>
        </div>

        {role === 'cliente' && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
            <p className="text-sm text-yellow-200">
              💡 El cliente deberá completar su configuración al hacer login por primera vez.
            </p>
          </div>
        )}

        <Button
          variant="secondary"
          onClick={onClose}
          className="w-full"
        >
          Ya creé la cuenta en Supabase
        </Button>
      </div>
    </div>
  )
}
