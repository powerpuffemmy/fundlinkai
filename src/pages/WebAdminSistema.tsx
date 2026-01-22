import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateTime } from '@/lib/utils'

export const WebAdminSistema: React.FC = () => {
  const [stats, setStats] = useState({
    totalSubastas: 0,
    subastaAbiertas: 0,
    totalOfertas: 0,
    totalCompromisos: 0,
    montoTotal: 0,
    tasaPromedio: 0
  })
  const [loading, setLoading] = useState(true)
  const [subastas, setSubastas] = useState<any[]>([])
  const [ofertas, setOfertas] = useState<any[]>([])
  const [compromisos, setCompromisos] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)

      // Cargar subastas
      const { data: subastaData } = await supabase
        .from('subastas')
        .select('*, cliente:users!subastas_cliente_id_fkey(nombre, entidad)')
        .order('created_at', { ascending: false })
        .limit(10)

      // Cargar ofertas
      const { data: ofertaData } = await supabase
        .from('ofertas')
        .select('*, banco:users!ofertas_banco_id_fkey(nombre, entidad)')
        .order('created_at', { ascending: false })
        .limit(10)

      // Cargar compromisos
      const { data: compromisoData } = await supabase
        .from('compromisos')
        .select(`
          *,
          cliente:users!compromisos_cliente_id_fkey(nombre, entidad),
          banco:users!compromisos_banco_id_fkey(nombre, entidad)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      // Calcular estadísticas
      const totalSubastas = subastaData?.length || 0
      const subastaAbiertas = subastaData?.filter(s => s.estado === 'abierta').length || 0
      const totalOfertas = ofertaData?.length || 0
      const totalCompromisos = compromisoData?.length || 0
      const montoTotal = compromisoData?.reduce((sum, c) => sum + (c.monto || 0), 0) || 0
      const tasaPromedio = compromisoData && compromisoData.length > 0
        ? compromisoData.reduce((sum, c) => sum + (c.tasa || 0), 0) / compromisoData.length
        : 0

      setStats({
        totalSubastas,
        subastaAbiertas,
        totalOfertas,
        totalCompromisos,
        montoTotal,
        tasaPromedio
      })

      setSubastas(subastaData || [])
      setOfertas(ofertaData || [])
      setCompromisos(compromisoData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Vista Global del Sistema</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Vista Global del Sistema</h2>

      {/* Estadísticas */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <div className="text-xs text-[var(--muted)]">Total Subastas</div>
          <div className="text-xl font-black mt-1">{stats.totalSubastas}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--muted)]">Abiertas</div>
          <div className="text-xl font-black mt-1 text-[var(--good)]">
            {stats.subastaAbiertas}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--muted)]">Total Ofertas</div>
          <div className="text-xl font-black mt-1">{stats.totalOfertas}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--muted)]">Compromisos</div>
          <div className="text-xl font-black mt-1">{stats.totalCompromisos}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--muted)]">Monto Total</div>
          <div className="text-xl font-black mt-1">{formatMoney(stats.montoTotal, 'USD')}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--muted)]">Tasa Promedio</div>
          <div className="text-xl font-black mt-1">{stats.tasaPromedio.toFixed(2)}%</div>
        </Card>
      </div>

      {/* Subastas Recientes */}
      <Card>
        <h3 className="font-bold mb-4">Subastas Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left p-2 text-xs text-[var(--muted)]">Cliente</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Tipo</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Monto</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Plazo</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Estado</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Creada</th>
              </tr>
            </thead>
            <tbody>
              {subastas.map(s => (
                <tr key={s.id} className="border-b border-[var(--line)] text-sm">
                  <td className="p-2">{s.cliente?.entidad || '—'}</td>
                  <td className="p-2">{s.tipo}</td>
                  <td className="p-2 font-semibold">{formatMoney(s.monto, s.moneda)}</td>
                  <td className="p-2">{s.plazo}d</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      s.estado === 'abierta' ? 'bg-green-900/20 text-green-200' :
                      s.estado === 'cerrada' ? 'bg-gray-900/20 text-gray-200' :
                      'bg-blue-900/20 text-blue-200'
                    }`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="p-2 text-xs">{formatDateTime(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ofertas Recientes */}
      <Card>
        <h3 className="font-bold mb-4">Ofertas Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left p-2 text-xs text-[var(--muted)]">Banco</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Tasa</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Estado</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Admin Aprobó</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Creada</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map(o => (
                <tr key={o.id} className="border-b border-[var(--line)] text-sm">
                  <td className="p-2">{o.banco?.entidad || '—'}</td>
                  <td className="p-2 font-bold text-[var(--good)]">{o.tasa}%</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      o.estado === 'enviada' ? 'bg-blue-900/20 text-blue-200' :
                      o.estado === 'aprobada' ? 'bg-green-900/20 text-green-200' :
                      o.estado === 'rechazada' ? 'bg-red-900/20 text-red-200' :
                      'bg-purple-900/20 text-purple-200'
                    }`}>
                      {o.estado}
                    </span>
                  </td>
                  <td className="p-2">
                    {o.aprobada_por_admin ? '✓' : '—'}
                  </td>
                  <td className="p-2 text-xs">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Compromisos Recientes */}
      <Card>
        <h3 className="font-bold mb-4">Compromisos Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left p-2 text-xs text-[var(--muted)]">OP-ID</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Cliente</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Banco</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Monto</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Tasa</th>
                <th className="text-left p-2 text-xs text-[var(--muted)]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {compromisos.map(c => (
                <tr key={c.id} className="border-b border-[var(--line)] text-sm">
                  <td className="p-2 font-mono font-semibold">{c.op_id}</td>
                  <td className="p-2">{c.cliente?.entidad || '—'}</td>
                  <td className="p-2">{c.banco?.entidad || '—'}</td>
                  <td className="p-2 font-semibold">{formatMoney(c.monto, c.moneda)}</td>
                  <td className="p-2 font-bold text-[var(--good)]">{c.tasa}%</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      c.estado === 'vigente' ? 'bg-green-900/20 text-green-200' :
                      'bg-gray-900/20 text-gray-200'
                    }`}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}