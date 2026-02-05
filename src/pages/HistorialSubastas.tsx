import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { TableSkeleton } from '@/components/common/Skeleton'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatMoney, formatDateTime } from '@/lib/utils'
import type { Subasta } from '@/types/database'

export const HistorialSubastas: React.FC = () => {
  const { user } = useAuthStore()
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'30' | '90' | 'todo'>('30')

  useEffect(() => {
    cargarHistorial()
  }, [user?.id, filtro])

  const cargarHistorial = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('subastas')
        .select('*')
        .eq('cliente_id', user.id)
        .in('estado', ['cerrada', 'cancelada', 'expirada'])
        .order('created_at', { ascending: false })

      // Aplicar filtro de fecha
      if (filtro !== 'todo') {
        const dias = parseInt(filtro)
        const fechaLimite = new Date()
        fechaLimite.setDate(fechaLimite.getDate() - dias)
        query = query.gte('created_at', fechaLimite.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      setSubastas(data || [])
    } catch (error) {
      console.error('Error cargando historial:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      cerrada: { class: 'bg-green-900/20 border-green-900/50 text-green-200', label: 'Cerrada' },
      cancelada: { class: 'bg-gray-900/20 border-gray-900/50 text-gray-200', label: 'Cancelada' },
      expirada: { class: 'bg-yellow-900/20 border-yellow-900/50 text-yellow-200', label: 'Expirada' }
    }
    return badges[estado] || badges.cerrada
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Historial de Subastas</h2>
        <Card>
          <TableSkeleton rows={5} cols={7} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Historial de Subastas</h2>
        
        <div className="flex gap-2">
          <button
            onClick={() => setFiltro('30')}
            className={`px-4 py-2 rounded text-sm ${
              filtro === '30'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
            }`}
          >
            30 días
          </button>
          <button
            onClick={() => setFiltro('90')}
            className={`px-4 py-2 rounded text-sm ${
              filtro === '90'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
            }`}
          >
            90 días
          </button>
          <button
            onClick={() => setFiltro('todo')}
            className={`px-4 py-2 rounded text-sm ${
              filtro === 'todo'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
            }`}
          >
            Todo
          </button>
        </div>
      </div>

      {subastas.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No hay subastas en el historial para el período seleccionado.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tipo</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Plazo</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa Objetivo</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Creada</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Expiró</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {subastas.map(subasta => {
                  const badge = getEstadoBadge(subasta.estado)
                  
                  return (
                    <tr key={subasta.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <span className="font-semibold capitalize">{subasta.tipo}</span>
                      </td>
                      <td className="p-3 font-semibold">
                        {formatMoney(subasta.monto, subasta.moneda)}
                      </td>
                      <td className="p-3">{subasta.plazo} días</td>
                      <td className="p-3">
                        {subasta.tasa_objetivo ? (
                          <span className="text-[var(--good)]">{subasta.tasa_objetivo}%</span>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">{formatDateTime(subasta.created_at)}</td>
                      <td className="p-3 text-sm">{formatDateTime(subasta.expires_at)}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded border ${badge.class}`}>
                          {badge.label}
                        </span>
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
