import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useDocumentosKYC } from '@/hooks/useDocumentosKYC'
import { formatMoney, formatDateTime } from '@/lib/utils'
import type { User } from '@/types/database'

interface ClienteConLimites extends User {
  limites?: any[]
  total_limites?: number
}

export const WebAdminAprobaciones: React.FC = () => {
  const { user: currentUser } = useAuthStore()
  const [clientes, setClientes] = useState<ClienteConLimites[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteConLimites | null>(null)
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [notasAprobacion, setNotasAprobacion] = useState('')

  const { documentos, actualizarEstadoDocumento } = useDocumentosKYC(clienteSeleccionado?.id)

  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    try {
      setLoading(true)

      const { data: clientesData, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'cliente')
        .eq('onboarding_completado', true)
        .eq('aprobado_por_admin', false)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Cargar límites para cada cliente
      const clientesConLimites = await Promise.all(
        (clientesData || []).map(async (cliente) => {
          const { data: limites } = await supabase
            .from('cliente_banco_limites')
            .select(`*, banco:users!banco_id(nombre, entidad)`)
            .eq('cliente_id', cliente.id)

          const totalLimites = limites?.reduce((sum, l) => sum + l.limite_monto, 0) || 0

          return { ...cliente, limites, total_limites: totalLimites }
        })
      )

      setClientes(clientesConLimites)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAprobarDocumento = async (docId: string) => {
    const result = await actualizarEstadoDocumento(docId, 'aprobado')
    if (result.success) alert('Documento aprobado')
  }

  const handleRechazarDocumento = async (docId: string) => {
    const notas = prompt('Motivo del rechazo:')
    if (!notas) return
    const result = await actualizarEstadoDocumento(docId, 'rechazado', notas)
    if (result.success) alert('Documento rechazado')
  }

  const handleAprobarCliente = async () => {
    if (!clienteSeleccionado) return

    const docsAprobados = documentos.filter(d => d.estado === 'aprobado').length
    if (docsAprobados === 0) {
      alert('Debe tener al menos un documento aprobado')
      return
    }

    if (!confirm(`¿Aprobar a ${clienteSeleccionado.nombre}?`)) return

    try {
      setProcesando(true)

      const { error } = await supabase
        .from('users')
        .update({
          aprobado_por_admin: true,
          fecha_aprobacion: new Date().toISOString(),
          aprobado_por: currentUser!.id,
          activo: true,
          notas_aprobacion: notasAprobacion || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', clienteSeleccionado.id)

      if (error) throw error

      alert('Cliente aprobado')
      setClienteSeleccionado(null)
      await cargarClientes()
    } finally {
      setProcesando(false)
    }
  }

  const handleRechazarCliente = async () => {
    if (!clienteSeleccionado) return

    const motivo = prompt('Motivo del rechazo:')
    if (!motivo) return

    if (!confirm(`¿Rechazar a ${clienteSeleccionado.nombre}?`)) return

    try {
      setProcesando(true)

      const { error } = await supabase
        .from('users')
        .update({
          onboarding_completado: false,
          activo: false,
          notas_aprobacion: motivo,
          updated_at: new Date().toISOString()
        })
        .eq('id', clienteSeleccionado.id)

      if (error) throw error

      alert('Cliente rechazado')
      setClienteSeleccionado(null)
      await cargarClientes()
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Aprobaciones</h2>
        <Card><p className="text-[var(--muted)]">Cargando...</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Aprobaciones de Clientes</h2>

      {!clienteSeleccionado ? (
        clientes.length === 0 ? (
          <Card><p className="text-[var(--muted)] text-center py-8">No hay clientes pendientes</p></Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {clientes.map(cliente => (
              <Card key={cliente.id}>
                <div className="font-bold">{cliente.entidad}</div>
                <div className="text-sm text-[var(--muted)]">{cliente.nombre}</div>
                <div className="text-xs text-[var(--muted)]">{cliente.email}</div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Tel: {cliente.telefono || '—'}
                </div>
                <div className="text-sm mt-2">
                  Bancos: {cliente.limites?.length || 0} | 
                  Límites: {formatMoney(cliente.total_limites || 0, 'USD')}
                </div>
                <Button
                  variant="primary"
                  className="w-full mt-3"
                  onClick={() => setClienteSeleccionado(cliente)}
                >
                  Revisar
                </Button>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <Button onClick={() => setClienteSeleccionado(null)} className="mb-4">← Volver</Button>
          
          <h3 className="font-bold text-lg mb-4">{clienteSeleccionado.entidad}</h3>
          
          <div className="mb-4">
            <div className="text-sm"><strong>Nombre:</strong> {clienteSeleccionado.nombre}</div>
            <div className="text-sm"><strong>Email:</strong> {clienteSeleccionado.email}</div>
            <div className="text-sm"><strong>Tel:</strong> {clienteSeleccionado.telefono}</div>
          </div>

          <h4 className="font-semibold mb-2">Bancos ({clienteSeleccionado.limites?.length || 0})</h4>
          <div className="space-y-1 mb-4">
            {clienteSeleccionado.limites?.map(l => (
              <div key={l.id} className="text-sm">
                {l.banco?.entidad}: {formatMoney(l.limite_monto, 'USD')}
              </div>
            ))}
          </div>

          <h4 className="font-semibold mb-2">Documentos ({documentos.length})</h4>
          <div className="space-y-2 mb-4">
            {documentos.map(doc => (
              <div key={doc.id} className="p-2 bg-white/5 rounded text-sm">
                <div className="flex justify-between">
                  <span>{doc.tipo_documento} - {doc.nombre_archivo}</span>
                  <span className={`text-xs ${
                    doc.estado === 'aprobado' ? 'text-green-400' :
                    doc.estado === 'rechazado' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {doc.estado}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <a href={doc.url_archivo} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400">Ver</a>
                  {doc.estado === 'pendiente' && (
                    <>
                      <button onClick={() => handleAprobarDocumento(doc.id)} className="text-xs text-green-400">Aprobar</button>
                      <button onClick={() => handleRechazarDocumento(doc.id)} className="text-xs text-red-400">Rechazar</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Input
            label="Notas (opcional)"
            value={notasAprobacion}
            onChange={(e) => setNotasAprobacion(e.target.value)}
            className="mb-4"
          />

          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleAprobarCliente}
              disabled={procesando || documentos.filter(d => d.estado === 'aprobado').length === 0}
            >
              Aprobar Cliente
            </Button>
            <Button onClick={handleRechazarCliente} disabled={procesando}>
              Rechazar
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
