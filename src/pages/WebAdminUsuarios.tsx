import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { CredencialesModal } from '@/components/common/CredencialesModal'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { User, UserRole } from '@/types/database'

// ⭐ ENTIDADES PREDEFINIDAS
const ENTIDADES_CLIENTES = [
  'CorpTech',
  'Industrias del Norte',
  'Grupo Financiero del Pacífico',
  'Comercial Maya',
  'Exportadora Central'
]

const ENTIDADES_BANCOS = [
  'Banco de Guatemala',
  'Banco Industrial',
  'Banco G&T Continental',
  'Banco Agromercantil',
  'Banco de Desarrollo Rural',
  'Banco Promerica',
  'Banco Azteca'
]

export const WebAdminUsuarios: React.FC = () => {
  const { user: currentUser } = useAuthStore()
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState<User | null>(null)
  
  // Form state
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [entidad, setEntidad] = useState('')
  const [entidadPersonalizada, setEntidadPersonalizada] = useState(false)
  const [role, setRole] = useState<UserRole>('cliente')
  const [activo, setActivo] = useState(true)

  // Modal credenciales
  const [mostrarCredenciales, setMostrarCredenciales] = useState(false)
  const [credencialesNuevas, setCredencialesNuevas] = useState<{email: string; password: string; role: string} | null>(null)

  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [ordenamiento, setOrdenamiento] = useState<'entidad' | 'nombre' | 'fecha'>('entidad')

  const roles = [
    { value: 'cliente', label: 'Cliente' },
    { value: 'banco_admin', label: 'Banco - Admin' },
    { value: 'banco_mesa', label: 'Banco - Mesa' },
    { value: 'banco_auditor', label: 'Banco - Auditor' },
    { value: 'webadmin', label: 'WebAdmin' }
  ]

  const filtrosRol = [
    { value: '', label: 'Todos los roles' },
    ...roles
  ]

  const filtrosEstado = [
    { value: '', label: 'Todos' },
    { value: 'true', label: 'Solo activos' },
    { value: 'false', label: 'Solo inactivos' }
  ]

  const ordenamientos = [
    { value: 'entidad', label: 'Por Entidad' },
    { value: 'nombre', label: 'Por Nombre' },
    { value: 'fecha', label: 'Por Fecha' }
  ]

  // Obtener lista de entidades según el rol
  const getEntidadesDisponibles = (): string[] => {
    if (role === 'cliente') {
      return ENTIDADES_CLIENTES
    } else if (role.startsWith('banco')) {
      return ENTIDADES_BANCOS
    }
    return []
  }

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

  // Aplicar filtros y ordenamiento
  useEffect(() => {
    let resultado = [...usuarios]

    // Búsqueda
    if (busqueda) {
      resultado = resultado.filter(u =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.entidad.toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Filtro por rol
    if (filtroRol) {
      resultado = resultado.filter(u => u.role === filtroRol)
    }

    // Filtro por estado
    if (filtroEstado) {
      const estado = filtroEstado === 'true'
      resultado = resultado.filter(u => u.activo === estado)
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      if (ordenamiento === 'entidad') {
        return a.entidad.localeCompare(b.entidad)
      } else if (ordenamiento === 'nombre') {
        return a.nombre.localeCompare(b.nombre)
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    setUsuariosFiltrados(resultado)
  }, [usuarios, busqueda, filtroRol, filtroEstado, ordenamiento])

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const limpiarFormulario = () => {
    setEmail('')
    setNombre('')
    setEntidad('')
    setEntidadPersonalizada(false)
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
    
    // Verificar si la entidad es personalizada
    const esCliente = usuario.role === 'cliente'
    const esBanco = usuario.role.startsWith('banco')
    const listaEntidades = esCliente ? ENTIDADES_CLIENTES : esBanco ? ENTIDADES_BANCOS : []
    setEntidadPersonalizada(!listaEntidades.includes(usuario.entidad))
    
    setMostrarFormulario(true)
  }

  const handleGuardar = async () => {
    if (!email || !nombre || !entidad) {
      alert('Por favor completa todos los campos')
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

        alert('Usuario actualizado exitosamente')
      } else {
        // Crear nuevo
        const nuevoUsuario: any = {
          email,
          nombre,
          entidad,
          role,
          activo,
          primer_login: true  // Debe cambiar password en primer login
        }

        // Si es cliente, forzar onboarding
        if (role === 'cliente') {
          nuevoUsuario.activo = false
          nuevoUsuario.onboarding_completado = false
          nuevoUsuario.aprobado_por_admin = false
        }

        // 1. Crear en tabla users
        const { error } = await supabase
          .from('users')
          .insert([nuevoUsuario])

        if (error) throw error

        // 2. Generar contraseña temporal
        const passwordTemporal = `Temp${Math.random().toString(36).slice(-8)}!`

        // 3. Crear cuenta en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: passwordTemporal,
          email_confirm: true,
          user_metadata: {
            nombre: nombre,
            entidad: entidad,
            role: role
          }
        })

        if (authError) {
          console.error('Error creando cuenta Auth:', authError)
          // No lanzar error, solo avisar
          alert(`⚠️ Usuario creado en la base de datos, pero hubo un error al crear la cuenta de autenticación.\n\nDeberás crear la cuenta manualmente en Authentication → Users.\n\nError: ${authError.message}`)
        } else {
          // Mostrar credenciales en modal
          setCredencialesNuevas({
            email: email,
            password: passwordTemporal,
            role: role
          })
          setMostrarCredenciales(true)
        }

        await supabase.rpc('log_auditoria', {
          p_user_id: currentUser?.id,
          p_accion: 'Crear Usuario',
          p_detalle: `Usuario ${email} creado con cuenta Auth`,
          p_metadata: { email, auth_created: !authError }
        })
      }

      limpiarFormulario()
      await cargarUsuarios()
    } catch (error: any) {
      console.error('Error guardando usuario:', error)
      alert(`Error: ${error.message}`)
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
      alert('Error al actualizar usuario')
    }
  }

  const handleEliminar = async (usuario: User) => {
    const confirmar = window.confirm(
      `ADVERTENCIA: ¿Seguro que deseas ELIMINAR permanentemente a ${usuario.nombre}?\n\nEsta acción NO se puede deshacer.`
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

      alert('Usuario eliminado')
      await cargarUsuarios()
    } catch (error: any) {
      console.error('Error:', error)
      alert(`Error: ${error.message}`)
    }
  }

  const handleLimpiarFiltros = () => {
    setBusqueda('')
    setFiltroRol('')
    setFiltroEstado('')
    setOrdenamiento('entidad')
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

  const entidadesDisponibles = getEntidadesDisponibles()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
          <p className="text-[var(--muted)] mt-1">
            {usuariosFiltrados.length} de {usuarios.length} usuarios
          </p>
        </div>
        <Button variant="primary" onClick={handleNuevo}>
          + Nuevo Usuario
        </Button>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <h3 className="font-semibold mb-4">Filtros y Búsqueda</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <Input
            label="Buscar"
            placeholder="Nombre, email o entidad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Select
            label="Rol"
            options={filtrosRol}
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
          />
          <Select
            label="Estado"
            options={filtrosEstado}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          />
          <Select
            label="Ordenar por"
            options={ordenamientos}
            value={ordenamiento}
            onChange={(e) => setOrdenamiento(e.target.value as any)}
          />
        </div>
        {(busqueda || filtroRol || filtroEstado || ordenamiento !== 'entidad') && (
          <div className="mt-4">
            <Button onClick={handleLimpiarFiltros} variant="small">
              Limpiar Filtros
            </Button>
          </div>
        )}
      </Card>

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
            
            <Select
              label="Rol"
              options={roles}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as UserRole)
                setEntidad('') // Reset entidad cuando cambia rol
                setEntidadPersonalizada(false)
              }}
            />

            {/* Entidad predefinida o personalizada */}
            {entidadesDisponibles.length > 0 && !entidadPersonalizada ? (
              <div>
                <Select
                  label="Entidad / Empresa"
                  options={[
                    { value: '', label: 'Selecciona una entidad' },
                    ...entidadesDisponibles.map(e => ({ value: e, label: e }))
                  ]}
                  value={entidad}
                  onChange={(e) => setEntidad(e.target.value)}
                />
                <button
                  onClick={() => setEntidadPersonalizada(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
                >
                  ¿No está en la lista? Ingresa personalizada
                </button>
              </div>
            ) : (
              <div>
                <Input
                  label="Entidad / Empresa"
                  value={entidad}
                  onChange={(e) => setEntidad(e.target.value)}
                  placeholder="Empresa S.A."
                />
                {entidadesDisponibles.length > 0 && (
                  <button
                    onClick={() => {
                      setEntidadPersonalizada(false)
                      setEntidad('')
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
                  >
                    ← Seleccionar de la lista
                  </button>
                )}
              </div>
            )}

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
        {usuariosFiltrados.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-8">
            No se encontraron usuarios con los filtros aplicados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Entidad</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Nombre</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Email</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Rol</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(usuario => (
                  <tr key={usuario.id} className="border-b border-[var(--line)] hover:bg-white/5">
                    <td className="p-3 text-sm font-semibold">{usuario.entidad}</td>
                    <td className="p-3 text-sm">{usuario.nombre}</td>
                    <td className="p-3 text-sm text-[var(--muted)]">{usuario.email}</td>
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
        )}
      </Card>

      {/* Estadísticas */}
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

      {/* Modal de credenciales */}
      {mostrarCredenciales && credencialesNuevas && (
        <CredencialesModal
          email={credencialesNuevas.email}
          password={credencialesNuevas.password}
          role={credencialesNuevas.role}
          onClose={() => {
            setMostrarCredenciales(false)
            setCredencialesNuevas(null)
          }}
        />
      )}
    </div>
  )
}
