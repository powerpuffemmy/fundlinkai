import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateTime } from '@/lib/utils'

interface OfertaPendiente {
  id: string
  subasta_id: string
  banco_id: string
  tasa: number
  estado: string
  aprobada_por_admin: boolean
  created_at: string
  usuario_nombre: string
  subasta_monto: number
  subasta_moneda: string
  subasta_plazo: number
  subasta_tipo: string
}

interface OfertaColocacionPendiente {
  id: string
  solicitud_id: string
  banco_id: string
  tasa: number
  monto: number
  notas: string | null
  estado: string
  aprobada_por_admin: boolean
  created_at: string
  usuario_nombre: string
  cliente_nombre: string
  solicitud_moneda: string
  solicitud_plazo: number
  solicitud_monto: number | null
}

export const BancoAprobaciones: React.FC = () => {
  const { user } = useAuthStore()
  const [ofertas, setOfertas] = useState<OfertaPendiente[]>([])
  const [ofertasColocacion, setOfertasColocacion] = useState<OfertaColocacionPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<Record<string, boolean>>({})

  const cargarOfertas = async () => {
    if (!user || user.role !== 'banco_admin') return

    try {
      setLoading(true)

      const [subasResponse, colocResponse] = await Promise.all([
        supabase.rpc('obtener_ofertas_pendientes_admin'),
        supabase.rpc('obtener_ofertas_colocacion_pendientes_admin'),
      ])

      if (subasResponse.error) throw subasResponse.error
      if (colocResponse.error) throw colocResponse.error

      setOfertas((subasResponse.data || []) as OfertaPendiente[])
      setOfertasColocacion((colocResponse.data || []) as OfertaColocacionPendiente[])
    } catch (error) {
      console.error('Error cargando ofertas:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarOfertas()
  }, [user])

  const handleAprobar = async (ofertaId: string) => {
    try {
      setProcesando(prev => ({ ...prev, [ofertaId]: true }))

      const { error } = await supabase
        .from('ofertas')
        .update({ aprobada_por_admin: true })
        .eq('id', ofertaId)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Aprobar Oferta Mesa',
        p_detalle: `Admin aprobó oferta de Mesa`,
        p_metadata: { oferta_id: ofertaId }
      })

      alert('Oferta aprobada exitosamente')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al aprobar:', error)
      alert('Error al aprobar la oferta')
    } finally {
      setProcesando(prev => ({ ...prev, [ofertaId]: false }))
    }
  }

  const handleRechazar = async (ofertaId: string) => {
    const confirmar = window.confirm('¿Seguro que deseas rechazar esta oferta?')
    if (!confirmar) return

    try {
      setProcesando(prev => ({ ...prev, [ofertaId]: true }))

      const { error } = await supabase
        .from('ofertas')
        .update({ estado: 'rechazada' })
        .eq('id', ofertaId)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Rechazar Oferta Mesa',
        p_detalle: `Admin rechazó oferta de Mesa`,
        p_metadata: { oferta_id: ofertaId }
      })

      alert('Oferta rechazada')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al rechazar:', error)
      alert('Error al rechazar la oferta')
    } finally {
      setProcesando(prev => ({ ...prev, [ofertaId]: false }))
    }
  }

  const handleAprobarColocacion = async (ofertaId: string) => {
    try {
      setProcesando(prev => ({ ...prev, [ofertaId]: true }))

      const { error } = await supabase
        .from('ofertas_colocacion')
        .update({ aprobada_por_admin: true })
        .eq('id', ofertaId)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Aprobar Oferta Colocación Mesa',
        p_detalle: `Admin aprobó oferta de colocación de Mesa`,
        p_metadata: { oferta_id: ofertaId }
      })

      alert('Oferta de colocación aprobada')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al aprobar colocación:', error)
      alert('Error al aprobar la oferta de colocación')
    } finally {
      setProcesando(prev => ({ ...prev, [ofertaId]: false }))
    }
  }

  const handleRechazarColocacion = async (ofertaId: string) => {
    const confirmar = window.confirm('¿Seguro que deseas rechazar esta oferta de colocación?')
    if (!confirmar) return

    try {
      setProcesando(prev => ({ ...prev, [ofertaId]: true }))

      const { error } = await supabase
        .from('ofertas_colocacion')
        .update({ estado: 'rechazada' })
        .eq('id', ofertaId)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Rechazar Oferta Colocación Mesa',
        p_detalle: `Admin rechazó oferta de colocación de Mesa`,
        p_metadata: { oferta_id: ofertaId }
      })

      alert('Oferta de colocación rechazada')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al rechazar colocación:', error)
      alert('Error al rechazar la oferta de colocación')
    } finally {
      setProcesando(prev => ({ ...prev, [ofertaId]: false }))
    }
  }

  if (user?.role !== 'banco_admin') {
    return (
      <Card>
        <p className="text-[var(--muted)]">
          Solo los administradores del banco pueden ver esta sección.
        </p>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Aprobaciones</h2>
        <Card><p className="text-[var(--muted)]">Cargando...</p></Card>
      </div>
    )
  }

  const totalPendientes = ofertas.length + ofertasColocacion.length

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Aprobaciones de Mesa de Dinero</h2>
        {totalPendientes > 0 ? (
          <p className="text-[var(--muted)] mt-1">{totalPendientes} oferta(s) pendiente(s) de aprobación</p>
        ) : (
          <p className="text-[var(--muted)] mt-1">No hay ofertas pendientes</p>
        )}
      </div>

      {/* ─── Sección 1: Subastas ─── */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Subastas
          {ofertas.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 text-xs font-bold">
              {ofertas.length}
            </span>
          )}
        </h3>

        {ofertas.length === 0 ? (
          <Card>
            <p className="text-[var(--muted)] text-center py-6 text-sm">
              No hay ofertas de subasta pendientes
            </p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Enviada por</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Subasta</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Plazo</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Fecha</th>
                    <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ofertas.map(oferta => (
                    <tr key={oferta.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-semibold text-sm">{oferta.usuario_nombre}</div>
                        <div className="text-xs text-[var(--muted)]">Mesa de Dinero</div>
                      </td>
                      <td className="p-3 text-sm">{oferta.subasta_tipo || '—'}</td>
                      <td className="p-3 font-semibold">
                        {formatMoney(oferta.subasta_monto, oferta.subasta_moneda as 'GTQ' | 'USD')}
                      </td>
                      <td className="p-3 text-sm">{oferta.subasta_plazo || '—'} días</td>
                      <td className="p-3">
                        <span className="font-bold text-[var(--good)] text-lg">{oferta.tasa}%</span>
                      </td>
                      <td className="p-3 text-xs">{formatDateTime(oferta.created_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="primary"
                            className="text-xs"
                            onClick={() => handleAprobar(oferta.id)}
                            disabled={procesando[oferta.id]}
                          >
                            {procesando[oferta.id] ? 'Aprobando...' : 'Aprobar'}
                          </Button>
                          <Button
                            variant="small"
                            className="text-xs"
                            onClick={() => handleRechazar(oferta.id)}
                            disabled={procesando[oferta.id]}
                          >
                            Rechazar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ─── Sección 2: Solicitudes de Colocación ─── */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Solicitudes de Colocación
          {ofertasColocacion.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 text-xs font-bold">
              {ofertasColocacion.length}
            </span>
          )}
        </h3>

        {ofertasColocacion.length === 0 ? (
          <Card>
            <p className="text-[var(--muted)] text-center py-6 text-sm">
              No hay ofertas de colocación pendientes
            </p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Enviada por</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Cliente</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Solicitud</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Oferta</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                    <th className="text-left p-3 text-sm text-[var(--muted)]">Fecha</th>
                    <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ofertasColocacion.map(oferta => (
                    <tr key={oferta.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-semibold text-sm">{oferta.usuario_nombre}</div>
                        <div className="text-xs text-[var(--muted)]">Mesa de Dinero</div>
                      </td>
                      <td className="p-3 text-sm font-semibold">{oferta.cliente_nombre}</td>
                      <td className="p-3 text-sm">
                        <div>{oferta.solicitud_plazo} días · {oferta.solicitud_moneda}</div>
                        {oferta.solicitud_monto && (
                          <div className="text-xs text-[var(--muted)]">
                            Máx. {formatMoney(oferta.solicitud_monto, oferta.solicitud_moneda as 'GTQ' | 'USD')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-semibold">
                        {formatMoney(oferta.monto, oferta.solicitud_moneda as 'GTQ' | 'USD')}
                        {oferta.notas && (
                          <div className="text-xs text-[var(--muted)] italic mt-0.5">"{oferta.notas}"</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[var(--good)] text-lg">{oferta.tasa}%</span>
                      </td>
                      <td className="p-3 text-xs">{formatDateTime(oferta.created_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="primary"
                            className="text-xs"
                            onClick={() => handleAprobarColocacion(oferta.id)}
                            disabled={procesando[oferta.id]}
                          >
                            {procesando[oferta.id] ? 'Aprobando...' : 'Aprobar'}
                          </Button>
                          <Button
                            variant="small"
                            className="text-xs"
                            onClick={() => handleRechazarColocacion(oferta.id)}
                            disabled={procesando[oferta.id]}
                          >
                            Rechazar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
