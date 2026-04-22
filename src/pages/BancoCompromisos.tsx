import React, { useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useAuthStore } from '@/store/authStore'
import { formatMoney, formatDate, daysBetween } from '@/lib/utils'
import { generarPDFContrato, generarPDFEjecutado } from '@/lib/pdfGenerator'
import { toastSuccess, toastError } from '@/lib/toastUtils'

const estadoBadge = (estado: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    confirmado: { cls: 'bg-blue-900/30 text-blue-300 border border-blue-900/50',   label: 'Confirmado' },
    ejecutado:  { cls: 'bg-green-900/30 text-green-300 border border-green-900/50', label: 'Ejecutado' },
    vigente:    { cls: 'bg-green-900/20 text-green-200',                             label: 'Vigente' },
    vencido:    { cls: 'bg-red-900/20 text-red-200',                                 label: 'Vencido' },
    renovado:   { cls: 'bg-yellow-900/20 text-yellow-200',                           label: 'Renovado' },
    cancelado:  { cls: 'bg-gray-900/20 text-gray-400',                               label: 'Cancelado' },
  }
  const { cls, label } = map[estado] || { cls: 'bg-white/10 text-white', label: estado }
  return <span className={`text-xs px-2 py-1 rounded font-semibold ${cls}`}>{label}</span>
}

export const BancoCompromisos: React.FC = () => {
  const { user } = useAuthStore()
  const { compromisos, loading } = useCompromisos()
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  const misCompromisos = compromisos.filter(c => c.banco_id === user?.id)

  const getDiasRestantes = (fechaVencimiento: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    return daysBetween(hoy, fechaVencimiento)
  }

  const getAlertClass = (dias: number) => {
    if (dias <= 7) return 'text-[var(--bad)]'
    if (dias <= 30) return 'text-[var(--warn)]'
    return 'text-[var(--good)]'
  }

  const mapParaPDF = (comp: any) => ({
    ...comp,
    banco_nombre: comp.banco?.nombre,
    banco_entidad: comp.banco?.entidad,
    cliente_nombre: comp.cliente?.nombre,
    cliente_entidad: comp.cliente?.entidad,
  })

  const handleContrato = async (comp: any) => {
    setGenerandoPDF(comp.id + '-contrato')
    await generarPDFContrato(mapParaPDF(comp))
    setGenerandoPDF(null)
  }

  const handleEjecutado = async (comp: any) => {
    setGenerandoPDF(comp.id + '-ejecutado')
    await generarPDFEjecutado(mapParaPDF(comp))
    setGenerandoPDF(null)
  }

  const activos = misCompromisos.filter(c => ['confirmado', 'ejecutado', 'vigente'].includes(c.estado))
  const historicos = misCompromisos.filter(c => ['vencido', 'renovado', 'cancelado'].includes(c.estado))

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        <Card><p className="text-[var(--muted)]">Cargando...</p></Card>
      </div>
    )
  }

  const renderTabla = (lista: any[], titulo: string) => (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-[var(--muted)]">{titulo}</h3>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left p-3 text-sm text-[var(--muted)]">OP-ID</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Cliente</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Monto · Tasa</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Confirmado</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Ejecutado</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Vencimiento</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                <th className="text-left p-3 text-sm text-[var(--muted)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(comp => {
                const dias = getDiasRestantes(comp.fecha_vencimiento)
                const alertClass = getAlertClass(dias)
                const isEjecutado = comp.estado === 'ejecutado'

                return (
                  <tr key={comp.id} className="border-b border-[var(--line)] hover:bg-white/5">
                    <td className="p-3">
                      <span className="font-mono text-sm font-semibold">{comp.op_id}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-sm">{comp.cliente?.entidad}</div>
                      <div className="text-xs text-[var(--muted)]">{comp.cliente?.nombre}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{formatMoney(comp.monto, comp.moneda)}</div>
                      <div className="text-sm text-[var(--good)]">{comp.tasa}%</div>
                    </td>
                    <td className="p-3 text-xs text-[var(--muted)]">
                      {comp.fecha_confirmacion
                        ? new Date(comp.fecha_confirmacion).toLocaleDateString('es-GT')
                        : formatDate(comp.fecha_inicio)}
                    </td>
                    <td className="p-3 text-xs">
                      {comp.fecha_ejecucion ? (
                        <span className="text-green-400">
                          {new Date(comp.fecha_ejecucion).toLocaleDateString('es-GT')}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      <div>{formatDate(comp.fecha_vencimiento)}</div>
                      <div className={`text-xs font-semibold ${alertClass}`}>{dias} días</div>
                    </td>
                    <td className="p-3">{estadoBadge(comp.estado)}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <Button
                          variant="small"
                          className="text-xs"
                          onClick={() => handleContrato(comp)}
                          disabled={generandoPDF === comp.id + '-contrato'}
                        >
                          {generandoPDF === comp.id + '-contrato' ? '...' : 'PDF Contrato'}
                        </Button>
                        {isEjecutado && (
                          <Button
                            variant="small"
                            className="text-xs"
                            onClick={() => handleEjecutado(comp)}
                            disabled={generandoPDF === comp.id + '-ejecutado'}
                          >
                            {generandoPDF === comp.id + '-ejecutado' ? '...' : 'PDF Ejecutado'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mis Compromisos</h2>
        <p className="text-[var(--muted)] mt-1">Compromisos donde {user?.entidad} es el banco</p>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total</div>
          <div className="text-2xl font-black mt-1">{misCompromisos.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Confirmados</div>
          <div className="text-2xl font-black mt-1 text-blue-400">
            {misCompromisos.filter(c => c.estado === 'confirmado').length}
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5">Pendiente desembolso</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Ejecutados / Vigentes</div>
          <div className="text-2xl font-black mt-1 text-[var(--good)]">
            {misCompromisos.filter(c => ['ejecutado', 'vigente'].includes(c.estado)).length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Colocado</div>
          <div className="text-xl font-black mt-1">
            {formatMoney(
              misCompromisos
                .filter(c => ['ejecutado', 'vigente', 'confirmado'].includes(c.estado))
                .reduce((s, c) => s + c.monto, 0),
              'GTQ'
            )}
          </div>
        </Card>
      </div>

      {misCompromisos.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">No tienes compromisos registrados.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {activos.length > 0 && renderTabla(activos, 'Activos')}
          {historicos.length > 0 && renderTabla(historicos, 'Histórico')}
        </div>
      )}
    </div>
  )
}
