import React, { useState } from 'react'
import { Lock, Lightbulb } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { supabase } from '@/lib/supabase'

interface CambiarPasswordModalProps {
  onSuccess: () => void
}

export const CambiarPasswordModal: React.FC<CambiarPasswordModalProps> = ({ onSuccess }) => {
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNuevo, setPasswordNuevo] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCambiar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (passwordNuevo.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (passwordNuevo !== passwordConfirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (passwordNuevo === passwordActual) {
      setError('La nueva contraseña debe ser diferente a la actual')
      return
    }

    try {
      setLoading(true)

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordNuevo
      })

      if (updateError) throw updateError

      alert('✅ Contraseña actualizada exitosamente')
      onSuccess()

    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al cambiar contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Lock size={20} strokeWidth={1.75} /> Cambiar Contraseña</h3>
        <p className="text-[var(--muted)] text-sm mb-6">
          Por seguridad, te recomendamos cambiar tu contraseña temporal.
        </p>

        <form onSubmit={handleCambiar} className="space-y-4">
          <Input
            label="Contraseña actual"
            type="password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            placeholder="Contraseña temporal"
            required
            disabled={loading}
          />

          <Input
            label="Nueva contraseña"
            type="password"
            value={passwordNuevo}
            onChange={(e) => setPasswordNuevo(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            disabled={loading}
          />

          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Repite la nueva contraseña"
            required
            disabled={loading}
          />

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
            <Button
              type="button"
              onClick={onSuccess}
              disabled={loading}
            >
              Más tarde
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg">
          <p className="text-xs text-blue-200 flex items-start gap-2">
            <Lightbulb size={14} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />
            <span><strong>Consejo:</strong> Usa una contraseña segura con letras, números y símbolos.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
