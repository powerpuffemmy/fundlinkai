import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/common/Skeleton'
import { ConfirmModal, useConfirm } from '@/components/common/ConfirmModal'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { generarPDFContrato, generarPDFEjecutado } from '@/lib/pdfGenerator'
import { calcularVencimiento, getColorBgVencimiento, getIconoVencimiento } from '@/lib/vencimientoUtils'
import { NuevoCompromisoExternoModal } from '@/components/cliente/NuevoCompromisoExternoModal'
import { useCompromisos } from '@/hooks/useCompromisos'
import toast from 'react-hot-toast'
import type { Compromiso } from '@/types/database'

interface CompromisoConBanco extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
  cliente_nombre?: string
  cliente_entidad?: string
  es_externo?: boolean
  contraparte_nombre?: string
  documento_url?: string
}

type FiltroTipo = 'todos' | 'fundlink' | 'externos'

export const ClienteCompromisos: React.FC = () => {
  const { user } = useAuthStore()
  const { eliminarCompromisoExterno, ejecutarCompromiso } = useCompromisos()
  const { confirm, ConfirmDialog } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [compromisos, setCompromisos] = useState<CompromisoConBanco[]>([])
  const [showNuevoExterno, setShowNuevoExterno] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [ejecutando, setEjecutando] = useState<string | null>(null)

  const cargarCompromisos = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('obtener_compromisos_usuario', { p_user_id: user.id })
      if (error) throw error
      setCompromisos((data || []) as CompromisoConBanco[])
    } catch (error) {
      console.error('Error cargando compromisos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCompromisos()
  }, [user?.id])

  // Filtrar por tipo
  const compromisosFiltrados = compromisos.filter(c => {
    if (filtroTipo === 'fundlink') return !c.es_externo
    if (filtroTipo === 'externos') return c.es_externo
    return true
  })

  // Compromisos próximos a vencer (< 15 días)
  const compromisosProximosVencer = compromisosFiltrados
    .filter(c => ['vigente', 'ejecutado'].includes(c.estado))
    .map(c => ({ ...c, vencimiento: calcularVencimiento(c.fecha_vencimiento) }))
    .filter(c => c.vencimiento.diasRestantes <= 15 && c.vencimiento.diasRestantes >= 0)
    .sort((a, b) => a.vencimiento.diasRestantes - b.vencimiento.diasRestantes)

  const handleEjecutar = (comp: CompromisoConBanco) => {
    confirm({
      title: 'Confirmar Ejecución',
      message: `¿Confirmas que realizaste el desembolso del compromiso ${comp.op_id}?`,
      confirmText: 'Sí, ejecutar',
      onConfirm: async () => {
        try {
          setEjecutando(comp.id)
          await ejecutarCompromiso(comp.id)
          toast.success(`Compromiso ${comp.op_id} marcado como EJECUTADO`)
          cargarCompromisos()
        } catch (err: any) {
          toast.error(err?.message || 'Error al ejecutar el compromiso')
        } finally {
          setEjecutando(null)
        }
      }
    })
  }

  const handleEliminarExterno = (id: string) => {
    confirm({
      title: 'Eliminar Compromiso Externo',
      message: 'Esta acción no se puede deshacer. ¿Seguro que deseas eliminar este compromiso?',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await eliminarCompromisoExterno(id)
          toast.success('Compromiso externo eliminado')
          cargarCompromisos()
        } catch (error) {
          toast.error('Error al eliminar el compromiso')
        }
      }
    })
  }

  // Métricas
  const totalCompromisos = compromisosFiltrados.length
  const activos = compromisosFiltrados.filter(c => ['vigente', 'ejecutado', 'confirmado'].includes(c.estado))
  const totalVigentes = activos.length
  const montoTotal = activos.reduce((sum, c) => sum + c.monto, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        <CardSkeleton count={3} />
        <Card>
          <TableSkeleton rows={5} cols={9} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con botón */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        {user?.role === 'cliente_admin' && (
          <Button variant="primary" onClick={() => setShowNuevoExterno(true)}>
            + Agregar Compromiso
          </Button>
        )}
      </div>

      {/* Cards de resumen */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Compromisos</div>
          <div className="text-2xl font-black mt-1">{totalCompromisos}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Vigentes</div>
          <div className="text-2xl font-black mt-1 text-[var(--good)]">
            {totalVigentes}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Total</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(montoTotal, 'GTQ')}
          </div>
        </Card>
      </div>

      {/* Alerta de compromisos próximos a vencer */}
      {compromisosProximosVencer.length > 0 && (
        <Card className="bg-red-900/10 border-red-900/50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} strokeWidth={1.75} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2 text-red-400">
                Compromisos Próximos a Vencer
              </h3>
              <p className="text-sm text-[var(--muted)] mb-3">
                Tienes {compromisosProximosVencer.length} compromiso(s) que vence(n) en los próximos 15 días
              </p>
              <div className="space-y-2">
                {compromisosProximosVencer.slice(0, 3).map(comp => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between p-3 bg-black/20 rounded border border-red-900/30"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {comp.es_externo ? comp.contraparte_nombre : comp.banco_entidad}
                        {comp.es_externo && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-sky-900/20 text-sky-300 border border-sky-900/30">
                            Externo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatMoney(comp.monto, comp.moneda)} • {comp.op_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${comp.vencimiento.color}`}>
                        {getIconoVencimiento(comp.vencimiento.estado)} {comp.vencimiento.texto}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(comp.fecha_vencimiento)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {compromisosProximosVencer.length > 3 && (
                <p className="text-xs text-[var(--muted)] mt-2">
                  + {compromisosProximosVencer.length - 3} más en la tabla
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Filtro por tipo */}
      <div className="flex gap-2">
        {(['todos', 'fundlink', 'externos'] as FiltroTipo[]).map(tipo => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(tipo)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtroTipo === tipo
                ? 'bg-[var(--primary)] text-white'
                : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
            }`}
          >
            {tipo === 'todos' ? 'Todos' : tipo === 'fundlink' ? 'FundLink' : 'Externos'}
          </button>
        ))}
      </div>

      {compromisosFiltrados.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            {filtroTipo === 'externos'
              ? 'No tienes compromisos externos registrados.'
              : filtroTipo === 'fundlink'
              ? 'No tienes compromisos FundLink.'
              : 'No tienes compromisos vigentes.'}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">OP-ID</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Contraparte</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Creada el</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Ejecutada el</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Vencimiento</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Días Rest.</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {compromisosFiltrados.map(comp => {
                  const vencimientoInfo = calcularVencimiento(comp.fecha_vencimiento)

                  return (
                    <tr key={comp.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <span className="font-mono text-sm font-semibold">{comp.op_id}</span>
                      </td>
                      <td className="p-3">
                        {comp.es_externo ? (
                          <div>
                            <div className="font-semibold text-sm">{comp.contraparte_nombre}</div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/20 text-sky-300 border border-sky-900/30">
                              Externo
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-sm">{comp.banco_entidad}</div>
                            <div className="text-xs text-[var(--muted)]">{comp.banco_nombre}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-semibold">
                        {formatMoney(comp.monto, comp.moneda)}
                      </td>
                      <td className="p-3 font-semibold text-[var(--good)]">
                        {comp.tasa}%
                      </td>
                      <td className="p-3 text-sm">{formatDate(comp.fecha_inicio)}</td>
                      <td className="p-3 text-sm">
                        {(comp as any).fecha_ejecucion
                          ? <span className="text-green-300 font-semibold">{formatDate((comp as any).fecha_ejecucion)}</span>
                          : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td className="p-3 text-sm">{formatDate(comp.fecha_vencimiento)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${vencimientoInfo.color} ${getColorBgVencimiento(vencimientoInfo.estado)}`}>
                          {getIconoVencimiento(vencimientoInfo.estado)} {vencimientoInfo.texto}
                        </span>
                      </td>
                      <td className="p-3">
                        {(() => {
                          const cls: Record<string, string> = {
                            confirmado: 'bg-blue-900/30 text-blue-300',
                            ejecutado:  'bg-green-900/30 text-green-300',
                            vigente:    'bg-green-900/20 text-green-200',
                            vencido:    'bg-red-900/20 text-red-200',
                            renovado:   'bg-yellow-900/20 text-yellow-200',
                            cancelado:  'bg-gray-900/20 text-gray-400',
                          }
                          const labels: Record<string, string> = {
                            confirmado: 'Confirmado',
                            ejecutado:  'Ejecutado',
                            vigente:    'Vigente',
                            vencido:    'Vencido',
                            renovado:   'Renovado',
                            cancelado:  'Cancelado',
                          }
                          return (
                            <span className={`text-xs px-2 py-1 rounded font-semibold ${cls[comp.estado] || 'bg-white/10 text-white'}`}>
                              {labels[comp.estado] || comp.estado}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {comp.es_externo ? (
                            <>
                              {comp.documento_url && (
                                <a href={comp.documento_url} target="_blank" rel="noopener noreferrer" className="w-full">
                                  <Button variant="small" className="w-full">Ver Documentos</Button>
                                </a>
                              )}
                              {user?.role === 'cliente_admin' && (
                                <Button
                                  variant="small"
                                  onClick={() => handleEliminarExterno(comp.id)}
                                >
                                  Eliminar
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              {comp.estado === 'confirmado' && user?.role === 'cliente_admin' && (
                                <Button
                                  variant="primary"
                                  className="text-xs"
                                  onClick={() => handleEjecutar(comp)}
                                  disabled={ejecutando === comp.id}
                                >
                                  {ejecutando === comp.id ? 'Ejecutando...' : 'Ejecutar'}
                                </Button>
                              )}
                              <Button
                                variant="small"
                                onClick={() => generarPDFContrato({
                                  ...comp,
                                  banco_nombre: comp.banco_nombre,
                                  banco_entidad: comp.banco_entidad,
                                  cliente_nombre: comp.cliente_nombre,
                                  cliente_entidad: comp.cliente_entidad,
                                })}
                              >
                                PDF Contrato
                              </Button>
                              {comp.estado === 'ejecutado' && (
                                <Button
                                  variant="small"
                                  onClick={() => generarPDFEjecutado({
                                    ...comp,
                                    banco_nombre: comp.banco_nombre,
                                    banco_entidad: comp.banco_entidad,
                                    cliente_nombre: comp.cliente_nombre,
                                    cliente_entidad: comp.cliente_entidad,
                                  })}
                                >
                                  PDF Ejecutado
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal nuevo compromiso externo */}
      <NuevoCompromisoExternoModal
        isOpen={showNuevoExterno}
        onClose={() => setShowNuevoExterno(false)}
        onSuccess={() => {
          setShowNuevoExterno(false)
          cargarCompromisos()
        }}
      />

      {/* Modal de confirmación */}
      <ConfirmDialog />
    </div>
  )
}
