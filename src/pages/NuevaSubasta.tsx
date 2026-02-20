import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { Button } from '@/components/common/Button'
import { useSubastas } from '@/hooks/useSubastas'
import { useClienteBancoLimites } from '@/hooks/useClienteBancoLimites'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import { toastSuccess, toastError } from '@/lib/toastUtils'
import type { TipoSubasta, Moneda } from '@/types/database'

interface NuevaSubastaProps {
  onSubastaCreada?: () => void
}

interface BancoDisponible {
  banco_id: string
  banco_nombre: string
  banco_entidad: string
  limite_monto: number
  monto_utilizado: number
  monto_disponible: number
  todos_user_ids: string[]
}

export const NuevaSubasta: React.FC<NuevaSubastaProps> = ({ onSubastaCreada }) => {
  const { user } = useAuthStore()
  const { crearSubasta } = useSubastas()
  const { obtenerBancosDisponibles } = useClienteBancoLimites()
  
  // Estados del formulario
  const [tipo, setTipo] = useState<TipoSubasta>('abierta')
  const [moneda, setMoneda] = useState<Moneda>('USD')
  const [monto, setMonto] = useState('10000000')
  const [plazo, setPlazo] = useState('30')
  const [plazoPersonalizado, setPlazoPersonalizado] = useState('')
  const [usarPlazoPersonalizado, setUsarPlazoPersonalizado] = useState(false)
  const [duracion, setDuracion] = useState('30')
  const [duracionPersonalizada, setDuracionPersonalizada] = useState('')
  const [usarDuracionPersonalizada, setUsarDuracionPersonalizada] = useState(false)
  const [tasaObjetivo, setTasaObjetivo] = useState('')
  
  // Estados del flujo
  const [paso, setPaso] = useState<1 | 2>(1) // Paso 1: Formulario, Paso 2: Selección bancos
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Estados para selección de bancos
  const [bancosDisponibles, setBancosDisponibles] = useState<BancoDisponible[]>([])
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<string>>(new Set())
  const [subastaTemp, setSubastaTemp] = useState<any>(null)

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

  // PASO 1: Crear subasta (sin abrirla aún)
  const handleCrearSubasta = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user) {
      setError('Usuario no autenticado')
      return
    }

    try {
      setLoading(true)

      const montoNum = parseFloat(monto)
      const plazoFinal = usarPlazoPersonalizado ? parseInt(plazoPersonalizado) : parseInt(plazo)
      const duracionFinal = usarDuracionPersonalizada ? parseInt(duracionPersonalizada) : parseInt(duracion)

      // Validaciones
      if (usarPlazoPersonalizado && (!plazoPersonalizado || plazoFinal < 1)) {
        setError('El plazo personalizado debe ser al menos 1 día')
        setLoading(false)
        return
      }

      if (usarDuracionPersonalizada && (!duracionPersonalizada || duracionFinal < 5)) {
        setError('El tiempo de respuesta debe ser al menos 5 minutos')
        setLoading(false)
        return
      }

      // Obtener bancos disponibles para este monto
      const bancos = await obtenerBancosDisponibles(montoNum)

      if (bancos.length === 0) {
        setError('No hay bancos disponibles con límite suficiente para este monto. Verifica tu configuración de límites.')
        setLoading(false)
        return
      }

      // Guardar datos temporales
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + duracionFinal)

      setSubastaTemp({
        cliente_id: user.id,
        tipo: tipo as TipoSubasta,
        moneda: moneda as Moneda,
        monto: montoNum,
        plazo: plazoFinal,
        duracion: duracionFinal,
        tasa_objetivo: tasaObjetivo ? parseFloat(tasaObjetivo) : null,
        tramos: [100],
        estado: 'esperando', // Temporalmente en "esperando"
        aprobada: false,
        expires_at: expiresAt.toISOString()
      })

      setBancosDisponibles(bancos)
      
      // Seleccionar todos por defecto
      setBancosSeleccionados(new Set(bancos.map(b => b.banco_id)))
      
      // Pasar al paso 2
      setPaso(2)

    } catch (err) {
      console.error(err)
      setError('Error al procesar la solicitud. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // PASO 2: Confirmar y abrir subasta con bancos seleccionados
  const handleConfirmarSubasta = async () => {
    if (!subastaTemp || bancosSeleccionados.size === 0) {
      toastError('Debes seleccionar al menos un banco')
      return
    }

    try {
      setLoading(true)

      // Crear la subasta (ahora como 'abierta')
      const subasta = await crearSubasta({
        ...subastaTemp,
        estado: 'abierta'
      })

      if (!subasta) throw new Error('Error al crear subasta')

      // Insertar todos los usuarios de cada banco seleccionado en subasta_bancos
      // (admin + mesa) para que todos puedan ver y ofertar en la subasta
      const bancosInvitados = Array.from(bancosSeleccionados).flatMap(banco_id => {
        const banco = bancosDisponibles.find(b => b.banco_id === banco_id)
        const userIds = banco?.todos_user_ids ?? [banco_id]
        return userIds.map(uid => ({ subasta_id: subasta.id, banco_id: uid }))
      })

      const { error: errorBancos } = await supabase
        .from('subasta_bancos')
        .insert(bancosInvitados)

      if (errorBancos) throw errorBancos

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user!.id,
        p_accion: 'Crear Subasta',
        p_detalle: `Subasta abierta con ${bancosSeleccionados.size} banco(s) invitados`,
        p_metadata: { 
          subasta_id: subasta.id,
          bancos_count: bancosSeleccionados.size
        }
      })

      toastSuccess(`¡Subasta creada exitosamente! ${bancosSeleccionados.size} banco(s) invitados durante ${duracion} minutos.`, 4000)
      
      setTimeout(() => {
        if (onSubastaCreada) {
          onSubastaCreada()
        }
      }, 1500)

    } catch (err) {
      console.error(err)
      toastError('Error al crear la subasta. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleBanco = (bancoId: string) => {
    setBancosSeleccionados(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bancoId)) {
        newSet.delete(bancoId)
      } else {
        newSet.add(bancoId)
      }
      return newSet
    })
  }

  const handleSeleccionarTodos = () => {
    setBancosSeleccionados(new Set(bancosDisponibles.map(b => b.banco_id)))
  }

  const handleDeseleccionarTodos = () => {
    setBancosSeleccionados(new Set())
  }

  const handleVolver = () => {
    setPaso(1)
    setBancosDisponibles([])
    setBancosSeleccionados(new Set())
    setSubastaTemp(null)
  }

  // PASO 1: Formulario
  if (paso === 1) {
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
            
            <form onSubmit={handleCrearSubasta} className="space-y-4">
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
                label="Plazo de Inversión"
                options={plazos}
                value={plazo}
                onChange={(e) => {
                  setPlazo(e.target.value)
                  setUsarPlazoPersonalizado(false)
                }}
                disabled={usarPlazoPersonalizado}
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="plazoPersonalizado"
                  checked={usarPlazoPersonalizado}
                  onChange={(e) => {
                    setUsarPlazoPersonalizado(e.target.checked)
                    if (!e.target.checked) setPlazoPersonalizado('')
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="plazoPersonalizado" className="text-sm cursor-pointer">
                  Plazo personalizado (días)
                </label>
              </div>

              {usarPlazoPersonalizado && (
                <Input
                  label="Días de plazo"
                  type="number"
                  value={plazoPersonalizado}
                  onChange={(e) => setPlazoPersonalizado(e.target.value)}
                  min="1"
                  max="3650"
                  placeholder="Ej: 45"
                  required
                />
              )}

              <Select
                label="Tiempo de Respuesta"
                options={duraciones}
                value={duracion}
                onChange={(e) => {
                  setDuracion(e.target.value)
                  setUsarDuracionPersonalizada(false)
                }}
                disabled={usarDuracionPersonalizada}
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="duracionPersonalizada"
                  checked={usarDuracionPersonalizada}
                  onChange={(e) => {
                    setUsarDuracionPersonalizada(e.target.checked)
                    if (!e.target.checked) setDuracionPersonalizada('')
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="duracionPersonalizada" className="text-sm cursor-pointer">
                  Tiempo personalizado (minutos)
                </label>
              </div>

              {usarDuracionPersonalizada && (
                <Input
                  label="Minutos para responder"
                  type="number"
                  value={duracionPersonalizada}
                  onChange={(e) => setDuracionPersonalizada(e.target.value)}
                  min="5"
                  max="10080"
                  placeholder="Ej: 120"
                  required
                />
              )}

              <Input
                label="Tasa Objetivo (%) - Opcional"
                type="number"
                step="0.01"
                value={tasaObjetivo}
                onChange={(e) => setTasaObjetivo(e.target.value)}
                placeholder="Ej: 5.50"
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
                {loading ? 'Procesando...' : 'Crear'}
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
                  {formatMoney(parseFloat(monto) || 0, moneda)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Plazo:</span>
                <span className="font-semibold">
                  {usarPlazoPersonalizado ? plazoPersonalizado : plazo} días
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Tiempo de respuesta:</span>
                <span className="font-semibold">
                  {usarDuracionPersonalizada ? duracionPersonalizada : duracion} min
                </span>
              </div>
              {tasaObjetivo && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Tasa Objetivo:</span>
                  <span className="font-semibold text-[var(--good)]">{tasaObjetivo}%</span>
                </div>
              )}
            </div>

            <div className="mt-6 p-3 bg-blue-900/20 border border-blue-900/50 rounded">
              <p className="text-xs text-blue-200">
                <strong>Siguiente paso:</strong> Después de crear, podrás seleccionar qué bancos participarán en la subasta.
              </p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // PASO 2: Selección de bancos
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Seleccionar Bancos</h2>
        <p className="text-[var(--muted)] mt-1">
          Elige qué bancos podrán participar en esta subasta
        </p>
      </div>

      <Card className="bg-blue-900/10 border-blue-900/50">
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--muted)]">Monto</div>
            <div className="font-bold text-lg">{formatMoney(subastaTemp?.monto || 0, moneda)}</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Plazo</div>
            <div className="font-bold text-lg">{plazo} días</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Duración</div>
            <div className="font-bold text-lg">{duracion} min</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Bancos Seleccionados</div>
            <div className="font-bold text-lg text-green-400">{bancosSeleccionados.size}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">
            Bancos Disponibles ({bancosDisponibles.length})
          </h3>
          <div className="flex gap-2">
            <Button variant="small" onClick={handleSeleccionarTodos}>
              Seleccionar Todos
            </Button>
            <Button variant="small" onClick={handleDeseleccionarTodos}>
              Deseleccionar Todos
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {bancosDisponibles.map(banco => {
            const seleccionado = bancosSeleccionados.has(banco.banco_id)

            return (
              <div
                key={banco.banco_id}
                onClick={() => handleToggleBanco(banco.banco_id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  seleccionado
                    ? 'bg-green-900/20 border-green-900/50'
                    : 'bg-white/5 border-gray-900/50 hover:border-blue-900/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold">{banco.banco_entidad}</div>
                    <div className="text-xs text-[var(--muted)]">{banco.banco_nombre}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={seleccionado}
                    onChange={() => {}} // Manejado por el onClick del div
                    className="w-5 h-5"
                  />
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Límite:</span>
                    <span className="font-semibold">{formatMoney(banco.limite_monto, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Disponible:</span>
                    <span className="font-semibold text-[var(--good)]">
                      {formatMoney(banco.monto_disponible, 'USD')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={handleVolver}
          disabled={loading}
          className="flex-1"
        >
          Volver
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmarSubasta}
          disabled={loading || bancosSeleccionados.size === 0}
          className="flex-1"
        >
          {loading ? 'Abriendo Subasta...' : `Confirmar y Abrir Subasta (${bancosSeleccionados.size} bancos)`}
        </Button>
      </div>
    </div>
  )
}
