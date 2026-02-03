import React, { useState, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { useClienteBancoLimites } from '@/hooks/useClienteBancoLimites'
import { useDocumentosKYC } from '@/hooks/useDocumentosKYC'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import type { TipoDocumentoKYC } from '@/types/database'

export const ClienteOnboarding: React.FC = () => {
  const { user } = useAuthStore()
  const { obtenerTodosBancos, crearLimite } = useClienteBancoLimites()
  const { documentos, subirDocumento, eliminarDocumento } = useDocumentosKYC()

  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)

  // Paso 1: Información de contacto
  const [telefono, setTelefono] = useState('')

  // Paso 2: Configurar bancos
  const [bancosDisponibles, setBancosDisponibles] = useState<any[]>([])
  const [bancosSeleccionados, setBancosSeleccionados] = useState<Record<string, number>>({})

  // Paso 3: Documentos KYC
  const [subiendoDoc, setSubiendoDoc] = useState(false)

  const tiposDocumento: { value: TipoDocumentoKYC; label: string }[] = [
    { value: 'cedula', label: 'Cédula o DPI' },
    { value: 'rtu', label: 'RTU (Registro Tributario Unificado)' },
    { value: 'patente', label: 'Patente de Comercio' },
    { value: 'estados_financieros', label: 'Estados Financieros' },
    { value: 'otro', label: 'Otro documento' }
  ]

  useEffect(() => {
    cargarBancos()
  }, [])

  const cargarBancos = async () => {
    const bancos = await obtenerTodosBancos()
    setBancosDisponibles(bancos)
    
    // Pre-seleccionar todos con límite de 10M
    const seleccion: Record<string, number> = {}
    bancos.forEach(b => {
      seleccion[b.id] = 10000000 // 10M por defecto
    })
    setBancosSeleccionados(seleccion)
  }

  const handleToggleBanco = (bancoId: string) => {
    setBancosSeleccionados(prev => {
      const nuevo = { ...prev }
      if (nuevo[bancoId]) {
        delete nuevo[bancoId]
      } else {
        nuevo[bancoId] = 10000000 // 10M por defecto
      }
      return nuevo
    })
  }

  const handleChangeLimite = (bancoId: string, valor: string) => {
    const monto = parseFloat(valor) || 0
    setBancosSeleccionados(prev => ({
      ...prev,
      [bancoId]: monto
    }))
  }

  const handleGuardarPaso1 = async () => {
    if (!telefono) {
      alert('Por favor ingresa un teléfono de contacto')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('users')
        .update({ telefono })
        .eq('id', user!.id)

      if (error) throw error

      setPaso(2)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar información')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarPaso2 = async () => {
    const seleccionados = Object.keys(bancosSeleccionados)
    
    if (seleccionados.length === 0) {
      alert('Debes seleccionar al menos un banco')
      return
    }

    try {
      setLoading(true)

      // Crear límites para cada banco seleccionado
      for (const bancoId of seleccionados) {
        await crearLimite({
          cliente_id: user!.id,
          banco_id: bancoId,
          limite_monto: bancosSeleccionados[bancoId],
          activo: true
        })
      }

      setPaso(3)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al configurar bancos')
    } finally {
      setLoading(false)
    }
  }

  const handleSubirDocumento = async (e: React.ChangeEvent<HTMLInputElement>, tipo: TipoDocumentoKYC) => {
    if (!e.target.files || e.target.files.length === 0) return

    const archivo = e.target.files[0]

    // Validar tamaño (máx 10MB)
    if (archivo.size > 10 * 1024 * 1024) {
      alert('El archivo no debe superar los 10MB')
      return
    }

    // Validar tipo
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png']
    if (!tiposPermitidos.includes(archivo.type)) {
      alert('Solo se permiten archivos PDF, JPG o PNG')
      return
    }

    try {
      setSubiendoDoc(true)
      const result = await subirDocumento(tipo, archivo)
      
      if (result.success) {
        alert('Documento subido exitosamente')
      } else {
        alert(`Error: ${result.error}`)
      }
    } finally {
      setSubiendoDoc(false)
    }
  }

  const handleEliminarDocumento = async (docId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este documento?')) return

    const result = await eliminarDocumento(docId)
    if (result.success) {
      alert('Documento eliminado')
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  const handleFinalizarOnboarding = async () => {
    // Verificar que tenga al menos un documento
    if (documentos.length === 0) {
      alert('Debes subir al menos un documento para completar el onboarding')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('users')
        .update({
          onboarding_completado: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user!.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user!.id,
        p_accion: 'Completar Onboarding',
        p_detalle: 'Cliente completó configuración inicial',
        p_metadata: { 
          bancos_configurados: Object.keys(bancosSeleccionados).length,
          documentos_subidos: documentos.length
        }
      })

      alert('¡Configuración completada!\n\nTu cuenta está siendo revisada por nuestro equipo. Te notificaremos cuando esté aprobada.')
      
      // Recargar página para actualizar el estado
      window.location.reload()

    } catch (error) {
      console.error('Error:', error)
      alert('Error al finalizar onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Bienvenido a FUNDLinkAI</h1>
        <p className="text-[var(--muted)]">
          Completa tu configuración para empezar a usar la plataforma
        </p>
      </div>

      {/* Progress */}
      <div className="flex justify-center items-center gap-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
          paso >= 1 ? 'bg-[var(--primary)] text-white' : 'bg-gray-700 text-gray-400'
        }`}>
          1
        </div>
        <div className={`h-1 w-16 ${paso >= 2 ? 'bg-[var(--primary)]' : 'bg-gray-700'}`} />
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
          paso >= 2 ? 'bg-[var(--primary)] text-white' : 'bg-gray-700 text-gray-400'
        }`}>
          2
        </div>
        <div className={`h-1 w-16 ${paso >= 3 ? 'bg-[var(--primary)]' : 'bg-gray-700'}`} />
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
          paso >= 3 ? 'bg-[var(--primary)] text-white' : 'bg-gray-700 text-gray-400'
        }`}>
          3
        </div>
      </div>

      {/* PASO 1: Información de contacto */}
      {paso === 1 && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Paso 1: Información de Contacto</h2>
          <p className="text-[var(--muted)] mb-6">
            Proporciona tu información de contacto para que podamos comunicarnos contigo
          </p>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="p-3 bg-white/5 rounded border border-white/10">
                {user?.email}
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">Este email no se puede cambiar</p>
            </div>

            <Input
              label="Teléfono de contacto"
              type="tel"
              placeholder="+502 1234-5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
            />
          </div>

          <div className="mt-6">
            <Button
              variant="primary"
              onClick={handleGuardarPaso1}
              disabled={loading || !telefono}
            >
              {loading ? 'Guardando...' : 'Continuar'}
            </Button>
          </div>
        </Card>
      )}

      {/* PASO 2: Configurar bancos */}
      {paso === 2 && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Paso 2: Configurar Bancos</h2>
          <p className="text-[var(--muted)] mb-6">
            Selecciona con qué bancos deseas trabajar y establece los límites de colocación
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {bancosDisponibles.map(banco => {
              const seleccionado = bancosSeleccionados[banco.id] !== undefined

              return (
                <div
                  key={banco.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    seleccionado
                      ? 'border-[var(--primary)] bg-blue-900/10'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                  onClick={() => handleToggleBanco(banco.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{banco.entidad}</div>
                      <div className="text-xs text-[var(--muted)]">{banco.nombre}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      onChange={() => {}} // Manejado por onClick del div
                      className="w-5 h-5"
                    />
                  </div>

                  {seleccionado && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Input
                        label="Límite de colocación"
                        type="number"
                        value={bancosSeleccionados[banco.id]}
                        onChange={(e) => handleChangeLimite(banco.id, e.target.value)}
                        min="1000000"
                        step="1000000"
                      />
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Monto máximo que puedes colocar con este banco
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setPaso(1)}>
              Atrás
            </Button>
            <Button
              variant="primary"
              onClick={handleGuardarPaso2}
              disabled={loading || Object.keys(bancosSeleccionados).length === 0}
            >
              {loading ? 'Guardando...' : 'Continuar'}
            </Button>
          </div>
        </Card>
      )}

      {/* PASO 3: Documentos KYC */}
      {paso === 3 && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Paso 3: Documentos KYC</h2>
          <p className="text-[var(--muted)] mb-6">
            Sube los documentos necesarios para verificar tu identidad y empresa
          </p>

          <div className="space-y-4 mb-6">
            {tiposDocumento.map(tipo => {
              const docSubido = documentos.find(d => d.tipo_documento === tipo.value)

              return (
                <div key={tipo.value} className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="font-semibold">{tipo.label}</div>
                      {docSubido && (
                        <div className="text-xs text-green-400 mt-1">
                          ✓ {docSubido.nombre_archivo}
                        </div>
                      )}
                    </div>
                    
                    {!docSubido ? (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleSubirDocumento(e, tipo.value)}
                          className="hidden"
                          disabled={subiendoDoc}
                        />
                        <Button variant="small" disabled={subiendoDoc}>
                          {subiendoDoc ? 'Subiendo...' : 'Subir'}
                        </Button>
                      </label>
                    ) : (
                      <Button
                        variant="small"
                        onClick={() => handleEliminarDocumento(docSubido.id)}
                        disabled={docSubido.estado !== 'pendiente'}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                  
                  {docSubido && (
                    <div className={`text-xs px-2 py-1 rounded inline-block ${
                      docSubido.estado === 'aprobado' ? 'bg-green-900/20 text-green-200' :
                      docSubido.estado === 'rechazado' ? 'bg-red-900/20 text-red-200' :
                      'bg-yellow-900/20 text-yellow-200'
                    }`}>
                      {docSubido.estado === 'pendiente' ? 'Pendiente de revisión' :
                       docSubido.estado === 'aprobado' ? 'Aprobado' :
                       'Rechazado'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="p-4 bg-blue-900/20 border border-blue-900/50 rounded mb-6">
            <p className="text-sm text-blue-200">
              <strong>Formatos aceptados:</strong> PDF, JPG, PNG (máx. 10MB por archivo)
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setPaso(2)}>
              Atrás
            </Button>
            <Button
              variant="primary"
              onClick={handleFinalizarOnboarding}
              disabled={loading || documentos.length === 0}
            >
              {loading ? 'Finalizando...' : 'Finalizar Configuración'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
