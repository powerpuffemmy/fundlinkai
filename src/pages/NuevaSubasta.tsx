import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { Button } from '@/components/common/Button'
import { useSubastas } from '@/hooks/useSubastas'
import { useAuthStore } from '@/store/authStore'
import type { TipoSubasta, Moneda } from '@/types/database'

interface NuevaSubastaProps {
  onSubastaCreada?: () => void  // ⭐ NUEVO: Callback para redirección
}

export const NuevaSubasta: React.FC<NuevaSubastaProps> = ({ onSubastaCreada }) => {
  const { user } = useAuthStore()
  const { crearSubasta } = useSubastas()
  
  const [tipo, setTipo] = useState<TipoSubasta>('abierta')
  const [moneda, setMoneda] = useState<Moneda>('USD')
  const [monto, setMonto] = useState('10000000')
  const [plazo, setPlazo] = useState('30')
  const [duracion, setDuracion] = useState('30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tiposSubasta = [
    { value: 'abierta', label: 'Mercado Abierto' },
    { value: 'sellada', label: 'Sellada (1 ronda)' },
    { value: 'holandesa', label: 'Holandesa' },
    { value: 'multi', label: 'Multi-tramo' }
  ]

  const monedas = [
    { value: 'USD', label: 'USD - Dólar' },
    { value: 'GTQ', label: 'GTQ - Quetzal' }
  ]

  const plazos = [
    { value: '7', label: '7 días' },
    { value: '14', label: '14 días' },
    { value: '30', label: '30 días' },
    { value: '90', label: '90 días' },
    { value: '120', label: '120 días' },
    { value: '180', label: '180 días' },
    { value: '365', label: '365 días' }
  ]

  const duraciones = [
    { value: '15', label: '15 minutos' },
    { value: '30', label: '30 minutos' },
    { value: '60', label: '60 minutos' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user) {
      setError('Usuario no autenticado')
      return
    }

    try {
      setLoading(true)

      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(duracion))

      await crearSubasta({
        cliente_id: user.id,
        tipo: tipo as TipoSubasta,
        moneda: moneda as Moneda,
        monto: parseFloat(monto),
        plazo: parseInt(plazo),
        duracion: parseInt(duracion),
        tramos: [100],
        estado: 'abierta',
        aprobada: false,
        expires_at: expiresAt.toISOString()
      })

      // ⭐ NUEVO: Mostrar mensaje y redireccionar después de 1.5 segundos
      alert('¡Subasta creada exitosamente! Los bancos ya pueden ofertar.')
      
      setTimeout(() => {
        if (onSubastaCreada) {
          onSubastaCreada() // Callback para cambiar de página
        }
      }, 1500)

    } catch (err) {
      console.error(err)
      setError('Error al crear la subasta. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Nueva Subasta</h2>
        <p className="text-[var(--muted)] mt-1">
          Crea una solicitud de colocación y recibe ofertas de múltiples bancos
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold mb-4">Crear Solicitud de Colocación</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Tipo de Subasta"
              options={tiposSubasta}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoSubasta)}
            />

            <Select
              label="Moneda"
              options={monedas}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Moneda)}
            />

            <Input
              label="Monto"
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              min="1000"
              step="1000"
              required
            />

            <Select
              label="Plazo"
              options={plazos}
              value={plazo}
              onChange={(e) => setPlazo(e.target.value)}
            />

            <Select
              label="Duración de la Subasta"
              options={duraciones}
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
            />

            {error && (
              <div className="text-[var(--bad)] text-sm bg-red-900/20 border border-red-900/50 rounded p-3">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              variant="primary" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creando...' : 'Crear y Abrir Subasta'}
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="font-bold mb-4">Resumen</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Tipo:</span>
              <span className="font-semibold">{tiposSubasta.find(t => t.value === tipo)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Moneda:</span>
              <span className="font-semibold">{moneda}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Monto:</span>
              <span className="font-semibold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: moneda,
                  minimumFractionDigits: 0
                }).format(parseFloat(monto) || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Plazo:</span>
              <span className="font-semibold">{plazo} días</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Duración:</span>
              <span className="font-semibold">{duracion} minutos</span>
            </div>
          </div>

          <div className="mt-6 p-3 bg-blue-900/20 border border-blue-900/50 rounded">
            <p className="text-xs text-blue-200">
              💡 <strong>Tip:</strong> Una vez creada, la subasta estará visible para todos los bancos durante el tiempo especificado. Recibirás ofertas en tiempo real.
            </p>
          </div>

          <div className="mt-4 p-3 bg-green-900/20 border border-green-900/50 rounded">
            <p className="text-xs text-green-200">
              ✓ Después de crear la subasta serás redirigido a "Mis Subastas" para ver las ofertas que lleguen.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
