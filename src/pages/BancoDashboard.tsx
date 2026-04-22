import React, { useState, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useOfertas } from '@/hooks/useOfertas'
import { useSubastas } from '@/hooks/useSubastas'
import { useSolicitudesColocacion } from '@/hooks/useSolicitudesColocacion'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate, daysBetween, formatTipoSubasta } from '@/lib/utils'

interface BancoDashboardProps {
  onNavigate?: (page: 'dashboard' | 'solicitudes' | 'ofertas' | 'aprobaciones' | 'compromisos' | 'colocaciones' | 'configuracion') => void
}

export const BancoDashboard: React.FC<BancoDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuthStore()
  const { compromisos, loading: loadingCompromisos } = useCompromisos()
  const { ofertas, loading: loadingOfertas } = useOfertas()
  const { subastas, loading: loadingSubastas } = useSubastas()
  const { solicitudes: solicitudesColocacion, loading: loadingColocaciones } = useSolicitudesColocacion()
  const [pendientesAprobacion, setPendientesAprobacion] = useState(0)

  useEffect(() => {
    if (user?.role !== 'banco_admin') return
    supabase.rpc('obtener_ofertas_colocacion_pendientes_admin').then(({ data }) => {
      setPendientesAprobacion((data || []).length)
    })
  }, [user?.role])

  // Filtrar datos del banco
  const misCompromisos = compromisos.filter(c => c.banco_id === user?.id)
  const misOfertas = ofertas.filter(o => o.banco_id === user?.id)
  
  // Filtrar solicitudes disponibles (subastas abiertas donde NO ha ofertado)
  const subastasConOferta = new Set(misOfertas.map(o => o.subasta_id))
  const solicitudesDisponibles = subastas.filter(
    s => s.estado === 'abierta' && !subastasConOferta.has(s.id)
  )

  // Calcular métricas
  const compromisosVigentes = misCompromisos.filter(c => c.estado === 'vigente')
  const montoTotalColocado = compromisosVigentes.reduce((sum, c) => sum + c.monto, 0)
  const ofertasEnviadas = misOfertas.length
  const ofertasAdjudicadas = misOfertas.filter(o => o.estado === 'adjudicada').length

  // Métricas de colocaciones
  const ahora = new Date()
  const colSinOferta = solicitudesColocacion.filter(s =>
    (!s.ofertas || s.ofertas.length === 0) &&
    s.estado === 'abierta' &&
    new Date(s.fecha_cierre) >= ahora
  )
  const colConOferta = solicitudesColocacion.filter(s => s.ofertas && s.ofertas.length > 0)
  const colAceptadas = solicitudesColocacion.filter(s => s.ofertas?.some(o => o.estado === 'aceptada'))

  // Obtener últimos 5 compromisos
  const ultimosCompromisos = misCompromisos
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Obtener últimas 5 ofertas
  const ultimasOfertas = misOfertas
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const getDiasRestantes = (fechaVencimiento: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    const dias = daysBetween(hoy, fechaVencimiento)
    return dias
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, string> = {
      enviada: 'bg-blue-900/20 text-blue-200',
      aprobada: 'bg-green-900/20 text-green-200',
      rechazada: 'bg-red-900/20 text-red-200',
      adjudicada: 'bg-sky-900/20 text-sky-200',
      vigente: 'bg-green-900/20 text-green-200',
      vencido: 'bg-red-900/20 text-red-200'
    }
    return badges[estado] || 'bg-gray-900/20 text-gray-200'
  }

  const loading = loadingCompromisos || loadingOfertas || loadingSubastas || loadingColocaciones

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Panel de Banco</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando datos...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Panel de Banco</h2>
        <p className="text-[var(--muted)] mt-1">
          Bienvenido, {user?.entidad}
        </p>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Solicitudes Disponibles</div>
          <div className="text-2xl font-black mt-1 text-blue-400">
            {solicitudesDisponibles.length}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Para ofertar
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Compromisos Vigentes</div>
          <div className="text-2xl font-black mt-1 text-green-400">
            {compromisosVigentes.length}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Activos
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Colocado</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(montoTotalColocado, 'GTQ')}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Total vigente
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Ofertas Enviadas</div>
          <div className="text-2xl font-black mt-1 text-sky-400">
            {ofertasEnviadas}
          </div>
          <div className="text-xs text-green-400 mt-1">
            {ofertasAdjudicadas} adjudicadas
          </div>
        </Card>
      </div>

      {/* Sección: Compromisos Vigentes */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Compromisos Vigentes</h3>
          {ultimosCompromisos.length > 0 && (
            <Button 
              variant="small"
              onClick={() => onNavigate?.('compromisos')}
            >
              Ver todos
            </Button>
          )}
        </div>

        {ultimosCompromisos.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-6">
            No tienes compromisos vigentes aún
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-2 text-xs text-[var(--muted)]">OP-ID</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Cliente</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Monto</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Tasa</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Vencimiento</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Días Rest.</th>
                </tr>
              </thead>
              <tbody>
                {ultimosCompromisos.map(comp => {
                  const diasRestantes = getDiasRestantes(comp.fecha_vencimiento)
                  const alertClass = diasRestantes <= 7 ? 'text-[var(--bad)]' : 
                                    diasRestantes <= 30 ? 'text-[var(--warn)]' : 
                                    'text-[var(--good)]'

                  return (
                    <tr key={comp.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-2">
                        <span className="font-mono text-xs font-semibold">{comp.op_id}</span>
                      </td>
                      <td className="p-2">
                        <div className="font-semibold text-xs">{comp.cliente?.entidad}</div>
                      </td>
                      <td className="p-2 font-semibold">
                        {formatMoney(comp.monto, comp.moneda)}
                      </td>
                      <td className="p-2 font-semibold text-[var(--good)]">
                        {comp.tasa}%
                      </td>
                      <td className="p-2">{formatDate(comp.fecha_vencimiento)}</td>
                      <td className="p-2">
                        <span className={`font-semibold ${alertClass}`}>
                          {diasRestantes} días
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Grid de 2 columnas: Ofertas Recientes + Solicitudes Disponibles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ofertas Recientes */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Ofertas Recientes</h3>
            {ultimasOfertas.length > 0 && (
              <Button 
                variant="small"
                onClick={() => onNavigate?.('ofertas')}
              >
                Ver todas
              </Button>
            )}
          </div>

          {ultimasOfertas.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-6 text-sm">
              No has enviado ofertas aún
            </p>
          ) : (
            <div className="space-y-2">
              {ultimasOfertas.map(oferta => (
                <div 
                  key={oferta.id} 
                  className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-sm">{oferta.cliente?.entidad}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {oferta.subasta?.monto && oferta.subasta?.moneda
                          ? formatMoney(oferta.subasta.monto, oferta.subasta.moneda as 'USD' | 'GTQ')
                          : '—'
                        } • {oferta.subasta?.plazo} días
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getEstadoBadge(oferta.estado)}`}>
                      {oferta.estado}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      Tu tasa: <strong className="text-[var(--good)]">{oferta.tasa}%</strong>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {formatDate(oferta.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Solicitudes Disponibles */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Solicitudes Disponibles</h3>
            {solicitudesDisponibles.length > 0 && (
              <Button 
                variant="small"
                onClick={() => onNavigate?.('solicitudes')}
              >
                Ver todas
              </Button>
            )}
          </div>

          {solicitudesDisponibles.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-6 text-sm">
              No hay solicitudes disponibles
            </p>
          ) : (
            <div className="space-y-2">
              {solicitudesDisponibles.slice(0, 5).map(subasta => (
                <div 
                  key={subasta.id} 
                  className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-blue-900/30"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-sm">{subasta.cliente?.entidad}</div>
                      <div className="text-xs text-[var(--muted)]">{subasta.cliente?.nombre}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-blue-900/20 text-blue-200">
                      {formatTipoSubasta(subasta.tipo)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <strong>{formatMoney(subasta.monto, subasta.moneda)}</strong>
                      <span className="text-[var(--muted)] ml-2">• {subasta.plazo} días</span>
                    </div>
                    <Button 
                      variant="small"
                      onClick={() => onNavigate?.('solicitudes')}
                    >
                      Ofertar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Sección: Colocaciones Directas */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Colocaciones Directas</h3>
          <Button variant="small" onClick={() => onNavigate?.('colocaciones')}>Ver todas</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <div className="text-xs text-[var(--muted)] mb-1">Invitaciones</div>
            <div className="text-xl font-black text-teal-400">{solicitudesColocacion.length}</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <div className="text-xs text-[var(--muted)] mb-1">Por Responder</div>
            <div className="text-xl font-black text-yellow-400">{colSinOferta.length}</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <div className="text-xs text-[var(--muted)] mb-1">Con Oferta</div>
            <div className="text-xl font-black text-blue-400">{colConOferta.length}</div>
          </div>
          {user?.role === 'banco_admin' ? (
            <div className={`p-3 rounded-lg text-center ${pendientesAprobacion > 0 ? 'bg-yellow-900/20 border border-yellow-900/40' : 'bg-white/5'}`}>
              <div className={`text-xs mb-1 ${pendientesAprobacion > 0 ? 'text-yellow-300' : 'text-[var(--muted)]'}`}>Pend. Aprobación</div>
              <div className={`text-xl font-black ${pendientesAprobacion > 0 ? 'text-yellow-400' : ''}`}>{pendientesAprobacion}</div>
            </div>
          ) : (
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <div className="text-xs text-[var(--muted)] mb-1">Aceptadas</div>
              <div className="text-xl font-black text-green-400">{colAceptadas.length}</div>
            </div>
          )}
        </div>

        {solicitudesColocacion.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-4 text-sm">No tienes solicitudes de colocación asignadas</p>
        ) : (
          <div className="space-y-2">
            {solicitudesColocacion.slice(0, 4).map(sol => {
              const oferta = sol.ofertas?.[0]
              const abierta = sol.estado === 'abierta' && new Date(sol.fecha_cierre) >= ahora
              return (
                <div key={sol.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{(sol as any).cliente?.entidad || '—'}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {sol.monto ? formatMoney(sol.monto, sol.moneda) : 'Monto libre'} · {sol.plazo} días · {sol.moneda}
                    </div>
                  </div>
                  <div className="text-right">
                    {!abierta ? (
                      <span className="text-xs px-2 py-1 rounded bg-gray-900/30 text-gray-400">Cerrada</span>
                    ) : !oferta ? (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-900/20 text-yellow-300">Sin respuesta</span>
                    ) : oferta.estado === 'aceptada' ? (
                      <span className="text-xs px-2 py-1 rounded bg-green-900/20 text-green-300">Aceptada {oferta.tasa}%</span>
                    ) : oferta.estado === 'rechazada' ? (
                      <span className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-300">Rechazada</span>
                    ) : (
                      <div>
                        <span className="text-xs px-2 py-1 rounded bg-blue-900/20 text-blue-300">{oferta.tasa}% enviada</span>
                        {user?.role === 'banco_mesa' && !oferta.aprobada_por_admin && (
                          <div className="text-xs text-yellow-400 mt-0.5">Pend. aprobación</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Nota informativa según el rol */}
      {user?.role === 'banco_mesa' && (
        <Card className="bg-blue-900/10 border-blue-900/30">
          <div>
            <div className="font-semibold text-blue-200 mb-1">Rol: Mesa de Dinero</div>
            <p className="text-sm text-blue-300">
              Tus ofertas requieren aprobación del Administrador del banco antes de ser enviadas a los clientes.
            </p>
          </div>
        </Card>
      )}

      {user?.role === 'banco_auditor' && (
        <Card className="bg-yellow-900/10 border-yellow-900/30">
          <div>
            <div className="font-semibold text-yellow-200 mb-1">Rol: Auditor</div>
            <p className="text-sm text-yellow-300">
              Como auditor, tienes acceso de solo lectura. No puedes enviar ofertas ni realizar transacciones.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
