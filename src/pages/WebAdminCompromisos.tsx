import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { CardSkeleton, TableSkeleton } from '@/components/common/Skeleton'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate, formatDateTime } from '@/lib/utils'
import { generarPDFCompromiso } from '@/lib/pdfGenerator'
import type { Compromiso } from '@/types/database'

interface CompromisoConRelaciones extends Compromiso {
  cliente?: {
    nombre: string
    entidad: string
  }
  banco?: {
    nombre: string
    entidad: string
  }
}

export const WebAdminCompromisos: React.FC = () => {
  const [compromisos, setCompromisos] = useState<CompromisoConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'30' | '90' | '180' | 'todo'>('30')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroBanco, setFiltroBanco] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'vigente' | 'vencido' | 'renovado' | 'cancelado'>('todos')

  useEffect(() => {
    cargarCompromisos()
  }, [filtro])

  const cargarCompromisos = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('compromisos')
        .select(`
          *,
          cliente:cliente_id(nombre, entidad),
          banco:banco_id(nombre, entidad)
        `)
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
      setCompromisos(data || [])
    } catch (error) {
      console.error('Error cargando compromisos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros del cliente
  const compromisosFiltrados = compromisos.filter(c => {
    const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente
    const banco = Array.isArray(c.banco) ? c.banco[0] : c.banco

    if (filtroCliente && !cliente?.entidad.toLowerCase().includes(filtroCliente.toLowerCase())) {
      return false
    }
    if (filtroBanco && !banco?.entidad.toLowerCase().includes(filtroBanco.toLowerCase())) {
      return false
    }
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) {
      return false
    }
    return true
  })

  // Calcular totales por cliente
  const montoTotalPorCliente = compromisosFiltrados.reduce((acc, c) => {
    const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente
    const key = cliente?.entidad || 'Desconocido'
    if (!acc[key]) {
      acc[key] = { monto: 0, cantidad: 0 }
    }
    acc[key].monto += c.monto
    acc[key].cantidad += 1
    return acc
  }, {} as Record<string, { monto: number; cantidad: number }>)

  // Calcular totales por banco
  const montoTotalPorBanco = compromisosFiltrados.reduce((acc, c) => {
    const banco = Array.isArray(c.banco) ? c.banco[0] : c.banco
    const key = banco?.entidad || 'Desconocido'
    if (!acc[key]) {
      acc[key] = { monto: 0, cantidad: 0 }
    }
    acc[key].monto += c.monto
    acc[key].cantidad += 1
    return acc
  }, {} as Record<string, { monto: number; cantidad: number }>)

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      vigente: { class: 'bg-green-900/20 border-green-900/50 text-green-200', label: 'Vigente' },
      vencido: { class: 'bg-red-900/20 border-red-900/50 text-red-200', label: 'Vencido' },
      renovado: { class: 'bg-blue-900/20 border-blue-900/50 text-blue-200', label: 'Renovado' },
      cancelado: { class: 'bg-gray-900/20 border-gray-700 text-gray-400', label: 'Cancelado' }
    }
    return badges[estado] || badges.vigente
  }

  const limpiarFiltros = () => {
    setFiltroCliente('')
    setFiltroBanco('')
    setFiltroEstado('todos')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Compromisos</h2>
        <CardSkeleton count={3} />
        <Card>
          <TableSkeleton rows={5} cols={8} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Compromisos</h2>

      {/* Filtros de período */}
      <Card>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFiltro('30')}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                filtro === '30' ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              30 días
            </button>
            <button
              onClick={() => setFiltro('90')}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                filtro === '90' ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              90 días
            </button>
            <button
              onClick={() => setFiltro('180')}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                filtro === '180' ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              180 días
            </button>
            <button
              onClick={() => setFiltro('todo')}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                filtro === 'todo' ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              Todo el tiempo
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Buscar por cliente..."
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="max-w-xs"
            />

            <Input
              placeholder="Buscar por banco..."
              value={filtroBanco}
              onChange={(e) => setFiltroBanco(e.target.value)}
              className="max-w-xs"
            />

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
              className="px-4 py-2 bg-white/5 rounded border border-[var(--line)] text-sm"
            >
              <option value="todos">Todos los estados</option>
              <option value="vigente">Vigente</option>
              <option value="vencido">Vencido</option>
              <option value="renovado">Renovado</option>
              <option value="cancelado">Cancelado</option>
            </select>

            {(filtroCliente || filtroBanco || filtroEstado !== 'todos') && (
              <Button variant="small" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Resumen de métricas */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Compromisos</div>
          <div className="text-2xl font-black mt-1">{compromisosFiltrados.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Total</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(
              compromisosFiltrados.reduce((sum, c) => sum + c.monto, 0),
              'USD'
            )}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Tasa Promedio</div>
          <div className="text-2xl font-black mt-1">
            {compromisosFiltrados.length > 0
              ? (compromisosFiltrados.reduce((sum, c) => sum + c.tasa, 0) / compromisosFiltrados.length).toFixed(2)
              : '0.00'}%
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Plazo Promedio</div>
          <div className="text-2xl font-black mt-1">
            {compromisosFiltrados.length > 0
              ? Math.round(compromisosFiltrados.reduce((sum, c) => sum + c.plazo, 0) / compromisosFiltrados.length)
              : 0}{' '}
            días
          </div>
        </Card>
      </div>

      {/* Tabla de compromisos */}
      <Card>
        <h3 className="font-bold mb-4">Listado de Compromisos</h3>
        {compromisosFiltrados.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-8">
            No hay compromisos que coincidan con los filtros seleccionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">OP-ID</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Cliente</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Banco</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Plazo</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Vencimiento</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">PDF</th>
                </tr>
              </thead>
              <tbody>
                {compromisosFiltrados.map(c => {
                  const badge = getEstadoBadge(c.estado)
                  const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente
                  const banco = Array.isArray(c.banco) ? c.banco[0] : c.banco
                  
                  return (
                    <tr key={c.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3 font-mono text-sm">{c.op_id}</td>
                      <td className="p-3">
                        <div className="font-semibold">{cliente?.entidad}</div>
                        <div className="text-xs text-[var(--muted)]">{cliente?.nombre}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{banco?.entidad}</div>
                        <div className="text-xs text-[var(--muted)]">{banco?.nombre}</div>
                      </td>
                      <td className="p-3 font-semibold">{formatMoney(c.monto, c.moneda)}</td>
                      <td className="p-3 text-[var(--good)]">{c.tasa}%</td>
                      <td className="p-3">{c.plazo} días</td>
                      <td className="p-3 text-sm">{formatDate(c.fecha_vencimiento)}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="small"
                          onClick={() => generarPDFCompromiso(c)}
                        >
                          📄 Ver
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Totales por cliente */}
      <Card>
        <h3 className="font-bold mb-4">Total por Cliente</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(montoTotalPorCliente)
            .sort(([, a], [, b]) => b.monto - a.monto)
            .map(([cliente, data]) => (
              <div key={cliente} className="p-3 bg-white/5 rounded border border-[var(--line)] hover:bg-white/10">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold">{cliente}</div>
                    <div className="text-xs text-[var(--muted)]">{data.cantidad} compromiso(s)</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatMoney(data.monto, 'USD')}</div>
                    <div className="text-xs text-[var(--muted)]">
                      Prom: {formatMoney(data.monto / data.cantidad, 'USD')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Totales por banco */}
      <Card>
        <h3 className="font-bold mb-4">Total por Banco</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(montoTotalPorBanco)
            .sort(([, a], [, b]) => b.monto - a.monto)
            .map(([banco, data]) => (
              <div key={banco} className="p-3 bg-white/5 rounded border border-[var(--line)] hover:bg-white/10">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold">{banco}</div>
                    <div className="text-xs text-[var(--muted)]">{data.cantidad} compromiso(s)</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatMoney(data.monto, 'USD')}</div>
                    <div className="text-xs text-[var(--muted)]">
                      Prom: {formatMoney(data.monto / data.cantidad, 'USD')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
