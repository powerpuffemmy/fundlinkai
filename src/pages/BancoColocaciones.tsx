import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { useSolicitudesColocacion } from '@/hooks/useSolicitudesColocacion'
import { useAuthStore } from '@/store/authStore'
import { formatMoney } from '@/lib/utils'
import { toastSuccess, toastError } from '@/lib/toastUtils'
import type { OfertaColocacion } from '@/types/database'

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    abierta: 'bg-green-900/30 text-green-300 border border-green-900/50',
    cerrada: 'bg-gray-900/30 text-gray-400 border border-gray-700/50',
    cancelada: 'bg-red-900/30 text-red-400 border border-red-900/50'
  }
  const labels: Record<string, string> = {
    abierta: 'Abierta', cerrada: 'Cerrada', cancelada: 'Cancelada'
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[estado] || 'bg-white/10 text-white'}`}>
      {labels[estado] || estado}
    </span>
  )
}

const ofertaBadge = (estado: string) => {
  const map: Record<string, string> = {
    enviada: 'bg-blue-900/30 text-blue-300',
    aceptada: 'bg-green-900/30 text-green-300',
    rechazada: 'bg-red-900/30 text-red-400'
  }
  const labels: Record<string, string> = {
    enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada'
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[estado] || 'bg-white/10 text-white'}`}>
      {labels[estado] || estado}
    </span>
  )
}

export const BancoColocaciones: React.FC = () => {
  const { user } = useAuthStore()
  const { solicitudes, loading, enviarOferta } = useSolicitudesColocacion()

  const [expandido, setExpandido] = useState<string | null>(null)
  const [formOferta, setFormOferta] = useState<Record<string, { tasa: string; monto: string; notas: string }>>({})
  const [enviando, setEnviando] = useState<string | null>(null)

  const esAuditor = user?.role === 'banco_auditor'

  const getFormOferta = (solicitudId: string) =>
    formOferta[solicitudId] || { tasa: '', monto: '', notas: '' }

  const setFormField = (solicitudId: string, field: 'tasa' | 'monto' | 'notas', value: string) => {
    setFormOferta(prev => ({
      ...prev,
      [solicitudId]: { ...getFormOferta(solicitudId), [field]: value }
    }))
  }

  const handleEnviarOferta = async (solicitudId: string, moneda: string) => {
    const form = getFormOferta(solicitudId)
    const tasa = parseFloat(form.tasa)
    const monto = parseFloat(form.monto)

    if (!form.tasa || isNaN(tasa) || tasa <= 0 || tasa > 50) {
      toastError('Ingresa una tasa válida (0 - 50%)')
      return
    }
    if (!form.monto || isNaN(monto) || monto <= 0) {
      toastError('Ingresa un monto válido')
      return
    }

    try {
      setEnviando(solicitudId)
      await enviarOferta({
        solicitud_id: solicitudId,
        tasa,
        monto,
        notas: form.notas || undefined
      })
      // Limpiar formulario
      setFormOferta(prev => ({ ...prev, [solicitudId]: { tasa: '', monto: '', notas: '' } }))
      toastSuccess('Oferta enviada correctamente')
    } catch {
      toastError('Error al enviar la oferta')
    } finally {
      setEnviando(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Solicitudes de Colocación</h2>
        <p className="text-[var(--muted)] mt-1">
          {esAuditor
            ? 'Consulta las solicitudes de colocación recibidas'
            : 'Responde con tasa en firme a las solicitudes de tus clientes'}
        </p>
      </div>

      {solicitudes.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-[var(--muted)]">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-semibold">Sin solicitudes disponibles</p>
            <p className="text-sm mt-1">Los clientes te enviarán solicitudes de colocación aquí.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {(solicitudes as any[]).map((sol) => {
            const isExpanded = expandido === sol.id
            const abierta = sol.estado === 'abierta'
            const misOfertas: OfertaColocacion[] = sol.ofertas || []
            const tieneOfertaActiva = misOfertas.some(o => o.estado === 'enviada')
            const vencida = new Date(sol.fecha_cierre) < new Date()
            const form = getFormOferta(sol.id)

            return (
              <Card key={sol.id}>
                {/* Header */}
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandido(isExpanded ? null : sol.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      {estadoBadge(sol.estado)}
                      {vencida && abierta && (
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/30 text-yellow-300 border border-yellow-900/50">
                          Vencida
                        </span>
                      )}
                      <span className="font-semibold text-lg">
                        {sol.monto ? `Máx. ${formatMoney(sol.monto, sol.moneda)}` : 'Monto libre'} · {sol.plazo} días · {sol.moneda}
                      </span>
                      {sol.tasa_objetivo && (
                        <span className="text-sm font-semibold text-[var(--good)]">
                          {sol.tasa_objetivo}%
                          {sol.tipo_tasa && (
                            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-white/10 text-white capitalize">
                              {sol.tipo_tasa}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-[var(--muted)] flex-wrap">
                      <span>Cliente: <strong className="text-white">{sol.cliente?.nombre} ({sol.cliente?.entidad})</strong></span>
                      <span>Cierre: {new Date(sol.fecha_cierre).toLocaleDateString('es-GT')}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      Recibida: {new Date(sol.created_at).toLocaleString('es-GT')}
                      {misOfertas.length > 0 && (
                        <span className="ml-3">· {misOfertas.length} oferta(s) enviada(s) por ti</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[var(--muted)] text-sm ml-3">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Notas del cliente */}
                {sol.notas && (
                  <div className="mt-2 text-sm text-[var(--muted)] italic">
                    Nota del cliente: "{sol.notas}"
                  </div>
                )}

                {/* Panel expandido */}
                {isExpanded && (
                  <div className="mt-4 border-t border-white/10 pt-4 space-y-4">

                    {/* Mis ofertas previas */}
                    {misOfertas.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Mis ofertas enviadas</h4>
                        <div className="space-y-2">
                          {misOfertas.map(oferta => (
                            <div
                              key={oferta.id}
                              className={`p-3 rounded border flex justify-between items-center text-sm ${
                                oferta.estado === 'aceptada'
                                  ? 'bg-green-900/10 border-green-900/40'
                                  : oferta.estado === 'rechazada'
                                  ? 'bg-red-900/10 border-red-900/30 opacity-60'
                                  : 'bg-white/5 border-white/10'
                              }`}
                            >
                              <div className="flex gap-4">
                                <span>Tasa: <strong className="text-[var(--good)]">{oferta.tasa}%</strong></span>
                                <span>Monto: <strong>{formatMoney(oferta.monto, sol.moneda)}</strong></span>
                                {oferta.notas && <span className="text-[var(--muted)] italic">"{oferta.notas}"</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {ofertaBadge(oferta.estado)}
                                <span className="text-xs text-[var(--muted)]">
                                  {new Date(oferta.created_at).toLocaleDateString('es-GT')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formulario nueva oferta */}
                    {!esAuditor && abierta && !vencida && (
                      <div>
                        <h4 className="font-semibold text-sm mb-3">
                          {tieneOfertaActiva ? 'Enviar oferta adicional' : 'Enviar oferta'}
                        </h4>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <Input
                            label="Tasa en firme (%)"
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="50"
                            value={form.tasa}
                            onChange={e => setFormField(sol.id, 'tasa', e.target.value)}
                            placeholder="Ej: 5.75"
                          />
                          <Input
                            label={`Monto (${sol.moneda})`}
                            type="number"
                            min="1"
                            step="1000"
                            value={form.monto}
                            onChange={e => setFormField(sol.id, 'monto', e.target.value)}
                            placeholder={sol.monto ? String(sol.monto) : 'Ej: 5000000'}
                          />
                          <div className="space-y-1">
                            <label className="text-sm text-[var(--muted)]">Notas (opcional)</label>
                            <input
                              type="text"
                              value={form.notas}
                              onChange={e => setFormField(sol.id, 'notas', e.target.value)}
                              placeholder="Condiciones especiales..."
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                            />
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          className="mt-3"
                          onClick={() => handleEnviarOferta(sol.id, sol.moneda)}
                          disabled={enviando === sol.id}
                        >
                          {enviando === sol.id ? 'Enviando...' : 'Enviar Oferta'}
                        </Button>
                      </div>
                    )}

                    {esAuditor && (
                      <div className="text-sm text-[var(--muted)] italic">
                        Modo auditor: solo lectura.
                      </div>
                    )}

                    {!abierta && (
                      <div className="text-sm text-[var(--muted)]">
                        Esta solicitud está {sol.estado} — no se pueden enviar más ofertas.
                      </div>
                    )}

                    {abierta && vencida && !esAuditor && (
                      <div className="text-sm text-yellow-300">
                        La fecha de cierre ya pasó. El cliente puede cerrar la solicitud.
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
