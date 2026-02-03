import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'

export const WebAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    usuariosActivos: 0,
    totalClientes: 0,
    totalBancos: 0,
    totalSubastas: 0,
    subastasAbiertas: 0,
    totalOfertas: 0,
    ofertasAprobadas: 0,
    totalCompromisos: 0,
    compromisosVigentes: 0,
    volumenTotal: 0,
    volumenVigente: 0,
    tasaPromedio: 0
  })
  const [loading, setLoading] = useState(true)
  const [actividadReciente, setActividadReciente] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)

      // Usuarios
      const { data: usuarios } = await supabase
        .from('users')
        .select('id, role, activo')

      const totalUsuarios = usuarios?.length || 0
      const usuariosActivos = usuarios?.filter(u => u.activo).length || 0
      const totalClientes = usuarios?.filter(u => u.role === 'cliente').length || 0
      const totalBancos = usuarios?.filter(u => u.role.startsWith('banco')).length || 0

      // Subastas
      const { data: subastas } = await supabase
        .from('subastas')
        .select('id, estado, monto')

      const totalSubastas = subastas?.length || 0
      const subastasAbiertas = subastas?.filter(s => s.estado === 'abierta').length || 0

      // Ofertas
      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id, estado')

      const totalOfertas = ofertas?.length || 0
      const ofertasAprobadas = ofertas?.filter(o => o.estado === 'aprobada').length || 0

      // Compromisos
      const { data: compromisos } = await supabase
        .from('compromisos')
        .select('id, estado, monto, tasa')

      const totalCompromisos = compromisos?.length || 0
      const compromisosVigentes = compromisos?.filter(c => c.estado === 'vigente').length || 0
      const volumenTotal = compromisos?.reduce((sum, c) => sum + (c.monto || 0), 0) || 0
      const volumenVigente = compromisos?.filter(c => c.estado === 'vigente').reduce((sum, c) => sum + (c.monto || 0), 0) || 0
      
      const tasaPromedio = compromisosVigentes > 0
        ? compromisos!.filter(c => c.estado === 'vigente').reduce((sum, c) => sum + (c.tasa || 0), 0) / compromisosVigentes
        : 0

      // Actividad reciente
      const { data: auditoria } = await supabase
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({
        totalUsuarios,
        usuariosActivos,
        totalClientes,
        totalBancos,
        totalSubastas,
        subastasAbiertas,
        totalOfertas,
        ofertasAprobadas,
        totalCompromisos,
        compromisosVigentes,
        volumenTotal,
        volumenVigente,
        tasaPromedio
      })

      setActividadReciente(auditoria || [])

    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Panel de Administración</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando métricas del sistema...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Panel de Administración</h2>
        <p className="text-[var(--muted)] mt-1">
          Vista ejecutiva del sistema FUNDLinkAI
        </p>
      </div>

      {/* Métricas principales */}
      <div>
        <h3 className="font-semibold mb-3 text-sm text-[var(--muted)]">USUARIOS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-sm text-[var(--muted)]">Total Usuarios</div>
            <div className="text-2xl font-black mt-1">{stats.totalUsuarios}</div>
            <div className="text-xs text-green-400 mt-1">
              {stats.usuariosActivos} activos
            </div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Clientes</div>
            <div className="text-2xl font-black mt-1 text-blue-400">{stats.totalClientes}</div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Bancos</div>
            <div className="text-2xl font-black mt-1 text-purple-400">{stats.totalBancos}</div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Inactivos</div>
            <div className="text-2xl font-black mt-1 text-gray-400">
              {stats.totalUsuarios - stats.usuariosActivos}
            </div>
          </Card>
        </div>
      </div>

      {/* Métricas de operación */}
      <div>
        <h3 className="font-semibold mb-3 text-sm text-[var(--muted)]">OPERACIONES</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-sm text-[var(--muted)]">Subastas</div>
            <div className="text-2xl font-black mt-1">{stats.totalSubastas}</div>
            <div className="text-xs text-green-400 mt-1">
              {stats.subastasAbiertas} abiertas
            </div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Ofertas</div>
            <div className="text-2xl font-black mt-1">{stats.totalOfertas}</div>
            <div className="text-xs text-green-400 mt-1">
              {stats.ofertasAprobadas} aprobadas
            </div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Compromisos</div>
            <div className="text-2xl font-black mt-1">{stats.totalCompromisos}</div>
            <div className="text-xs text-green-400 mt-1">
              {stats.compromisosVigentes} vigentes
            </div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Tasa Promedio</div>
            <div className="text-2xl font-black mt-1 text-green-400">
              {stats.tasaPromedio.toFixed(2)}%
            </div>
          </Card>
        </div>
      </div>

      {/* Métricas financieras */}
      <div>
        <h3 className="font-semibold mb-3 text-sm text-[var(--muted)]">FINANCIERO</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <div className="text-sm text-[var(--muted)]">Volumen Total Colocado</div>
            <div className="text-3xl font-black mt-2">
              {formatMoney(stats.volumenTotal, 'USD')}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              Todos los compromisos
            </div>
          </Card>
          <Card>
            <div className="text-sm text-[var(--muted)]">Volumen Vigente</div>
            <div className="text-3xl font-black mt-2 text-green-400">
              {formatMoney(stats.volumenVigente, 'USD')}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              Compromisos activos
            </div>
          </Card>
        </div>
      </div>

      {/* Estado del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Actividad reciente */}
        <Card>
          <h3 className="font-bold mb-4">Actividad Reciente</h3>
          {actividadReciente.length === 0 ? (
            <p className="text-[var(--muted)] text-sm">No hay actividad registrada</p>
          ) : (
            <div className="space-y-2">
              {actividadReciente.slice(0, 5).map(log => (
                <div 
                  key={log.id} 
                  className="p-3 bg-white/5 rounded-lg border border-white/10 text-sm"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold">{log.accion}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(log.created_at).toLocaleTimeString('es-GT', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">{log.user_email}</div>
                  {log.detalle && (
                    <div className="text-xs text-[var(--muted)] mt-1">{log.detalle}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Resumen de salud */}
        <Card>
          <h3 className="font-bold mb-4">Salud del Sistema</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-900/20 rounded-lg">
              <span className="text-sm">Usuarios Activos</span>
              <span className="font-bold text-green-400">
                {((stats.usuariosActivos / stats.totalUsuarios) * 100 || 0).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-900/20 rounded-lg">
              <span className="text-sm">Tasa de Conversión</span>
              <span className="font-bold text-blue-400">
                {stats.totalSubastas > 0 
                  ? ((stats.totalCompromisos / stats.totalSubastas) * 100).toFixed(0) 
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-900/20 rounded-lg">
              <span className="text-sm">Ofertas por Subasta</span>
              <span className="font-bold text-purple-400">
                {stats.totalSubastas > 0 
                  ? (stats.totalOfertas / stats.totalSubastas).toFixed(1)
                  : 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-900/20 rounded-lg">
              <span className="text-sm">Compromisos Vigentes</span>
              <span className="font-bold text-yellow-400">
                {stats.totalCompromisos > 0 
                  ? ((stats.compromisosVigentes / stats.totalCompromisos) * 100).toFixed(0)
                  : 0}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Acceso rápido */}
      <Card>
        <h3 className="font-bold mb-4">Acceso Rápido</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <button className="p-4 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors border border-white/10">
            <div className="font-semibold mb-1">Usuarios</div>
            <div className="text-sm text-[var(--muted)]">Gestionar cuentas y roles</div>
          </button>
          <button className="p-4 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors border border-white/10">
            <div className="font-semibold mb-1">Sistema</div>
            <div className="text-sm text-[var(--muted)]">Ver estado global</div>
          </button>
          <button className="p-4 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors border border-white/10">
            <div className="font-semibold mb-1">Auditoría</div>
            <div className="text-sm text-[var(--muted)]">Log de operaciones</div>
          </button>
        </div>
      </Card>
    </div>
  )
}
