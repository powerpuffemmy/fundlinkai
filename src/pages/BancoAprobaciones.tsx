import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateTime } from '@/lib/utils'
import { notifNuevaOferta, notifOfertaColocacionRecibida } from '@/lib/notificaciones'

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
  // Para notificación al aprobar
  subasta_cliente_id?: string
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
  cliente_id?: string
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cargarOfertas = async () => {
    if (!user || user.role !== 'banco_admin') return

    try {
      setLoading(true)
      setErrorMsg(null)

      // ── Subastas: ofertas de Mesa pendientes de aprobación ───────────────────
      // Consulta directa (más confiable que el RPC si hay problemas de banco_id)
      const { data: ofertasRaw, error: e1 } = await supabase
        .from('ofertas')
        .select(`
          id, subasta_id, banco_id, tasa, estado, aprobada_por_admin, created_at,
          usuario:users!banco_id(nombre),
          subasta:subastas!subasta_id(monto, moneda, plazo, tipo, cliente_id)
        `)
        .eq('aprobada_por_admin', false)
        .eq('estado', 'enviada')
        .order('created_at', { ascending: false })

      if (e1) throw e1

      const ofertasMapped: OfertaPendiente[] = (ofertasRaw || []).map((o: any) => ({
        id: o.id,
        subasta_id: o.subasta_id,
        banco_id: o.banco_id,
        tasa: o.tasa,
        estado: o.estado,
        aprobada_por_admin: o.aprobada_por_admin,
        created_at: o.created_at,
        usuario_nombre: o.usuario?.nombre || '—',
        subasta_monto: o.subasta?.monto ?? 0,
        subasta_moneda: o.subasta?.moneda ?? 'GTQ',
        subasta_plazo: o.subasta?.plazo ?? 0,
        subasta_tipo: o.subasta?.tipo ?? '—',
        subasta_cliente_id: o.subasta?.cliente_id,
      }))

      // ── Colocaciones: ofertas de Mesa pendientes de aprobación ───────────────
      const { data: colocRaw, error: e2 } = await supabase
        .from('ofertas_colocacion')
        .select(`
          id, solicitud_id, banco_id, tasa, monto, notas, estado, aprobada_por_admin, created_at,
          usuario:users!banco_id(nombre),
          solicitud:solicitudes_colocacion!solicitud_id(
            moneda, plazo, monto,
            cliente:users!cliente_id(id, nombre, entidad)
          )
        `)
        .eq('aprobada_por_admin', false)
        .eq('estado', 'enviada')
        .order('created_at', { ascending: false })

      if (e2) throw e2

      const colocMapped: OfertaColocacionPendiente[] = (colocRaw || []).map((o: any) => ({
        id: o.id,
        solicitud_id: o.solicitud_id,
        banco_id: o.banco_id,
        tasa: o.tasa,
        monto: o.monto,
        notas: o.notas ?? null,
        estado: o.estado,
        aprobada_por_admin: o.aprobada_por_admin,
        created_at: o.created_at,
        usuario_nombre: o.usuario?.nombre || '—',
        cliente_nombre: o.solicitud?.cliente?.entidad || o.solicitud?.cliente?.nombre || '—',
        cliente_id: o.solicitud?.cliente?.id,
        solicitud_moneda: o.solicitud?.moneda ?? 'GTQ',
        solicitud_plazo: o.solicitud?.plazo ?? 0,
        solicitud_monto: o.solicitud?.monto ?? null,
      }))

      setOfertas(ofertasMapped)
      setOfertasColocacion(colocMapped)
    } catch (error: any) {
      console.error('Error cargando ofertas pendientes:', error)
      setErrorMsg(error?.message || 'Error al cargar las ofertas pendientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarOfertas()
  }, [user])

  // ── Aprobar oferta de subasta ──────────────────────────────────────────────
  const handleAprobar = async (oferta: OfertaPendiente) => {
    try {
      setProcesando(prev => ({ ...prev, [oferta.id]: true }))

      const { error } = await supabase
        .from('ofertas')
        .update({ aprobada_por_admin: true })
        .eq('id', oferta.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Aprobar Oferta Mesa',
        p_detalle: 'Admin aprobó oferta de Mesa',
        p_metadata: { oferta_id: oferta.id },
      })

      // Notificar al cliente ahora que la oferta está aprobada
      if (oferta.subasta_cliente_id) {
        try {
          notifNuevaOferta(oferta.subasta_cliente_id, {
            cliente_nombre: 'Cliente',
            banco_nombre: user?.entidad || user?.nombre || 'Banco',
            monto: oferta.subasta_monto,
            moneda: oferta.subasta_moneda,
            tasa: oferta.tasa,
            plazo: oferta.subasta_plazo,
          })
        } catch { /* no bloquear */ }
      }

      alert('Oferta aprobada exitosamente')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al aprobar:', error)
      alert('Error al aprobar la oferta')
    } finally {
      setProcesando(prev => ({ ...prev, [oferta.id]: false }))
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
        p_detalle: 'Admin rechazó oferta de Mesa',
        p_metadata: { oferta_id: ofertaId },
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

  // ── Aprobar oferta de colocación ───────────────────────────────────────────
  const handleAprobarColocacion = async (oferta: OfertaColocacionPendiente) => {
    try {
      setProcesando(prev => ({ ...prev, [oferta.id]: true }))

      const { error } = await supabase
        .from('ofertas_colocacion')
        .update({ aprobada_por_admin: true })
        .eq('id', oferta.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Aprobar Oferta Colocación Mesa',
        p_detalle: 'Admin aprobó oferta de colocación de Mesa',
        p_metadata: { oferta_id: oferta.id },
      })

      // Notificar al cliente ahora que la oferta de colocación está aprobada
      if (oferta.cliente_id) {
        try {
          notifOfertaColocacionRecibida(oferta.cliente_id, {
            cliente_nombre: oferta.cliente_nombre,
            banco_nombre: user?.entidad || user?.nombre || 'Banco',
            monto: oferta.monto,
            moneda: oferta.solicitud_moneda,
            tasa: oferta.tasa,
            plazo: oferta.solicitud_plazo,
            notas: oferta.notas ?? undefined,
          })
        } catch { /* no bloquear */ }
      }

      alert('Oferta de colocación aprobada')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al aprobar colocación:', error)
      alert('Error al aprobar la oferta de colocación')
    } finally {
      setProcesando(prev => ({ ...prev, [oferta.id]: false }))
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
        p_detalle: 'Admin rechazó oferta de colocación de Mesa',
        p_metadata: { oferta_id: ofertaId },
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

  // ── Guards ─────────────────────────────────────────────────────────────────
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
          <p className="text-[var(--muted)] mt-1">
            {totalPendientes} oferta(s) pendiente(s) de aprobación
          </p>
        ) : (
          <p className="text-[var(--muted)] mt-1">No hay ofertas pendientes</p>
        )}
      </div>

      {errorMsg && (
        <Card className="border-red-900/50 bg-red-900/10">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <Button variant="small" className="mt-2 text-xs" onClick={cargarOfertas}>
            Reintentar
          </Button>
        </Card>
      )}

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
                            onClick={() => handleAprobar(oferta)}
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
                            onClick={() => handleAprobarColocacion(oferta)}
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
