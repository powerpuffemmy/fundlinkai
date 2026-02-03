import React from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useAuthStore } from '@/store/authStore'
import { formatMoney, formatDate, daysBetween } from '@/lib/utils'
import { generarPDFCompromiso } from '@/lib/pdfGenerator'

export const BancoCompromisos: React.FC = () => {
  const { user } = useAuthStore()
  const { compromisos, loading } = useCompromisos()

  // Filtrar solo los compromisos del banco actual
  const misCompromisos = compromisos.filter(c => c.banco_id === user?.id)

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

  const handleGenerarPDF = (comp: any) => {
    // Mapear los datos para el PDF con la estructura correcta
    const compromisoParaPDF = {
      ...comp,
      banco_nombre: comp.banco?.nombre,
      banco_entidad: comp.banco?.entidad,
      banco_logo_url: comp.banco?.logo_url,  // Logo del banco
      cliente_nombre: comp.cliente?.nombre,
      cliente_entidad: comp.cliente?.entidad,
    }
    
    generarPDFCompromiso(compromisoParaPDF)
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
      <div>
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        <p className="text-[var(--muted)] mt-1">
          Compromisos donde {user?.entidad} es el banco
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Compromisos</div>
          <div className="text-2xl font-black mt-1">{misCompromisos.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Vigentes</div>
          <div className="text-2xl font-black mt-1 text-[var(--good)]">
            {misCompromisos.filter(c => c.estado === 'vigente').length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Total Colocado</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(
              misCompromisos
                .filter(c => c.estado === 'vigente')
                .reduce((sum, c) => sum + c.monto, 0),
              'USD'
            )}
          </div>
        </Card>
      </div>

      {misCompromisos.length === 0 ? (
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
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Cliente</th>
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
                {misCompromisos.map(comp => {
                  const diasRestantes = getDiasRestantes(comp.fecha_vencimiento)
                  const alertClass = getAlertClass(diasRestantes)

                  return (
                    <tr key={comp.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <span className="font-mono text-sm font-semibold">{comp.op_id}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-sm">{comp.cliente?.entidad}</div>
                        <div className="text-xs text-[var(--muted)]">{comp.cliente?.nombre}</div>
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
                          onClick={() => handleGenerarPDF(comp)}
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
