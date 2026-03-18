import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { LogoUploader } from '@/components/banco/LogoUploader'
import { useClienteBancoLimites } from '@/hooks/useClienteBancoLimites'
import { useDocumentosKYC } from '@/hooks/useDocumentosKYC'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import type { TipoDocumentoKYC } from '@/types/database'

const TIPOS_DOCUMENTO: { value: TipoDocumentoKYC; label: string }[] = [
  { value: 'cedula', label: 'Cédula o DPI' },
  { value: 'rtu', label: 'RTU' },
  { value: 'patente', label: 'Patente de Comercio' },
  { value: 'estados_financieros', label: 'Estados Financieros' },
  { value: 'otro', label: 'Otro documento' }
]

export const ClienteConfiguracion: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const {
    limites,
    loading,
    crearLimite,
    actualizarLimite,
    obtenerTodosBancos
  } = useClienteBancoLimites()
  const { documentos, loading: loadingDocs, subirDocumento, eliminarDocumento } = useDocumentosKYC()

  const [bancosDisponibles, setBancosDisponibles] = useState<any[]>([])
  const [editando, setEditando] = useState<Record<string, boolean>>({})
  const [valoresTemp, setValoresTemp] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [logoUrl, setLogoUrl] = useState<string | undefined>(user?.logo_url)

  // Datos personales editables
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [nombreTemp, setNombreTemp] = useState(user?.nombre || '')
  const [telefonoTemp, setTelefonoTemp] = useState(user?.telefono || '')
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  // KYC upload
  const [tipoDocSelected, setTipoDocSelected] = useState<TipoDocumentoKYC>('cedula')
  const [subiendoDoc, setSubiendoDoc] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLogoUrl(user?.logo_url)
  }, [user?.logo_url])

  useEffect(() => {
    cargarBancos()
  }, [])

  const cargarBancos = async () => {
    const bancos = await obtenerTodosBancos()
    setBancosDisponibles(bancos)
  }

  const handleLogoUpdated = async (newUrl: string | null) => {
    setLogoUrl(newUrl || undefined)

    // Actualizar el usuario en el store
    if (user) {
      setUser({ ...user, logo_url: newUrl || undefined })
    }

    // Refrescar datos del usuario desde la BD
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user!.id)
      .single()

    if (data) {
      setUser(data)
    }
  }

  const bancosConLimite = limites.map(l => l.banco_id)
  const bancosSinLimite = bancosDisponibles.filter(b => !bancosConLimite.includes(b.id))

  const handleIniciarEdicion = (limiteId: string, valorActual: number) => {
    setEditando(prev => ({ ...prev, [limiteId]: true }))
    setValoresTemp(prev => ({ ...prev, [limiteId]: valorActual.toString() }))
  }

  const handleCancelarEdicion = (limiteId: string) => {
    setEditando(prev => ({ ...prev, [limiteId]: false }))
    setValoresTemp(prev => {
      const { [limiteId]: _, ...rest } = prev
      return rest
    })
  }

  const handleGuardarLimite = async (limiteId: string) => {
    try {
      setGuardando(prev => ({ ...prev, [limiteId]: true }))
      
      const nuevoLimite = parseFloat(valoresTemp[limiteId] || '0')
      
      if (nuevoLimite < 0) {
        alert('El límite no puede ser negativo')
        return
      }

      await actualizarLimite(limiteId, { limite_monto: nuevoLimite })
      
      setEditando(prev => ({ ...prev, [limiteId]: false }))
      alert('Límite actualizado exitosamente')
    } catch (error) {
      console.error('Error guardando límite:', error)
      alert('Error al actualizar el límite')
    } finally {
      setGuardando(prev => ({ ...prev, [limiteId]: false }))
    }
  }

  const handleToggleActivo = async (limiteId: string, activoActual: boolean) => {
    try {
      await actualizarLimite(limiteId, { activo: !activoActual })
    } catch (error) {
      console.error('Error toggling activo:', error)
      alert('Error al cambiar el estado')
    }
  }

  const handleAgregarBanco = async (bancoId: string) => {
    try {
      if (!user) return

      const limiteInicial = 10000000 // 10M por defecto

      await crearLimite({
        cliente_id: user.id,
        banco_id: bancoId,
        limite_monto: limiteInicial,
        activo: true
      })

      alert('Banco agregado exitosamente con límite de $10M')
    } catch (error) {
      console.error('Error agregando banco:', error)
      alert('Error al agregar el banco')
    }
  }

  const handleGuardarPerfil = async () => {
    if (!user) return
    try {
      setGuardandoPerfil(true)
      const { error } = await supabase
        .from('users')
        .update({ nombre: nombreTemp.trim(), telefono: telefonoTemp.trim() })
        .eq('id', user.id)
      if (error) throw error
      setUser({ ...user, nombre: nombreTemp.trim(), telefono: telefonoTemp.trim() })
      setEditandoPerfil(false)
      alert('Datos actualizados exitosamente')
    } catch (error) {
      console.error('Error actualizando perfil:', error)
      alert('Error al actualizar los datos')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const handleSubirDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    try {
      setSubiendoDoc(true)
      const result = await subirDocumento(tipoDocSelected, archivo)
      if (!result.success) throw new Error(result.error)
      alert('Documento subido exitosamente. Quedará pendiente de revisión.')
    } catch (error: any) {
      alert('Error al subir el documento: ' + (error.message || ''))
    } finally {
      setSubiendoDoc(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleEliminarDocumento = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return
    const result = await eliminarDocumento(id)
    if (!result.success) alert('Error al eliminar: ' + result.error)
  }

  const getDocEstadoBadge = (estado: string) => {
    if (estado === 'aprobado') return 'bg-green-900/20 text-green-300 border-green-900/40'
    if (estado === 'rechazado') return 'bg-red-900/20 text-red-300 border-red-900/40'
    return 'bg-yellow-900/20 text-yellow-300 border-yellow-900/40'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Configuración</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuración de Tesorería</h2>
        <p className="text-[var(--muted)] mt-1">
          Gestiona los límites de colocación con cada banco
        </p>
      </div>

      {/* Información del Cliente + Logo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-lg">Información de la Empresa</h3>
            {!editandoPerfil && (
              <Button
                variant="small"
                className="text-xs"
                onClick={() => {
                  setNombreTemp(user?.nombre || '')
                  setTelefonoTemp(user?.telefono || '')
                  setEditandoPerfil(true)
                }}
              >
                Editar
              </Button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Entidad</label>
              <div className="font-semibold">{user?.entidad}</div>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Email</label>
              <div className="font-semibold">{user?.email}</div>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Nombre de Contacto</label>
              {editandoPerfil ? (
                <Input
                  value={nombreTemp}
                  onChange={e => setNombreTemp(e.target.value)}
                  placeholder="Nombre completo"
                />
              ) : (
                <div className="font-semibold">{user?.nombre || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Teléfono</label>
              {editandoPerfil ? (
                <Input
                  value={telefonoTemp}
                  onChange={e => setTelefonoTemp(e.target.value)}
                  placeholder="+502 XXXX-XXXX"
                />
              ) : (
                <div className="font-semibold">{user?.telefono || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Rol</label>
              <div className="font-semibold capitalize">
                {user?.role === 'cliente_admin' ? 'Administrador' : 'Usuario'}
              </div>
            </div>
            {editandoPerfil && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  className="text-sm"
                  onClick={handleGuardarPerfil}
                  disabled={guardandoPerfil}
                >
                  {guardandoPerfil ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button
                  variant="small"
                  className="text-sm"
                  onClick={() => setEditandoPerfil(false)}
                  disabled={guardandoPerfil}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Logo de la Empresa - Solo admin */}
        {user?.role === 'cliente_admin' && (
          <Card>
            <h3 className="font-bold text-lg mb-4">Identidad Visual</h3>

            <LogoUploader
              currentLogoUrl={logoUrl}
              onLogoUpdated={handleLogoUpdated}
            />

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-400">
                <strong>Tip:</strong> Tu logo aparecerá en el dashboard y en los compromisos de tu entidad.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Límites por Banco */}
      <Card>
        <h3 className="font-bold text-lg mb-4">Límites por Banco</h3>
        
        {limites.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--muted)] mb-4">
              No tienes bancos configurados aún
            </p>
            <p className="text-sm text-blue-400">
              Agrega bancos para empezar a trabajar con ellos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Banco</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Límite</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Utilizado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Disponible</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {limites.map(limite => {
                  const disponible = limite.limite_monto - limite.monto_utilizado
                  const porcentajeUsado = (limite.monto_utilizado / limite.limite_monto) * 100

                  return (
                    <tr key={limite.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-semibold text-sm">{limite.banco_nombre}</div>
                      </td>
                      <td className="p-3">
                        {editando[limite.id] ? (
                          <Input
                            type="number"
                            value={valoresTemp[limite.id]}
                            onChange={(e) => setValoresTemp(prev => ({ 
                              ...prev, 
                              [limite.id]: e.target.value 
                            }))}
                            className="w-32"
                            min="0"
                            step="1000000"
                          />
                        ) : (
                          <span className="font-semibold">
                            {formatMoney(limite.limite_monto, 'GTQ')}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={porcentajeUsado > 80 ? 'text-[var(--warn)]' : ''}>
                          {formatMoney(limite.monto_utilizado, 'GTQ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`font-semibold ${
                          disponible < 1000000 ? 'text-[var(--bad)]' : 'text-[var(--good)]'
                        }`}>
                          {formatMoney(disponible, 'GTQ')}
                        </span>
                      </td>
                      <td className="p-3">
                        {user?.role === 'cliente_admin' ? (
                          <button
                            onClick={() => handleToggleActivo(limite.id, limite.activo)}
                            className={`text-xs px-2 py-1 rounded ${
                              limite.activo
                                ? 'bg-green-900/20 text-green-200'
                                : 'bg-gray-900/20 text-gray-200'
                            }`}
                          >
                            {limite.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded ${
                            limite.activo
                              ? 'bg-green-900/20 text-green-200'
                              : 'bg-gray-900/20 text-gray-200'
                          }`}>
                            {limite.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {user?.role === 'cliente_admin' && (
                          <div className="flex gap-2 justify-end">
                            {editando[limite.id] ? (
                              <>
                                <Button
                                  variant="primary"
                                  className="text-xs"
                                  onClick={() => handleGuardarLimite(limite.id)}
                                  disabled={guardando[limite.id]}
                                >
                                  {guardando[limite.id] ? 'Guardando...' : 'Guardar'}
                                </Button>
                                <Button
                                  variant="small"
                                  className="text-xs"
                                  onClick={() => handleCancelarEdicion(limite.id)}
                                  disabled={guardando[limite.id]}
                                >
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="small"
                                className="text-xs"
                                onClick={() => handleIniciarEdicion(limite.id, limite.limite_monto)}
                              >
                                Editar
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Agregar Nuevos Bancos - Solo admin */}
      {user?.role === 'cliente_admin' && bancosSinLimite.length > 0 && (
        <Card>
          <h3 className="font-bold text-lg mb-4">Agregar Bancos</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bancosSinLimite.map(banco => (
              <div
                key={banco.id}
                className="p-3 bg-white/5 rounded-lg border border-blue-900/30"
              >
                <div className="font-semibold text-sm mb-3">{banco.nombre}</div>
                <Button
                  variant="primary"
                  className="w-full text-xs"
                  onClick={() => handleAgregarBanco(banco.id)}
                >
                  Agregar con límite de $10M
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECCIÓN KYC ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg">Documentos KYC</h3>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              Know Your Client — Documentos de identidad y cumplimiento
            </p>
          </div>
          {user?.role === 'cliente_admin' && (
            <div className="flex items-center gap-2">
              <select
                value={tipoDocSelected}
                onChange={e => setTipoDocSelected(e.target.value as TipoDocumentoKYC)}
                className="text-sm bg-white/5 border border-white/10 rounded px-2 py-1 text-white"
              >
                {TIPOS_DOCUMENTO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <Button
                variant="primary"
                className="text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendoDoc}
              >
                {subiendoDoc ? 'Subiendo...' : '+ Subir'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleSubirDocumento}
              />
            </div>
          )}
        </div>

        {loadingDocs ? (
          <p className="text-[var(--muted)] text-sm">Cargando documentos...</p>
        ) : documentos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--muted)] text-sm">No hay documentos KYC subidos aún.</p>
            {user?.role === 'cliente_admin' && (
              <p className="text-xs text-blue-400 mt-2">
                Sube los documentos requeridos para completar tu perfil KYC.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">
                    {doc.tipo_documento === 'cedula' ? '🪪' :
                     doc.tipo_documento === 'rtu' ? '📋' :
                     doc.tipo_documento === 'patente' ? '📜' :
                     doc.tipo_documento === 'estados_financieros' ? '📊' : '📄'}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {TIPOS_DOCUMENTO.find(t => t.value === doc.tipo_documento)?.label || doc.tipo_documento}
                    </div>
                    <div className="text-xs text-[var(--muted)] truncate">{doc.nombre_archivo}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded border ${getDocEstadoBadge(doc.estado)}`}>
                    {doc.estado === 'aprobado' ? 'Aprobado' :
                     doc.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </span>
                  <a
                    href={doc.url_archivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Ver
                  </a>
                  {doc.estado === 'pendiente' && user?.role === 'cliente_admin' && (
                    <button
                      onClick={() => handleEliminarDocumento(doc.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Información */}
      <Card className="bg-blue-900/10 border-blue-900/30">
        <div>
          <div className="font-semibold text-blue-200 mb-2">Sobre los límites</div>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• El límite es el monto máximo que puedes colocar con cada banco</li>
            <li>• El monto utilizado se calcula automáticamente según compromisos vigentes</li>
            <li>• Solo podrás crear subastas con bancos que tengan límite disponible suficiente</li>
            <li>• Puedes desactivar temporalmente un banco sin perder su configuración</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
