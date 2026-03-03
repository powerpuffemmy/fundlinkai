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
    enviada: 'bg-blue-900/30 text-blue-300 border border-blue-900/40',
    aceptada: 'bg-green-900/30 text-green-300 border border-green-900/40',
    rechazada: 'bg-red-900/30 text-red-400 border border-red-900/30'
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
  // Contraofertar: qué solicitud tiene el form de contraoferta abierto
  const [contraofertando, setContraofertando] = useState<string | null>(null)
  // Histórico colapsado/expandido
  const [historicoVisible, setHistoricoVisible] = useState(false)

  const esAuditor = user?.role === 'banco_auditor'

  const getFormOferta = (solicitudId: string) =>
    formOferta[solicitudId] || { tasa: '', monto: '', notas: '' }

  const setFormField = (solicitudId: string, field: 'tasa' | 'monto' | 'notas', value: string) => {
    setFormOferta(prev => ({
      ...prev,
      [solicitudId]: { ...getFormOferta(solicitudId), [field]: value }
    }))
  }

  const handleEnviarOferta = async (solicitudId: string, esContraoferta = false) => {
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

    const sol = (solicitudes as any[]).find(s => s.id === solicitudId)
    try {
      setEnviando(solicitudId)
      await enviarOferta({
        solicitud_id: solicitudId,
        tasa,
        monto,
        notas: form.notas || undefined
      })
      setFormOferta(prev => ({ ...prev, [solicitudId]: { tasa: '', monto: '', notas: '' } }))
      if (esContraoferta) {
        setContraofertando(null)
        toastSuccess('Contraoferta enviada correctamente')
      } else {
        toastSuccess(
          user?.role === 'banco_mesa'
            ? 'Oferta enviada — pendiente de aprobación por Admin'
            : 'Oferta enviada correctamente'
        )
      }
      // Mantener el panel expandido para ver el resumen
      setExpandido(solicitudId)
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

  const ahora = new Date()
  const activas = (solicitudes as any[]).filter(s => s.estado === 'abierta' && new Date(s.fecha_cierre) >= ahora)
  const historicas = (solicitudes as any[]).filter(s => s.estado !== 'abierta' || new Date(s.fecha_cierre) < ahora)

  const renderSolicitud = (sol: any, esHistorica = false) => {
    const isExpanded = expandido === sol.id
    const abierta = sol.estado === 'abierta'
    const vencida = new Date(sol.fecha_cierre) < ahora
    const misOfertas: OfertaColocacion[] = sol.ofertas || []
    const ofertaActiva = misOfertas.find(o => o.estado === 'enviada')
    const ofertaAceptada = misOfertas.find(o => o.estado === 'aceptada')
    const form = getFormOferta(sol.id)
    const puedeEnviar = !esAuditor && abierta && !vencida

    return (
      <Card key={sol.id} className={esHistorica ? 'opacity-70' : ''}>
        {/* ── Header clickeable ── */}
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={() => setExpandido(isExpanded ? null : sol.id)}
        >
          <div className="flex-1 min-w-0">
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

            {/* Resumen de oferta en header (visible sin expandir) */}
            {ofertaActiva && (
              <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-900/20 border border-blue-900/40 text-sm">
                <span className="text-blue-300 font-semibold">Tu oferta:</span>
                <span className="text-white font-bold">{ofertaActiva.tasa}%</span>
                <span className="text-[var(--muted)]">·</span>
                <span className="text-white">{formatMoney(ofertaActiva.monto, sol.moneda)}</span>
                {ofertaBadge(ofertaActiva.estado)}
                {user?.role === 'banco_mesa' && (
                  <span className="text-xs text-yellow-400">Pend. aprobación</span>
                )}
              </div>
            )}
            {ofertaAceptada && (
              <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-green-900/20 border border-green-900/40 text-sm">
                <span className="text-green-300 font-semibold">Oferta aceptada:</span>
                <span className="text-white font-bold">{ofertaAceptada.tasa}%</span>
                <span className="text-white">· {formatMoney(ofertaAceptada.monto, sol.moneda)}</span>
              </div>
            )}
          </div>
          <span className="text-[var(--muted)] text-sm ml-3 mt-1 shrink-0">{isExpanded ? '▲' : '▼'}</span>
        </div>

        {sol.notas && (
          <div className="mt-2 text-sm text-[var(--muted)] italic">
            Nota del cliente: "{sol.notas}"
          </div>
        )}

        {/* ── Panel expandido ── */}
        {isExpanded && (
          <div className="mt-4 border-t border-white/10 pt-4 space-y-4">

            {/* Mis ofertas previas */}
            {misOfertas.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Mis ofertas</h4>
                <div className="space-y-2">
                  {misOfertas.map((oferta, idx) => (
                    <div
                      key={oferta.id}
                      className={`p-3 rounded-lg border flex justify-between items-center text-sm ${
                        oferta.estado === 'aceptada'
                          ? 'bg-green-900/10 border-green-900/40'
                          : oferta.estado === 'rechazada'
                          ? 'bg-red-900/10 border-red-900/30 opacity-60'
                          : idx === 0
                          ? 'bg-blue-900/10 border-blue-900/40'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex gap-4 flex-wrap">
                        <span>Tasa: <strong className="text-[var(--good)]">{oferta.tasa}%</strong></span>
                        <span>Monto: <strong>{formatMoney(oferta.monto, sol.moneda)}</strong></span>
                        {oferta.notas && <span className="text-[var(--muted)] italic">"{oferta.notas}"</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ofertaBadge(oferta.estado)}
                        <span className="text-xs text-[var(--muted)]">
                          {new Date(oferta.created_at).toLocaleDateString('es-GT')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botón contraoferta: si tiene oferta activa y solicitud aún abierta */}
                {!esAuditor && ofertaActiva && abierta && !vencida && contraofertando !== sol.id && (
                  <div className="mt-3 p-3 rounded-lg bg-orange-900/10 border border-orange-900/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-orange-300">Derecho de Contraoferta</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          Puedes mejorar tu oferta antes de que el cliente decida.
                        </p>
                      </div>
                      <Button
                        variant="small"
                        className="text-xs border-orange-700 text-orange-300 shrink-0"
                        onClick={() => {
                          setContraofertando(sol.id)
                          setFormField(sol.id, 'tasa', String(ofertaActiva.tasa))
                          setFormField(sol.id, 'monto', String(ofertaActiva.monto))
                        }}
                      >
                        Contraofertar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Formulario nueva oferta / contraoferta */}
            {!esAuditor && puedeEnviar && (!ofertaActiva || contraofertando === sol.id) && (
              <div>
                <h4 className="font-semibold text-sm mb-3">
                  {contraofertando === sol.id
                    ? 'Contraoferta — Mejorar oferta'
                    : misOfertas.length > 0
                    ? 'Enviar oferta adicional'
                    : 'Enviar oferta'}
                </h4>
                {contraofertando === sol.id && (
                  <p className="text-xs text-orange-300 mb-3">
                    Oferta actual: {ofertaActiva?.tasa}% · {ofertaActiva ? formatMoney(ofertaActiva.monto, sol.moneda) : '—'}
                  </p>
                )}
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
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    onClick={() => handleEnviarOferta(sol.id, contraofertando === sol.id)}
                    disabled={enviando === sol.id}
                  >
                    {enviando === sol.id
                      ? 'Enviando...'
                      : contraofertando === sol.id
                      ? 'Enviar Contraoferta'
                      : 'Enviar Oferta'}
                  </Button>
                  {contraofertando === sol.id && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setContraofertando(null)
                        setFormOferta(prev => ({ ...prev, [sol.id]: { tasa: '', monto: '', notas: '' } }))
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                {user?.role === 'banco_mesa' && (
                  <p className="text-xs text-yellow-400 mt-2">
                    Tu oferta quedará pendiente de aprobación por el Admin antes de ser visible al cliente.
                  </p>
                )}
              </div>
            )}

            {esAuditor && (
              <div className="text-sm text-[var(--muted)] italic">Modo auditor: solo lectura.</div>
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

      {/* ── Activas ── */}
      {activas.length === 0 && historicas.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-[var(--muted)]">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-semibold">Sin solicitudes disponibles</p>
            <p className="text-sm mt-1">Los clientes te enviarán solicitudes de colocación aquí.</p>
          </div>
        </Card>
      ) : (
        <>
          {activas.length === 0 ? (
            <Card>
              <p className="text-center text-[var(--muted)] py-6 text-sm">No hay solicitudes activas.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {activas.map(sol => renderSolicitud(sol, false))}
            </div>
          )}

          {/* ── Histórico ── */}
          {historicas.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setHistoricoVisible(v => !v)}
                className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white transition-colors mb-3"
              >
                <span className="text-base">{historicoVisible ? '▼' : '▶'}</span>
                <span className="font-semibold">Histórico ({historicas.length})</span>
                <span className="text-xs">— solicitudes cerradas, canceladas y vencidas</span>
              </button>

              {historicoVisible && (
                <div className="space-y-4">
                  {historicas.map(sol => renderSolicitud(sol, true))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
