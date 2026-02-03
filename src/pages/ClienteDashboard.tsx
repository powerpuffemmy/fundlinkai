import React from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useSubastas } from '@/hooks/useSubastas'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useAuthStore } from '@/store/authStore'
import { formatMoney, formatDate, daysBetween } from '@/lib/utils'

export const ClienteDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const { subastas, loading: loadingSubastas } = useSubastas()
  const { compromisos, loading: loadingCompromisos } = useCompromisos()

  // Filtrar datos del cliente
  const misSubastas = subastas.filter(s => s.cliente_id === user?.id)
  const misCompromisos = compromisos.filter(c => c.cliente_id === user?.id)

  // Calcular métricas
  const subastasAbiertas = misSubastas.filter(s => s.estado === 'abierta')
  const compromisosVigentes = misCompromisos.filter(c => c.estado === 'vigente')
  const montoColocado = compromisosVigentes.reduce((sum, c) => sum + c.monto, 0)
  
  // Calcular tasa promedio ponderada
  const tasaPromedio = compromisosVigentes.length > 0
    ? compromisosVigentes.reduce((sum, c) => sum + (c.tasa * c.monto), 0) / montoColocado
    : 0

  // Bancos únicos con compromisos
  const bancosActivos = new Set(compromisosVigentes.map(c => c.banco_id)).size

  // Últimos 5 compromisos
  const ultimosCompromisos = misCompromisos
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Últimas 3 subastas
  const ultimasSubastas = misSubastas
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)

  const getDiasRestantes = (fechaVencimiento: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    const dias = daysBetween(hoy, fechaVencimiento)
    return dias
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, string> = {
      abierta: 'bg-green-900/20 text-green-200',
      esperando: 'bg-blue-900/20 text-blue-200',
      cerrada: 'bg-gray-900/20 text-gray-200',
      cancelada: 'bg-red-900/20 text-red-200',
      vigente: 'bg-green-900/20 text-green-200'
    }
    return badges[estado] || 'bg-gray-900/20 text-gray-200'
  }

  const loading = loadingSubastas || loadingCompromisos

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Panel de Tesorería</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando datos...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Panel de Tesorería</h2>
        <p className="text-[var(--muted)] mt-1">
          Bienvenido, {user?.entidad}
        </p>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Subastas Activas</div>
          <div className="text-2xl font-black mt-1 text-blue-400">
            {subastasAbiertas.length}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Recibiendo ofertas
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Colocado</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(montoColocado, 'USD')}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            En {compromisosVigentes.length} compromisos
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Tasa Promedio</div>
          <div className="text-2xl font-black mt-1 text-green-400">
            {tasaPromedio.toFixed(2)}%
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Ponderada
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Bancos Activos</div>
          <div className="text-2xl font-black mt-1 text-purple-400">
            {bancosActivos}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Con compromisos
          </div>
        </Card>
      </div>

      {/* Compromisos Vigentes */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Compromisos Vigentes</h3>
          {ultimosCompromisos.length > 0 && (
            <Button variant="small">Ver todos</Button>
          )}
        </div>

        {ultimosCompromisos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--muted)] mb-4">
              No tienes compromisos vigentes aún
            </p>
            <p className="text-sm text-blue-400">
              💡 Crea una subasta para empezar a recibir ofertas de bancos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-2 text-xs text-[var(--muted)]">OP-ID</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Banco</th>
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
                        <div className="font-semibold text-xs">{comp.banco?.entidad}</div>
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

      {/* Grid: Subastas Activas + Acceso Rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subastas Activas */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Subastas Recientes</h3>
            {ultimasSubastas.length > 0 && (
              <Button variant="small">Ver todas</Button>
            )}
          </div>

          {ultimasSubastas.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[var(--muted)] text-sm mb-3">
                No has creado subastas aún
              </p>
              <Button variant="primary">Crear Primera Subasta</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {ultimasSubastas.map(subasta => (
                <div 
                  key={subasta.id} 
                  className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-sm">
                        {formatMoney(subasta.monto, subasta.moneda)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {subasta.plazo} días • {subasta.tipo}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getEstadoBadge(subasta.estado)}`}>
                      {subasta.estado}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--muted)]">
                      {formatDate(subasta.created_at)}
                    </span>
                    {subasta.estado === 'abierta' && (
                      <Button variant="small">Ver Ofertas</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Acceso Rápido */}
        <Card>
          <h3 className="font-bold text-lg mb-4">Acceso Rápido</h3>
          
          <div className="space-y-3">
            <button className="w-full p-4 bg-blue-900/20 hover:bg-blue-900/30 border border-blue-900/50 rounded-lg text-left transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-200 mb-1">Nueva Subasta</div>
                  <div className="text-xs text-blue-300">
                    Crea una solicitud y recibe ofertas de múltiples bancos
                  </div>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
              </div>
            </button>

            <button className="w-full p-4 bg-green-900/20 hover:bg-green-900/30 border border-green-900/50 rounded-lg text-left transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-200 mb-1">Mis Subastas</div>
                  <div className="text-xs text-green-300">
                    {subastasAbiertas.length > 0 
                      ? `${subastasAbiertas.length} subasta(s) esperando ofertas`
                      : 'Revisa el estado de tus solicitudes'
                    }
                  </div>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
              </div>
            </button>

            <button className="w-full p-4 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-900/50 rounded-lg text-left transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-purple-200 mb-1">Compromisos</div>
                  <div className="text-xs text-purple-300">
                    {compromisosVigentes.length} compromiso(s) vigente(s)
                  </div>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
              </div>
            </button>
          </div>
        </Card>
      </div>

      {/* Tips y Recomendaciones */}
      <Card className="bg-blue-900/10 border-blue-900/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <div className="font-semibold text-blue-200 mb-2">Tips de Tesorería</div>
            <ul className="text-sm text-blue-300 space-y-1">
              <li>• Crea subastas con tiempo suficiente para recibir múltiples ofertas</li>
              <li>• Compara las tasas ofrecidas por diferentes bancos</li>
              <li>• Revisa los compromisos próximos a vencer para planificar renovaciones</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
