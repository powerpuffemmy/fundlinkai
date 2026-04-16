import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useSolicitudesColocacion } from '@/hooks/useSolicitudesColocacion'
import { formatMoney } from '@/lib/utils'
import { toastSuccess, toastError } from '@/lib/toastUtils'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { generarPDFSolicitudColocacion, generarPDFOfertaColocacion } from '@/lib/pdfGenerator'
import { useAuthStore } from '@/store/authStore'
import type { SolicitudColocacion, OfertaColocacion } from '@/types/database'

interface ClienteSolicitudesColocacionProps {
  onNueva?: () => void
}

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
    enviada: 'bg-blue-900/30 text-blue-300 border border-blue-900/50',
    aceptada: 'bg-green-900/30 text-green-300 border border-green-900/50',
    rechazada: 'bg-red-900/30 text-red-400 border border-red-900/50'
  }
  const labels: Record<string, string> = {
    enviada: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada'
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[estado] || 'bg-white/10 text-white'}`}>
      {labels[estado] || estado}
    </span>
  )
}

export const ClienteSolicitudesColocacion: React.FC<ClienteSolicitudesColocacionProps> = ({ onNueva }) => {
  const { user } = useAuthStore()
  const { solicitudes, loading, cerrarSolicitud, aceptarOferta, rechazarOferta } = useSolicitudesColocacion()
  const [expandido, setExpandido] = useState<string | null>(null)
  const [confirmCerrar, setConfirmCerrar] = useState<string | null>(null)
  const [confirmAceptar, setConfirmAceptar] = useState<OfertaColocacion | null>(null)
  const [confirmRechazar, setConfirmRechazar] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  const handleCerrar = async (id: string) => {
    try {
      setProcesando(true)
      await cerrarSolicitud(id)
      toastSuccess('Solicitud cerrada correctamente')
    } catch {
      toastError('Error al cerrar la solicitud')
    } finally {
      setProcesando(false)
      setConfirmCerrar(null)
    }
  }

  const handleAceptar = async (oferta: OfertaColocacion) => {
    try {
      setProcesando(true)
      await aceptarOferta(oferta)
      toastSuccess('Oferta aceptada. Se ha creado el compromiso automáticamente.', 4000)
    } catch {
      toastError('Error al aceptar la oferta')
    } finally {
      setProcesando(false)
      setConfirmAceptar(null)
    }
  }

  const handleRechazar = async (ofertaId: string) => {
    try {
      setProcesando(true)
      await rechazarOferta(ofertaId)
      toastSuccess('Oferta rechazada')
    } catch {
      toastError('Error al rechazar la oferta')
    } finally {
      setProcesando(false)
      setConfirmRechazar(null)
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
        <h2 className="text-2xl font-bold">Mis Solicitudes de Colocación</h2>
        <p className="text-[var(--muted)] mt-1">
          Gestiona tus solicitudes y las ofertas recibidas de los bancos
        </p>
      </div>

      {solicitudes.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-[var(--muted)]">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold mb-1">Sin solicitudes aún</p>
            <p className="text-sm">Usa <strong>Nueva Solicitud</strong> en el menú para enviar una solicitud a los bancos.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {(solicitudes as any[]).map((sol) => {
            const abierta = sol.estado === 'abierta'
            const ofertasPendientes = (sol.ofertas || []).filter((o: OfertaColocacion) => o.estado === 'enviada')
            const isExpanded = expandido === sol.id

            return (
              <Card key={sol.id}>
                {/* Header de la solicitud */}
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandido(isExpanded ? null : sol.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      {estadoBadge(sol.estado)}
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
                    <div className="flex gap-4 mt-1 text-sm text-[var(--muted)]">
                      <span>Cierre: {new Date(sol.fecha_cierre).toLocaleDateString('es-GT')}</span>
                      <span className={ofertasPendientes.length > 0 ? 'text-blue-300 font-semibold' : ''}>
                        {(sol.ofertas || []).length} oferta(s)
                        {ofertasPendientes.length > 0 && ` · ${ofertasPendientes.length} pendiente(s)`}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {new Date(sol.created_at).toLocaleString('es-GT')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {/* PDF Solicitud */}
                    <Button
                      variant="small"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        generarPDFSolicitudColocacion({
                          id: sol.id,
                          cliente_nombre: user?.nombre,
                          cliente_entidad: user?.entidad,
                          moneda: sol.moneda,
                          monto: sol.monto,
                          plazo: sol.plazo,
                          tasa_objetivo: sol.tasa_objetivo,
                          tipo_tasa: sol.tipo_tasa,
                          fecha_cierre: sol.fecha_cierre,
                          notas: sol.notas,
                          created_at: sol.created_at,
                        })
                      }}
                    >
                      PDF Sol.
                    </Button>
                    {abierta && (
                      <Button
                        variant="small"
                        onClick={(e) => { e.stopPropagation(); setConfirmCerrar(sol.id) }}
                      >
                        Cerrar
                      </Button>
                    )}
                    <span className="text-[var(--muted)] text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Notas */}
                {sol.notas && (
                  <div className="mt-2 text-sm text-[var(--muted)] italic">"{sol.notas}"</div>
                )}

                {/* Ofertas expandidas */}
                {isExpanded && (
                  <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                    <h4 className="font-semibold text-sm">Ofertas recibidas</h4>
                    {(sol.ofertas || []).length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">Ningún banco ha enviado oferta aún.</p>
                    ) : (
                      (sol.ofertas || []).map((oferta: OfertaColocacion) => (
                        <div
                          key={oferta.id}
                          className={`p-3 rounded-lg border ${
                            oferta.estado === 'aceptada'
                              ? 'bg-green-900/10 border-green-900/40'
                              : oferta.estado === 'rechazada'
                              ? 'bg-red-900/10 border-red-900/30 opacity-60'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {ofertaBadge(oferta.estado)}
                                <span className="font-semibold text-sm">
                                  {(oferta as any).banco?.nombre || 'Banco'}
                                </span>
                              </div>
                              <div className="flex gap-4 text-sm">
                                <span>
                                  Tasa: <strong className="text-[var(--good)]">{oferta.tasa}%</strong>
                                </span>
                                <span>
                                  Monto: <strong>{formatMoney(oferta.monto, sol.moneda)}</strong>
                                </span>
                              </div>
                              {oferta.notas && (
                                <p className="text-xs text-[var(--muted)] mt-1">"{oferta.notas}"</p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-[var(--muted)]">
                                  {new Date(oferta.created_at).toLocaleString('es-GT')}
                                </span>
                                <Button
                                  variant="small"
                                  className="text-xs py-0.5 px-2"
                                  onClick={() => generarPDFOfertaColocacion({
                                    id: oferta.id,
                                    tasa: oferta.tasa,
                                    monto: oferta.monto,
                                    notas: oferta.notas,
                                    created_at: oferta.created_at,
                                    banco_nombre: (oferta as any).banco?.nombre,
                                    banco_entidad: (oferta as any).banco?.entidad || (oferta as any).banco?.nombre,
                                    cliente_nombre: user?.nombre,
                                    cliente_entidad: user?.entidad,
                                    solicitud_plazo: sol.plazo,
                                    solicitud_moneda: sol.moneda,
                                  })}
                                >
                                  PDF Oferta
                                </Button>
                              </div>
                            </div>
                            {oferta.estado === 'enviada' && abierta && (
                              <div className="flex gap-2 ml-3">
                                <Button
                                  variant="primary"
                                  className="text-xs py-1 px-3"
                                  onClick={() => setConfirmAceptar(oferta)}
                                  disabled={procesando}
                                >
                                  Aceptar
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="text-xs py-1 px-3"
                                  onClick={() => setConfirmRechazar(oferta.id)}
                                  disabled={procesando}
                                >
                                  Rechazar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modales de confirmación */}
      <ConfirmModal
        isOpen={!!confirmCerrar}
        title="Cerrar Solicitud"
        message="¿Estás seguro de cerrar esta solicitud? Las ofertas pendientes quedarán sin respuesta."
        onConfirm={() => confirmCerrar && handleCerrar(confirmCerrar)}
        onCancel={() => setConfirmCerrar(null)}
        confirmText="Cerrar Solicitud"
        cancelText="Cancelar"
      />

      <ConfirmModal
        isOpen={!!confirmAceptar}
        title="Aceptar Oferta"
        message={confirmAceptar
          ? `¿Aceptar la oferta de ${(confirmAceptar as any).banco?.nombre || 'el banco'} a tasa ${confirmAceptar.tasa}% por ${formatMoney(confirmAceptar.monto, 'GTQ')}? Se creará un compromiso automáticamente y se rechazarán las demás ofertas.`
          : ''}
        onConfirm={() => confirmAceptar && handleAceptar(confirmAceptar)}
        onCancel={() => setConfirmAceptar(null)}
        confirmText="Aceptar y Crear Compromiso"
        cancelText="Cancelar"
        confirmVariant="primary"
      />

      <ConfirmModal
        isOpen={!!confirmRechazar}
        title="Rechazar Oferta"
        message="¿Rechazar esta oferta del banco?"
        onConfirm={() => confirmRechazar && handleRechazar(confirmRechazar)}
        onCancel={() => setConfirmRechazar(null)}
        confirmText="Rechazar"
        cancelText="Cancelar"
      />
    </div>
  )
}
