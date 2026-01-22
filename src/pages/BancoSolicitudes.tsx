import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useSubastas } from '@/hooks/useSubastas'
import { useOfertas } from '@/hooks/useOfertas'
import { useAuthStore } from '@/store/authStore'
import { formatMoney, formatDateTime } from '@/lib/utils'
import type { Subasta } from '@/types/database'

export const BancoSolicitudes: React.FC = () => {
  const { user } = useAuthStore()
  const { subastas, loading } = useSubastas()
  const { crearOferta } = useOfertas()
  const [tasas, setTasas] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState<Record<string, boolean>>({})

  const subastas_abiertas = subastas.filter(s => s.estado === 'abierta')

  const handleTasaChange = (subastaId: string, value: string) => {
    setTasas(prev => ({ ...prev, [subastaId]: value }))
  }

  const handleOfertar = async (subasta: Subasta) => {
    if (!user) return

    const tasa = parseFloat(tasas[subasta.id] || '0')
    if (tasa <= 0 || tasa > 100) {
      alert('Por favor ingresa una tasa válida entre 0 y 100')
      return
    }

    // Verificar permisos
    if (user.role === 'banco_auditor') {
      alert('Los auditores no pueden enviar ofertas')
      return
    }

    try {
      setEnviando(prev => ({ ...prev, [subasta.id]: true }))

      const aprobada_por_admin = user.role === 'banco_admin'

      await crearOferta({
        subasta_id: subasta.id,
        banco_id: user.id,
        tasa: tasa,
        estado: aprobada_por_admin ? 'enviada' : 'enviada',
        aprobada_por_admin: aprobada_por_admin,
        notas: ''
      })

      alert(`Oferta enviada exitosamente al ${tasa}%`)
      
      // Limpiar el campo de tasa
      setTasas(prev => ({ ...prev, [subasta.id]: '' }))

    } catch (error) {
      console.error('Error al ofertar:', error)
      alert('Error al enviar la oferta. Por favor intenta de nuevo.')
    } finally {
      setEnviando(prev => ({ ...prev, [subasta.id]: false }))
    }
  }

  const getTiempoRestante = (expiresAt: string) => {
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now

    if (diff <= 0) return 'Expirada'

    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Solicitudes de Colocación</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando subastas...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Solicitudes de Colocación</h2>
        <div className="text-sm text-[var(--muted)]">
          {subastas_abiertas.length} subasta(s) activa(s)
        </div>
      </div>

      {user?.role === 'banco_mesa' && (
        <Card className="bg-blue-900/20 border-blue-900/50">
          <p className="text-sm text-blue-200">
            ℹ️ Como Mesa de Dinero, tus ofertas requieren aprobación del Administrador del banco.
          </p>
        </Card>
      )}

      {user?.role === 'banco_auditor' && (
        <Card className="bg-yellow-900/20 border-yellow-900/50">
          <p className="text-sm text-yellow-200">
            ⚠️ Como Auditor, solo puedes ver las subastas pero no ofertar.
          </p>
        </Card>
      )}

      {subastas_abiertas.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No hay subastas activas en este momento.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {subastas_abiertas.map(subasta => (
            <Card key={subasta.id}>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-lg mb-4">
                    {subasta.tipo.charAt(0).toUpperCase() + subasta.tipo.slice(1)}
                  </h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Monto:</span>
                      <span className="font-semibold">
                        {formatMoney(subasta.monto, subasta.moneda)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Moneda:</span>
                      <span className="font-semibold">{subasta.moneda}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Plazo:</span>
                      <span className="font-semibold">{subasta.plazo} días</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Duración:</span>
                      <span className="font-semibold">{subasta.duracion} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Creada:</span>
                      <span className="font-semibold text-xs">
                        {formatDateTime(subasta.created_at)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Tiempo restante:</span>
                      <span className="font-semibold text-[var(--warn)]">
                        {getTiempoRestante(subasta.expires_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Enviar Oferta</h4>
                  
                  {user?.role === 'banco_auditor' ? (
                    <div className="p-3 bg-gray-900/50 rounded text-sm text-[var(--muted)]">
                      No tienes permisos para ofertar
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        label="Tasa (%)"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="5.75"
                        value={tasas[subasta.id] || ''}
                        onChange={(e) => handleTasaChange(subasta.id, e.target.value)}
                        disabled={enviando[subasta.id]}
                      />

                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => handleOfertar(subasta)}
                        disabled={enviando[subasta.id] || !tasas[subasta.id]}
                      >
                        {enviando[subasta.id] ? 'Enviando...' : 'Enviar Oferta'}
                      </Button>

                      {user?.role === 'banco_mesa' && (
                        <p className="text-xs text-[var(--muted)]">
                          * Tu oferta será enviada al administrador para aprobación
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}