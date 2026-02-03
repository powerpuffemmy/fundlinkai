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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4 text-green-400">
          ✅ Usuario creado exitosamente
        </h3>

        <div className="mb-6 p-4 bg-green-900/20 border border-green-900/50 rounded-lg">
          <p className="text-sm text-green-200 mb-3">
            <strong>✅ CUENTA CREADA:</strong> La cuenta de autenticación fue creada automáticamente.
          </p>
          
          <p className="text-sm text-yellow-200 mb-3">
            <strong>📧 Envía estas credenciales al usuario:</strong>
          </p>
          
          <div className="space-y-2">
            <div>
              <label className="text-xs text-[var(--muted)]">Email:</label>
              <div className="font-mono text-sm bg-black/20 p-2 rounded mt-1">
                {email}
              </div>
            </div>
            
            <div>
              <label className="text-xs text-[var(--muted)]">Contraseña temporal:</label>
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
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg">
            <p className="text-sm text-blue-200">
              El cliente deberá completar su configuración al hacer login por primera vez.
            </p>
          </div>
        )}

        <Button
          variant="primary"
          onClick={onClose}
          className="w-full"
        >
          Entendido
        </Button>
      </div>
    </div>
  )
}
