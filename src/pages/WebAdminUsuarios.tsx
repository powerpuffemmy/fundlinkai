import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { toastSuccess, toastError } from '@/lib/toastUtils'
import { useConfirm } from '@/components/common/ConfirmModal'
import type { User, UserRole } from '@/types/database'

export const WebAdminUsuarios: React.FC = () => {
  const { user: currentUser } = useAuthStore()
  const { confirm, ConfirmDialog } = useConfirm()
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState<User | null>(null)
  
  // Form state
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [entidad, setEntidad] = useState('')
  const [role, setRole] = useState<UserRole>('cliente')
  const [activo, setActivo] = useState(true)

  const roles = [
    { value: 'cliente', label: 'Cliente' },
    { value: 'banco_admin', label: 'Banco - Admin' },
    { value: 'banco_mesa', label: 'Banco - Mesa' },
    { value: 'banco_auditor', label: 'Banco - Auditor' },
    { value: 'webadmin', label: 'WebAdmin' }
  ]

  const cargarUsuarios = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const limpiarFormulario = () => {
    setEmail('')
    setNombre('')
    setEntidad('')
    setRole('cliente')
    setActivo(true)
    setEditando(null)
    setMostrarFormulario(false)
  }

  const handleNuevo = () => {
    limpiarFormulario()
    setMostrarFormulario(true)
  }

  const handleEditar = (usuario: User) => {
    setEditando(usuario)
    setEmail(usuario.email)
    setNombre(usuario.nombre)
    setEntidad(usuario.entidad)
    setRole(usuario.role)
    setActivo(usuario.activo)
    setMostrarFormulario(true)
  }

  const handleGuardar = async () => {
    if (!email || !nombre || !entidad) {
      toastError('Por favor completa todos los campos')
      return
    }

    try {
      if (editando) {
        // Actualizar
        const { error } = await supabase
          .from('users')
          .update({
            email,
            nombre,
            entidad,
            role,
            activo,
            updated_at: new Date().toISOString()
          })
          .eq('id', editando.id)

        if (error) throw error

        await supabase.rpc('log_auditoria', {
          p_user_id: currentUser?.id,
          p_accion: 'Actualizar Usuario',
          p_detalle: `Usuario ${email} actualizado`,
          p_metadata: { user_id: editando.id }
        })

        toastSuccess('Usuario actualizado exitosamente')
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('users')
          .insert([{
            email,
            nombre,
            entidad,
            role,
            activo
          }])

        if (error) throw error

        await supabase.rpc('log_auditoria', {
          p_user_id: currentUser?.id,
          p_accion: 'Crear Usuario',
          p_detalle: `Usuario ${email} creado`,
          p_metadata: { email }
        })

        toastSuccess('Usuario creado exitosamente')
      }

      limpiarFormulario()
      await cargarUsuarios()
    } catch (error: any) {
      console.error('Error guardando usuario:', error)
      toastError(`Error: ${error.message}`)
    }
  }

  const handleDesactivar = async (usuario: User) => {
    const confirmar = window.confirm(
      `¿Seguro que deseas ${usuario.activo ? 'desactivar' : 'activar'} a ${usuario.nombre}?`
    )
    if (!confirmar) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ activo: !usuario.activo })
        .eq('id', usuario.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: currentUser?.id,
        p_accion: usuario.activo ? 'Desactivar Usuario' : 'Activar Usuario',
        p_detalle: `Usuario ${usuario.email}`,
        p_metadata: { user_id: usuario.id }
      })

      await cargarUsuarios()
    } catch (error) {
      console.error('Error:', error)
      toastError('Error al actualizar usuario')
    }
  }

  const handleEliminar = async (usuario: User) => {
    const confirmar = window.confirm(
      `⚠️ ADVERTENCIA: ¿Seguro que deseas ELIMINAR permanentemente a ${usuario.nombre}?\n\nEsta acción NO se puede deshacer.`
    )
    if (!confirmar) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', usuario.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: currentUser?.id,
        p_accion: 'Eliminar Usuario',
        p_detalle: `Usuario ${usuario.email} eliminado`,
        p_metadata: { user_id: usuario.id }
      })

      toastSuccess('Usuario eliminado')
      await cargarUsuarios()
    } catch (error: any) {
      console.error('Error:', error)
      toastError(`Error: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
        <Button variant="primary" onClick={handleNuevo}>
          + Nuevo Usuario
        </Button>
      </div>

      {/* Formulario */}
      {mostrarFormulario && (
        <Card className="border-2 border-[var(--primary)]">
          <h3 className="font-bold mb-4">
            {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
            />
            
            <Input
              label="Nombre Completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan Pérez"
            />
            
            <Input
              label="Entidad / Empresa"
              value={entidad}
              onChange={(e) => setEntidad(e.target.value)}
              placeholder="Empresa S.A."
            />
            
            <Select
              label="Rol"
              options={roles}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            />

            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="activo"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              <label htmlFor="activo" className="text-sm">
                Usuario activo
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="primary" onClick={handleGuardar}>
              {editando ? 'Actualizar' : 'Crear'}
            </Button>
            <Button onClick={limpiarFormulario}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Tabla de usuarios */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left p-3 text-sm text-[var(--muted)]">Email</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Nombre</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Entidad</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Rol</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(usuario => (
                <tr key={usuario.id} className="border-b border-[var(--line)] hover:bg-white/5">
                  <td className="p-3 text-sm">{usuario.email}</td>
                  <td className="p-3 text-sm font-semibold">{usuario.nombre}</td>
                  <td className="p-3 text-sm">{usuario.entidad}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-1 rounded bg-blue-900/20 text-blue-200">
                      {roles.find(r => r.value === usuario.role)?.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      usuario.activo 
                        ? 'bg-green-900/20 text-green-200' 
                        : 'bg-red-900/20 text-red-200'
                    }`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="small"
                        onClick={() => handleEditar(usuario)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="small"
                        onClick={() => handleDesactivar(usuario)}
                      >
                        {usuario.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="small"
                        onClick={() => handleEliminar(usuario)}
                        className="bg-red-900/20 border-red-900/50 text-red-200 hover:bg-red-900/30"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Usuarios</div>
          <div className="text-2xl font-black mt-1">{usuarios.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Activos</div>
          <div className="text-2xl font-black mt-1 text-[var(--good)]">
            {usuarios.filter(u => u.activo).length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Clientes</div>
          <div className="text-2xl font-black mt-1">
            {usuarios.filter(u => u.role === 'cliente').length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Bancos</div>
          <div className="text-2xl font-black mt-1">
            {usuarios.filter(u => u.role.startsWith('banco')).length}
          </div>
        </Card>
      </div>

      {/* Modal de confirmación */}
      <ConfirmDialog />
    </div>
  )
}