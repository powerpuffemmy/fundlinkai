import React, { useState, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useSubastas } from '@/hooks/useSubastas'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateTime, addDays } from '@/lib/utils'
import { toastSuccess, toastError } from '@/lib/toastUtils'
import { useConfirm } from '@/components/common/ConfirmModal'
import type { Oferta } from '@/types/database'

interface OfertaConBanco extends Oferta {
  banco_nombre?: string
  banco_entidad?: string
}

export const ClienteSubastas: React.FC = () => {
  const { user } = useAuthStore()
  const { subastas, loading: loadingSubastas, actualizarSubasta } = useSubastas()
  const { crearCompromiso } = useCompromisos()
  const { confirm, ConfirmDialog } = useConfirm()
  const [ofertasPorSubasta, setOfertasPorSubasta] = useState<Record<string, OfertaConBanco[]>>({})
  const [loadingOfertas, setLoadingOfertas] = useState(false)
  const [aprobando, setAprobando] = useState<Record<string, boolean>>({})

  const misSubastas = subastas.filter(s => s.cliente_id === user?.id)

  // Cargar ofertas para cada subasta
  useEffect(() => {
    const cargarOfertas = async () => {
      if (misSubastas.length === 0) return

      setLoadingOfertas(true)
      try {
        const resultado: Record<string, OfertaConBanco[]> = {}

        for (const subasta of misSubastas) {
          const { data: ofertas, error } = await supabase
            .from('ofertas')
            .select(`
              *,
              banco:users!ofertas_banco_id_fkey(nombre, entidad)
            `)
            .eq('subasta_id', subasta.id)
            .order('tasa', { ascending: false })

          if (!error && ofertas) {
            resultado[subasta.id] = ofertas.map(o => ({
              ...o,
              banco_nombre: o.banco?.nombre,
              banco_entidad: o.banco?.entidad
            }))
          }
        }

        setOfertasPorSubasta(resultado)
      } catch (error) {
        console.error('Error cargando ofertas:', error)
      } finally {
        setLoadingOfertas(false)
      }
    }

    cargarOfertas()
  }, [misSubastas.length])

  const handleAprobar = async (subasta_id: string, oferta: OfertaConBanco) => {
    if (!user) return

    confirm({
      title: 'Aprobar Oferta',
      message: `¿Confirmas aprobar la oferta de ${oferta.banco_entidad} al ${oferta.tasa}%? Esto generará un compromiso automáticamente.`,
      confirmText: 'Aprobar',
      confirmVariant: 'primary',
      onConfirm: async () => {
        try {
          setAprobando(prev => ({ ...prev, [oferta.id]: true }))

          const subasta = misSubastas.find(s => s.id === subasta_id)
          if (!subasta) throw new Error('Subasta no encontrada')

          // Actualizar estado de la oferta a 'aprobada'
          const { error: errorOferta } = await supabase
            .from('ofertas')
            .update({ estado: 'aprobada' })
            .eq('id', oferta.id)

          if (errorOferta) throw errorOferta

          // Rechazar otras ofertas de esta subasta
          const { error: errorOtras } = await supabase
            .from('ofertas')
            .update({ estado: 'rechazada' })
            .eq('subasta_id', subasta_id)
            .neq('id', oferta.id)

          if (errorOtras) throw errorOtras

          // Generar OP_ID único
          const opId = 'OP-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
          const fechaInicio = new Date().toISOString().split('T')[0]
          const fechaVencimiento = addDays(fechaInicio, subasta.plazo)

          // Crear compromiso
          await crearCompromiso({
            op_id: opId,
            cliente_id: user.id,
            banco_id: oferta.banco_id,
            subasta_id: subasta_id,
            oferta_id: oferta.id,
            monto: subasta.monto,
            moneda: subasta.moneda,
            tasa: oferta.tasa,
            plazo: subasta.plazo,
            fecha_inicio: fechaInicio,
            fecha_vencimiento: fechaVencimiento,
            estado: 'vigente'
          })

          // Cerrar subasta
          await actualizarSubasta(subasta_id, { estado: 'cerrada' })

          // Log auditoría
          await supabase.rpc('log_auditoria', {
            p_user_id: user.id,
            p_accion: 'Aprobar Oferta',
            p_detalle: `Compromiso ${opId} generado con ${oferta.banco_entidad} al ${oferta.tasa}%`,
            p_metadata: { 
              compromiso_id: opId,
              oferta_id: oferta.id,
              subasta_id: subasta_id
            }
          })

          toastSuccess(`¡Compromiso ${opId} creado exitosamente! Monto: ${formatMoney(subasta.monto, subasta.moneda)} | Tasa: ${oferta.tasa}% | Plazo: ${subasta.plazo} días`, 5000)

          // Recargar ofertas
          setTimeout(() => window.location.reload(), 2000)

        } catch (error) {
          console.error('Error al aprobar oferta:', error)
          toastError('Error al aprobar la oferta. Por favor intenta de nuevo.')
        } finally {
          setAprobando(prev => ({ ...prev, [oferta.id]: false }))
        }
      }
    })
  }

  const handleRechazar = async (oferta_id: string) => {
    confirm({
      title: 'Rechazar Oferta',
      message: '¿Confirmas rechazar esta oferta?',
      confirmText: 'Rechazar',
      confirmVariant: 'primary',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('ofertas')
            .update({ estado: 'rechazada' })
            .eq('id', oferta_id)

          if (error) throw error

          toastSuccess('Oferta rechazada exitosamente')

          // Recargar ofertas
          setTimeout(() => window.location.reload(), 1500)

        } catch (error) {
          console.error('Error al rechazar oferta:', error)
          toastError('Error al rechazar la oferta.')
        }
      }
    })
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      abierta: { class: 'bg-green-900/20 border-green-900/50 text-green-200', label: 'Abierta' },
      esperando: { class: 'bg-blue-900/20 border-blue-900/50 text-blue-200', label: 'Esperando' },
      cerrada: { class: 'bg-gray-900/20 border-gray-900/50 text-gray-200', label: 'Cerrada' },
      cancelada: { class: 'bg-red-900/20 border-red-900/50 text-red-200', label: 'Cancelada' }
    }
    return badges[estado] || badges.abierta
  }

  if (loadingSubastas) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Mis Subastas</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mis Subastas y Ofertas</h2>

      {misSubastas.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No has creado subastas aún.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {misSubastas.map(subasta => {
            const ofertas = ofertasPorSubasta[subasta.id] || []
            const badge = getEstadoBadge(subasta.estado)

            return (
              <Card key={subasta.id}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      {subasta.tipo.charAt(0).toUpperCase() + subasta.tipo.slice(1)}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">
                      Creada: {formatDateTime(subasta.created_at)}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border ${badge.class}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <div className="text-xs text-[var(--muted)]">Monto</div>
                    <div className="font-bold text-lg">
                      {formatMoney(subasta.monto, subasta.moneda)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Plazo</div>
                    <div className="font-bold text-lg">{subasta.plazo} días</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Ofertas Recibidas</div>
                    <div className="font-bold text-lg">{ofertas.length}</div>
                  </div>
                </div>

                {loadingOfertas ? (
                  <p className="text-sm text-[var(--muted)]">Cargando ofertas...</p>
                ) : ofertas.length === 0 ? (
                  <div className="p-4 bg-white/5 rounded text-center text-sm text-[var(--muted)]">
                    No hay ofertas para esta subasta
                  </div>
                ) : (
                  <div>
                    <h4 className="font-semibold mb-3">Ofertas Recibidas</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--line)]">
                            <th className="text-left p-2 text-xs text-[var(--muted)]">Banco</th>
                            <th className="text-left p-2 text-xs text-[var(--muted)]">Tasa</th>
                            <th className="text-left p-2 text-xs text-[var(--muted)]">Fecha</th>
                            <th className="text-left p-2 text-xs text-[var(--muted)]">Estado</th>
                            <th className="text-right p-2 text-xs text-[var(--muted)]">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ofertas.map(oferta => (
                            <tr key={oferta.id} className="border-b border-[var(--line)] hover:bg-white/5">
                              <td className="p-2">
                                <div className="font-semibold text-sm">{oferta.banco_entidad}</div>
                                <div className="text-xs text-[var(--muted)]">{oferta.banco_nombre}</div>
                              </td>
                              <td className="p-2">
                                <span className="font-bold text-[var(--good)]">{oferta.tasa}%</span>
                              </td>
                              <td className="p-2 text-xs">{formatDateTime(oferta.created_at)}</td>
                              <td className="p-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  oferta.estado === 'enviada' ? 'bg-blue-900/20 text-blue-200' :
                                  oferta.estado === 'aprobada' ? 'bg-green-900/20 text-green-200' :
                                  'bg-red-900/20 text-red-200'
                                }`}>
                                  {oferta.estado}
                                </span>
                              </td>
                              <td className="p-2">
                                {oferta.estado === 'enviada' && subasta.estado === 'abierta' && (
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="primary"
                                      className="text-xs"
                                      onClick={() => handleAprobar(subasta.id, oferta)}
                                      disabled={aprobando[oferta.id]}
                                    >
                                      {aprobando[oferta.id] ? 'Aprobando...' : 'Aprobar'}
                                    </Button>
                                    <Button
                                      variant="small"
                                      className="text-xs"
                                      onClick={() => handleRechazar(oferta.id)}
                                    >
                                      Rechazar
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmDialog />
    </div>
  )
}