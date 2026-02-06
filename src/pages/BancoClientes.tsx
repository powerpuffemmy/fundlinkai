import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { CardSkeleton } from '@/components/common/Skeleton'
import { AIProBadge } from '@/components/common/AIProBadge'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatMoney } from '@/lib/utils'
import type { DocumentoKYC } from '@/types/database'

interface ClienteInfo {
  id: string
  nombre: string
  entidad: string
  email: string
  telefono?: string
  limite_id: string
  limite_monto: number
  monto_utilizado: number
  monto_disponible: number
  activo: boolean
}

export const BancoClientes: React.FC = () => {
  const { user } = useAuthStore()
  const [clientes, setClientes] = useState<ClienteInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteInfo | null>(null)
  const [documentosKYC, setDocumentosKYC] = useState<DocumentoKYC[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  useEffect(() => {
    cargarClientes()
  }, [user?.id])

  const cargarClientes = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Obtener clientes que tienen límites configurados con este banco
      const { data: limites, error } = await supabase
        .from('cliente_banco_limites')
        .select(`
          id,
          limite_monto,
          monto_utilizado,
          activo,
          cliente:cliente_id (
            id,
            nombre,
            entidad,
            email,
            telefono
          )
        `)
        .eq('banco_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const clientesInfo: ClienteInfo[] = (limites || []).map(l => {
        const cliente = Array.isArray(l.cliente) ? l.cliente[0] : l.cliente
        return {
          id: cliente.id,
          nombre: cliente.nombre,
          entidad: cliente.entidad,
          email: cliente.email,
          telefono: cliente.telefono,
          limite_id: l.id,
          limite_monto: l.limite_monto,
          monto_utilizado: l.monto_utilizado,
          monto_disponible: l.limite_monto - l.monto_utilizado,
          activo: l.activo
        }
      })

      setClientes(clientesInfo)
    } catch (error) {
      console.error('Error cargando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarDocumentosKYC = async (cliente: ClienteInfo) => {
    try {
      setLoadingDocs(true)
      setClienteSeleccionado(cliente)

      const { data, error } = await supabase
        .from('documentos_kyc')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocumentosKYC(data || [])
    } catch (error) {
      console.error('Error cargando documentos:', error)
    } finally {
      setLoadingDocs(false)
    }
  }

  const cerrarModal = () => {
    setClienteSeleccionado(null)
    setDocumentosKYC([])
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      aprobado: { class: 'bg-green-900/20 border-green-900/50 text-green-200', label: 'Aprobado' },
      pendiente: { class: 'bg-yellow-900/20 border-yellow-900/50 text-yellow-200', label: 'Pendiente' },
      rechazado: { class: 'bg-red-900/20 border-red-900/50 text-red-200', label: 'Rechazado' }
    }
    return badges[estado] || badges.pendiente
  }

  const getTipoDocumentoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      cedula: 'Cédula de Identidad',
      rtu: 'RTU',
      patente: 'Patente de Comercio',
      estados_financieros: 'Estados Financieros',
      otro: 'Otro Documento'
    }
    return labels[tipo] || tipo
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Mis Clientes</h2>
          <AIProBadge isAIPro={user?.ai_pro} />
        </div>
        <CardSkeleton count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mis Clientes</h2>
        <AIProBadge isAIPro={user?.ai_pro} />
      </div>

      {/* Resumen */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Clientes</div>
          <div className="text-2xl font-black mt-1">{clientes.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Clientes Activos</div>
          <div className="text-2xl font-black mt-1">
            {clientes.filter(c => c.activo).length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Límite Total</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(
              clientes.reduce((sum, c) => sum + c.limite_monto, 0),
              'USD'
            )}
          </div>
        </Card>
      </div>

      {clientes.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No tienes clientes asignados aún.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {clientes.map(cliente => {
            const porcentajeUsado = (cliente.monto_utilizado / cliente.limite_monto) * 100

            return (
              <div
                key={cliente.id}
                onClick={() => cargarDocumentosKYC(cliente)}
              >
                <Card
                  className={`cursor-pointer transition-all hover:border-blue-500/50 ${
                    !cliente.activo ? 'opacity-60' : ''
                  }`}
                >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{cliente.entidad}</h3>
                    <p className="text-sm text-[var(--muted)]">{cliente.nombre}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    cliente.activo
                      ? 'bg-green-900/20 border-green-900/50 text-green-200'
                      : 'bg-gray-900/20 border-gray-700 text-gray-400'
                  }`}>
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Información de contacto */}
                  <div className="p-3 bg-white/5 rounded">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--muted)]">📧</span>
                        <span>{cliente.email}</span>
                      </div>
                      {cliente.telefono && (
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--muted)]">📱</span>
                          <span>{cliente.telefono}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Límites */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted)]">Límite asignado:</span>
                      <span className="font-semibold">
                        {formatMoney(cliente.limite_monto, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted)]">Utilizado:</span>
                      <span className="font-semibold text-[var(--warn)]">
                        {formatMoney(cliente.monto_utilizado, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted)]">Disponible:</span>
                      <span className="font-semibold text-[var(--good)]">
                        {formatMoney(cliente.monto_disponible, 'USD')}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                        <span>Uso del límite</span>
                        <span>{porcentajeUsado.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            porcentajeUsado > 80 ? 'bg-red-500' :
                            porcentajeUsado > 50 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <Button variant="small" className="w-full mt-2">
                    Ver Documentos KYC →
                  </Button>
                </div>
              </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de documentos KYC */}
      {clienteSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold">{clienteSeleccionado.entidad}</h3>
                <p className="text-sm text-[var(--muted)]">{clienteSeleccionado.nombre}</p>
              </div>
              <button
                onClick={cerrarModal}
                className="text-[var(--muted)] hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Información de contacto */}
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded">
              <h4 className="font-semibold mb-3">Información de Contacto</h4>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--muted)]">Email:</span>
                  <div className="font-semibold">{clienteSeleccionado.email}</div>
                </div>
                {clienteSeleccionado.telefono && (
                  <div>
                    <span className="text-[var(--muted)]">Teléfono:</span>
                    <div className="font-semibold">{clienteSeleccionado.telefono}</div>
                  </div>
                )}
                <div>
                  <span className="text-[var(--muted)]">Límite:</span>
                  <div className="font-semibold">
                    {formatMoney(clienteSeleccionado.limite_monto, 'USD')}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--muted)]">Disponible:</span>
                  <div className="font-semibold text-[var(--good)]">
                    {formatMoney(clienteSeleccionado.monto_disponible, 'USD')}
                  </div>
                </div>
              </div>
            </div>

            {/* Documentos KYC */}
            <h4 className="font-semibold mb-4">Documentos KYC</h4>

            {loadingDocs ? (
              <div className="text-center py-8 text-[var(--muted)]">
                Cargando documentos...
              </div>
            ) : documentosKYC.length === 0 ? (
              <div className="text-center py-8 text-[var(--muted)]">
                No hay documentos KYC disponibles.
              </div>
            ) : (
              <div className="space-y-3">
                {documentosKYC.map(doc => {
                  const badge = getEstadoBadge(doc.estado)
                  
                  return (
                    <div
                      key={doc.id}
                      className="p-4 bg-white/5 border border-[var(--line)] rounded hover:bg-white/10 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-semibold">
                            {getTipoDocumentoLabel(doc.tipo_documento)}
                          </div>
                          <div className="text-xs text-[var(--muted)] mt-1">
                            {doc.nombre_archivo}
                          </div>
                          {doc.descripcion && (
                            <div className="text-sm text-[var(--muted)] mt-1">
                              {doc.descripcion}
                            </div>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>

                      {doc.notas_revision && (
                        <div className="text-sm mt-2 p-2 bg-black/20 rounded">
                          <span className="text-[var(--muted)]">Notas: </span>
                          {doc.notas_revision}
                        </div>
                      )}

                      <div className="mt-3">
                        <a
                          href={doc.url_archivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          📄 Ver Documento
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[var(--line)]">
              <Button onClick={cerrarModal} className="w-full">
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
