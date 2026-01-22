import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'  // ← AGREGAR ESTA LÍNEA
import { useCompromisos } from '@/hooks/useCompromisos'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate, daysBetween } from '@/lib/utils'
import { generarPDFCompromiso } from '@/lib/pdfGenerator'  // Esta también debería estar
import type { Compromiso } from '@/types/database'

interface CompromisoConBanco extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
}

export const ClienteCompromisos: React.FC = () => {
  const { user } = useAuthStore()
  const { compromisos: comprimisosBase, loading } = useCompromisos()
  const [compromisos, setCompromisos] = useState<CompromisoConBanco[]>([])

  const misCompromisos = comprimisosBase.filter(c => c.cliente_id === user?.id)

  // Cargar datos del banco para cada compromiso
  useEffect(() => {
    const cargarDatosBancos = async () => {
      if (misCompromisos.length === 0) return

      try {
        const promesas = misCompromisos.map(async (comp) => {
          const { data: banco } = await supabase
            .from('users')
            .select('nombre, entidad')
            .eq('id', comp.banco_id)
            .single()

          return {
            ...comp,
            banco_nombre: banco?.nombre,
            banco_entidad: banco?.entidad
          }
        })

        const resultado = await Promise.all(promesas)
        setCompromisos(resultado)
      } catch (error) {
        console.error('Error cargando bancos:', error)
        setCompromisos(misCompromisos)
      }
    }

    cargarDatosBancos()
  }, [misCompromisos.length])

  const getDiasRestantes = (fechaVencimiento: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    const dias = daysBetween(hoy, fechaVencimiento)
    return dias
  }

  const getAlertClass = (dias: number) => {
    if (dias <= 7) return 'text-[var(--bad)]'
    if (dias <= 30) return 'text-[var(--warn)]'
    return 'text-[var(--good)]'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mis Compromisos</h2>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Compromisos</div>
          <div className="text-2xl font-black mt-1">{compromisos.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Vigentes</div>
          <div className="text-2xl font-black mt-1 text-[var(--good)]">
            {compromisos.filter(c => c.estado === 'vigente').length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Total</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(
              compromisos
                .filter(c => c.estado === 'vigente')
                .reduce((sum, c) => sum + c.monto, 0),
              'USD'
            )}
          </div>
        </Card>
      </div>

      {compromisos.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No tienes compromisos vigentes.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">OP-ID</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Banco</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Inicio</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Vencimiento</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Días Rest.</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {compromisos.map(comp => {
                  const diasRestantes = getDiasRestantes(comp.fecha_vencimiento)
                  const alertClass = getAlertClass(diasRestantes)

                  return (
                    <tr key={comp.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <span className="font-mono text-sm font-semibold">{comp.op_id}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-sm">{comp.banco_entidad}</div>
                        <div className="text-xs text-[var(--muted)]">{comp.banco_nombre}</div>
                      </td>
                      <td className="p-3 font-semibold">
                        {formatMoney(comp.monto, comp.moneda)}
                      </td>
                      <td className="p-3 font-semibold text-[var(--good)]">
                        {comp.tasa}%
                      </td>
                      <td className="p-3 text-sm">{formatDate(comp.fecha_inicio)}</td>
                      <td className="p-3 text-sm">{formatDate(comp.fecha_vencimiento)}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${alertClass}`}>
                          {diasRestantes} días
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          comp.estado === 'vigente' ? 'bg-green-900/20 text-green-200' :
                          comp.estado === 'vencido' ? 'bg-red-900/20 text-red-200' :
                          'bg-gray-900/20 text-gray-200'
                        }`}>
                          {comp.estado}
                        </span>
                      </td>
                      <td className="p-3">
                            <Button
                                variant="small"
                                onClick={() => generarPDFCompromiso(comp)}
                            >
                                Ver PDF
                            </Button>
                            </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}