import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { Button } from '@/components/common/Button'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import type { Auditoria } from '@/types/database'

export const WebAdminAuditoria: React.FC = () => {
  const [auditoria, setAuditoria] = useState<Auditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [limite, setLimite] = useState('50')

  const acciones = [
    { value: '', label: 'Todas las acciones' },
    { value: 'Crear Subasta', label: 'Crear Subasta' },
    { value: 'Crear Oferta', label: 'Crear Oferta' },
    { value: 'Aprobar Oferta', label: 'Aprobar Oferta' },
    { value: 'Crear Compromiso', label: 'Crear Compromiso' },
    { value: 'Crear Usuario', label: 'Crear Usuario' },
    { value: 'Actualizar Usuario', label: 'Actualizar Usuario' },
    { value: 'Desactivar Usuario', label: 'Desactivar Usuario' }
  ]

  const roles = [
    { value: '', label: 'Todos los roles' },
    { value: 'cliente', label: 'Cliente' },
    { value: 'banco_admin', label: 'Banco Admin' },
    { value: 'banco_mesa', label: 'Banco Mesa' },
    { value: 'banco_auditor', label: 'Banco Auditor' },
    { value: 'webadmin', label: 'WebAdmin' }
  ]

  const limites = [
    { value: '25', label: '25 registros' },
    { value: '50', label: '50 registros' },
    { value: '100', label: '100 registros' },
    { value: '200', label: '200 registros' }
  ]

  const cargarAuditoria = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limite))

      if (filtroAccion) {
        query = query.ilike('accion', `%${filtroAccion}%`)
      }

      if (filtroUsuario) {
        query = query.ilike('user_email', `%${filtroUsuario}%`)
      }

      if (filtroRol) {
        query = query.eq('user_role', filtroRol)
      }

      const { data, error } = await query

      if (error) throw error
      setAuditoria(data || [])
    } catch (error) {
      console.error('Error cargando auditoría:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarAuditoria()
  }, [limite])

  const handleBuscar = () => {
    cargarAuditoria()
  }

  const handleLimpiar = () => {
    setFiltroAccion('')
    setFiltroUsuario('')
    setFiltroRol('')
    setLimite('50')
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Auditoría del Sistema</h2>

      {/* Filtros */}
      <Card>
        <h3 className="font-semibold mb-4">Filtros de Búsqueda</h3>
        
        <div className="grid md:grid-cols-4 gap-4">
          <Select
            label="Acción"
            options={acciones}
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
          />

          <Input
            label="Usuario (email)"
            placeholder="usuario@empresa.com"
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
          />

          <Select
            label="Rol"
            options={roles}
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
          />

          <Select
            label="Límite de registros"
            options={limites}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
          />
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="primary" onClick={handleBuscar}>
            Buscar
          </Button>
          <Button onClick={handleLimpiar}>
            Limpiar Filtros
          </Button>
        </div>
      </Card>

      {/* Tabla de auditoría */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">
            Registros de Auditoría ({auditoria.length})
          </h3>
        </div>

        {loading ? (
          <p className="text-[var(--muted)]">Cargando...</p>
        ) : auditoria.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-8">
            No se encontraron registros con los filtros aplicados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Fecha/Hora</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Usuario</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Rol</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Acción</th>
                  <th className="text-left p-2 text-xs text-[var(--muted)]">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map(log => (
                  <tr key={log.id} className="border-b border-[var(--line)] text-sm hover:bg-white/5">
                    <td className="p-2 text-xs">{formatDateTime(log.created_at)}</td>
                    <td className="p-2">{log.user_email || '—'}</td>
                    <td className="p-2">
                      <span className="text-xs px-2 py-1 rounded bg-blue-900/20 text-blue-200">
                        {log.user_role || '—'}
                      </span>
                    </td>
                    <td className="p-2 font-semibold">{log.accion}</td>
                    <td className="p-2 text-xs text-[var(--muted)]">
                      {log.detalle || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Estadísticas */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Registros</div>
          <div className="text-2xl font-black mt-1">{auditoria.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Usuarios Únicos</div>
          <div className="text-2xl font-black mt-1">
            {new Set(auditoria.map(a => a.user_email)).size}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Acciones Únicas</div>
          <div className="text-2xl font-black mt-1">
            {new Set(auditoria.map(a => a.accion)).size}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Última Actividad</div>
          <div className="text-sm font-semibold mt-1">
            {auditoria.length > 0 ? formatDateTime(auditoria[0].created_at) : '—'}
          </div>
        </Card>
      </div>
    </div>
  )
}