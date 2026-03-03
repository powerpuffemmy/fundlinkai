import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { Button } from '@/components/common/Button'
import { useSolicitudesColocacion } from '@/hooks/useSolicitudesColocacion'
import { useClienteBancoLimites } from '@/hooks/useClienteBancoLimites'
import { useAuthStore } from '@/store/authStore'
import { formatMoney } from '@/lib/utils'
import { toastSuccess, toastError } from '@/lib/toastUtils'
import type { Moneda } from '@/types/database'

interface NuevaSolicitudColocacionProps {
  onCreada?: () => void
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

export const NuevaSolicitudColocacion: React.FC<NuevaSolicitudColocacionProps> = ({ onCreada }) => {
  const { user } = useAuthStore()
  const { crearSolicitud } = useSolicitudesColocacion()
  const { obtenerBancosDisponibles, obtenerTodosBancos } = useClienteBancoLimites()

  // Formulario
  const [moneda, setMoneda] = useState<Moneda>('GTQ')
  const [usarMonto, setUsarMonto] = useState(false)
  const [monto, setMonto] = useState('')
  const [plazo, setPlazo] = useState('30')
  const [usarPlazoPersonalizado, setUsarPlazoPersonalizado] = useState(false)
  const [plazoPersonalizado, setPlazoPersonalizado] = useState('')
  const [tasaObjetivo, setTasaObjetivo] = useState('')
  const [fechaCierre, setFechaCierre] = useState('')
  const [notas, setNotas] = useState('')

  // Flujo 2 pasos
  const [paso, setPaso] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Bancos
  const [bancosDisponibles, setBancosDisponibles] = useState<BancoDisponible[]>([])
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Set<string>>(new Set())
  const [datosTemp, setDatosTemp] = useState<any>(null)

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

  // Fecha mínima: mañana
  const fechaMinima = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const getPlazoFinal = () =>
    usarPlazoPersonalizado ? parseInt(plazoPersonalizado) : parseInt(plazo)

  const handleSiguiente = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user) { setError('Usuario no autenticado'); return }

    const plazoFinal = getPlazoFinal()
    if (usarPlazoPersonalizado && (!plazoPersonalizado || plazoFinal < 1)) {
      setError('El plazo personalizado debe ser al menos 1 día')
      return
    }
    if (!fechaCierre) {
      setError('Debes indicar una fecha de cierre')
      return
    }
    if (usarMonto && (!monto || parseFloat(monto) <= 0)) {
      setError('Ingresa un monto válido')
      return
    }

    try {
      setLoading(true)
      const montoNum = usarMonto ? parseFloat(monto) : null

      let bancos: BancoDisponible[]
      if (montoNum) {
        bancos = await obtenerBancosDisponibles(montoNum)
      } else {
        // Sin monto: mostrar todos los bancos activos del cliente
        const todos = await obtenerTodosBancos()
        bancos = (todos as any[]).map((b: any) => ({
          banco_id: b.banco_id,
          banco_nombre: b.banco_nombre,
          banco_entidad: b.banco_entidad,
          limite_monto: b.limite_monto ?? 0,
          monto_utilizado: b.monto_utilizado ?? 0,
          monto_disponible: b.monto_disponible ?? 0,
          todos_user_ids: b.todos_user_ids ?? []
        }))
      }

      if (bancos.length === 0) {
        setError('No hay bancos configurados. Verifica tu configuración de límites.')
        setLoading(false)
        return
      }

      setDatosTemp({
        moneda,
        monto: montoNum,
        plazo: plazoFinal,
        tasa_objetivo: tasaObjetivo ? parseFloat(tasaObjetivo) : null,
        fecha_cierre: new Date(fechaCierre + 'T23:59:59').toISOString(),
        notas: notas || undefined
      })

      setBancosDisponibles(bancos)
      setBancosSeleccionados(new Set(bancos.map(b => b.banco_id)))
      setPaso(2)
    } catch (err) {
      console.error(err)
      setError('Error al procesar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmar = async () => {
    if (!datosTemp || bancosSeleccionados.size === 0) {
      toastError('Selecciona al menos un banco')
      return
    }

    try {
      setLoading(true)

      // Recopilar todos los user IDs de los bancos seleccionados
      const bancosUserIds = Array.from(bancosSeleccionados).flatMap(bid => {
        const banco = bancosDisponibles.find(b => b.banco_id === bid)
        return banco?.todos_user_ids ?? []
      })

      // Si no hay user IDs, usar los banco_ids directamente
      const idsParaInsertar = bancosUserIds.length > 0 ? bancosUserIds : Array.from(bancosSeleccionados)

      await crearSolicitud(datosTemp, idsParaInsertar)

      toastSuccess(`Solicitud de colocación enviada a ${bancosSeleccionados.size} banco(s).`, 4000)

      setTimeout(() => {
        if (onCreada) onCreada()
      }, 1000)
    } catch (err) {
      console.error(err)
      toastError('Error al crear la solicitud. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleBanco = (bancoId: string) => {
    setBancosSeleccionados(prev => {
      const s = new Set(prev)
      s.has(bancoId) ? s.delete(bancoId) : s.add(bancoId)
      return s
    })
  }

  const handleVolver = () => {
    setPaso(1)
    setBancosDisponibles([])
    setBancosSeleccionados(new Set())
    setDatosTemp(null)
  }

  // PASO 1: Formulario
  if (paso === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Nueva Solicitud de Colocación</h2>
          <p className="text-[var(--muted)] mt-1">
            Envía una solicitud al banco para que proponga una tasa en firme
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-bold mb-4">Parámetros de la Solicitud</h3>

            <form onSubmit={handleSiguiente} className="space-y-4">
              <div className="p-3 rounded border text-xs bg-purple-900/10 border-purple-900/30 text-purple-300">
                📋 El banco recibirá tu solicitud y responderá con una <strong>tasa en firme</strong> y el monto que puede colocar.
              </div>

              <Select
                label="Moneda"
                options={monedas}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
              />

              {/* Monto opcional */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="usarMonto"
                  checked={usarMonto}
                  onChange={(e) => {
                    setUsarMonto(e.target.checked)
                    if (!e.target.checked) setMonto('')
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="usarMonto" className="text-sm cursor-pointer">
                  Especificar monto a colocar
                </label>
              </div>

              {usarMonto && (
                <Input
                  label="Monto"
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="1000"
                  step="1000"
                  placeholder="Ej: 5000000"
                  required
                />
              )}

              {!usarMonto && (
                <div className="p-2 rounded border text-xs bg-white/5 border-white/10 text-[var(--muted)]">
                  Sin monto especificado: el banco propondrá el monto según su capacidad.
                </div>
              )}

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

              <Input
                label="Tasa Objetivo (%) - Opcional"
                type="number"
                step="0.01"
                value={tasaObjetivo}
                onChange={(e) => setTasaObjetivo(e.target.value)}
                placeholder="Ej: 5.50"
              />

              <Input
                label="Fecha de Cierre"
                type="date"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
                min={fechaMinima()}
                required
              />

              <div className="space-y-1">
                <label className="text-sm text-[var(--muted)]">Notas adicionales (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Instrucciones especiales para el banco..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {error && (
                <div className="text-[var(--bad)] text-sm bg-red-900/20 border border-red-900/50 rounded p-3">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? 'Procesando...' : 'Siguiente: Seleccionar Bancos'}
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-bold mb-4">Resumen</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Tipo:</span>
                <span className="font-semibold px-2 py-0.5 rounded text-xs bg-purple-900/20 text-purple-300">
                  Colocación Directa
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Moneda:</span>
                <span className="font-semibold">{moneda}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Monto:</span>
                <span className="font-semibold">
                  {usarMonto && monto
                    ? formatMoney(parseFloat(monto) || 0, moneda)
                    : <span className="text-[var(--muted)] italic">A definir por el banco</span>
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Plazo:</span>
                <span className="font-semibold">
                  {usarPlazoPersonalizado ? (plazoPersonalizado || '—') : plazo} días
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Tasa objetivo:</span>
                <span className="font-semibold text-[var(--good)]">
                  {tasaObjetivo ? `${tasaObjetivo}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Cierre:</span>
                <span className="font-semibold">
                  {fechaCierre ? new Date(fechaCierre).toLocaleDateString('es-GT') : '—'}
                </span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-purple-900/20 border border-purple-900/50 rounded">
              <p className="text-xs text-purple-200">
                <strong>Flujo:</strong> El banco recibe tu solicitud → propone tasa en firme y monto → tú aceptas o rechazas la oferta.
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
          Elige qué bancos recibirán esta solicitud de colocación
        </p>
      </div>

      <Card className="bg-purple-900/10 border-purple-900/50">
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--muted)]">Moneda</div>
            <div className="font-bold text-lg text-purple-300">{datosTemp?.moneda}</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Monto</div>
            <div className="font-bold text-lg">
              {datosTemp?.monto ? formatMoney(datosTemp.monto, datosTemp.moneda) : 'Libre'}
            </div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Plazo</div>
            <div className="font-bold text-lg">{datosTemp?.plazo} días</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Cierre</div>
            <div className="font-bold text-lg">
              {datosTemp?.fecha_cierre
                ? new Date(datosTemp.fecha_cierre).toLocaleDateString('es-GT')
                : '—'}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">
            Bancos Disponibles ({bancosDisponibles.length})
          </h3>
          <div className="flex gap-2">
            <Button variant="small" onClick={() => setBancosSeleccionados(new Set(bancosDisponibles.map(b => b.banco_id)))}>
              Todos
            </Button>
            <Button variant="small" onClick={() => setBancosSeleccionados(new Set())}>
              Ninguno
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {bancosDisponibles.map(banco => {
            const sel = bancosSeleccionados.has(banco.banco_id)
            return (
              <div
                key={banco.banco_id}
                onClick={() => handleToggleBanco(banco.banco_id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  sel
                    ? 'bg-purple-900/20 border-purple-900/50'
                    : 'bg-white/5 border-gray-900/50 hover:border-purple-900/40'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 mr-2">
                    <div className="font-semibold text-sm leading-tight">{banco.banco_nombre}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => {}}
                    className="w-5 h-5 flex-shrink-0"
                  />
                </div>
                {datosTemp?.monto && (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Disponible:</span>
                      <span className="font-semibold text-[var(--good)]">
                        {formatMoney(banco.monto_disponible, 'GTQ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={handleVolver} disabled={loading} className="flex-1">
          Volver
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmar}
          disabled={loading || bancosSeleccionados.size === 0}
          className="flex-1"
        >
          {loading
            ? 'Enviando...'
            : `Enviar Solicitud a ${bancosSeleccionados.size} banco(s)`}
        </Button>
      </div>
    </div>
  )
}
