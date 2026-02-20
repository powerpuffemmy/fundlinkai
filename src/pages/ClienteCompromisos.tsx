import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/common/Skeleton'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { generarPDFCompromiso } from '@/lib/pdfGenerator'
import { calcularVencimiento, getColorBgVencimiento, getIconoVencimiento } from '@/lib/vencimientoUtils'
import type { Compromiso } from '@/types/database'

interface CompromisoConBanco extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
  cliente_nombre?: string
  cliente_entidad?: string
}

export const ClienteCompromisos: React.FC = () => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [compromisos, setCompromisos] = useState<CompromisoConBanco[]>([])

  // Usar RPC con SECURITY DEFINER para obtener compromisos con datos de banco y cliente
  // (el join directo a users falla por RLS para el rol cliente)
  useEffect(() => {
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
    cargarCompromisos()
  }, [user?.id])

  // ⭐ NUEVO: Filtrar compromisos próximos a vencer (< 15 días)
  const compromisosProximosVencer = compromisos
    .filter(c => c.estado === 'vigente')
    .map(c => ({ ...c, vencimiento: calcularVencimiento(c.fecha_vencimiento) }))
    .filter(c => c.vencimiento.diasRestantes <= 15 && c.vencimiento.diasRestantes >= 0)
    .sort((a, b) => a.vencimiento.diasRestantes - b.vencimiento.diasRestantes)

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        
        {/* Loading skeletons para cards */}
        <CardSkeleton count={3} />
        
        {/* Loading skeleton para tabla */}
        <Card>
          <TableSkeleton rows={5} cols={9} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mis Compromisos</h2>

      {/* Cards de resumen */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Compromisos</div>
          <div className="text-2xl font-black mt-1">{compromisos.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Vigentes</div>
          <div className="text-2xl font-black mt-1 text-[var(--good)]">
            {compromisos.filter(c => c.estado === 'vigente').length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Total</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(
              compromisos
                .filter(c => c.estado === 'vigente')
                .reduce((sum, c) => sum + c.monto, 0),
              'USD'
            )}
          </div>
        </Card>
      </div>

      {/* ⭐ NUEVO: Alerta de compromisos próximos a vencer */}
      {compromisosProximosVencer.length > 0 && (
        <Card className="bg-red-900/10 border-red-900/50">
          <div className="flex items-start gap-3">
            <div className="text-3xl">⚠️</div>
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
                      <div className="font-semibold text-sm">{comp.banco_entidad}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatMoney(comp.monto, comp.moneda)} • OP-{comp.op_id}
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

      {compromisos.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No tienes compromisos vigentes.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">OP-ID</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Banco</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Inicio</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Vencimiento</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Días Rest.</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {compromisos.map(comp => {
                  const vencimientoInfo = calcularVencimiento(comp.fecha_vencimiento)

                  return (
                    <tr key={comp.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <span className="font-mono text-sm font-semibold">{comp.op_id}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-sm">{comp.banco_entidad}</div>
                        <div className="text-xs text-[var(--muted)]">{comp.banco_nombre}</div>
                      </td>
                      <td className="p-3 font-semibold">
                        {formatMoney(comp.monto, comp.moneda)}
                      </td>
                      <td className="p-3 font-semibold text-[var(--good)]">
                        {comp.tasa}%
                      </td>
                      <td className="p-3 text-sm">{formatDate(comp.fecha_inicio)}</td>
                      <td className="p-3 text-sm">{formatDate(comp.fecha_vencimiento)}</td>
                      <td className="p-3">
                        {/* ⭐ NUEVO: Badge con color según urgencia */}
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${vencimientoInfo.color} ${getColorBgVencimiento(vencimientoInfo.estado)}`}>
                          {getIconoVencimiento(vencimientoInfo.estado)} {vencimientoInfo.texto}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          comp.estado === 'vigente' ? 'bg-green-900/20 text-green-200' :
                          comp.estado === 'vencido' ? 'bg-red-900/20 text-red-200' :
                          'bg-gray-900/20 text-gray-200'
                        }`}>
                          {comp.estado}
                        </span>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="small"
                          onClick={() => generarPDFCompromiso(comp)}
                        >
                          Ver PDF
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
