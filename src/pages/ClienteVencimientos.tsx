import React, { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { calcularVencimiento, getIconoVencimiento } from '@/lib/vencimientoUtils'
import type { Moneda, Compromiso } from '@/types/database'

const GTQ_PER_USD = 7.7

type VistaType = 'semanal' | 'mensual'

interface CompromisoConBanco extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
  contraparte_nombre?: string
  es_externo?: boolean
}

interface BucketItem {
  label: string
  startDate: Date
  endDate: Date
  compromisos: {
    id: string
    op_id: string
    monto: number
    moneda: Moneda
    tasa: number
    fecha_vencimiento: string
    contraparte: string
    es_externo?: boolean
  }[]
  totalGTQ: number
  totalUSD: number
}

export const ClienteVencimientos: React.FC = () => {
  const { user } = useAuthStore()
  const [compromisos, setCompromisos] = useState<CompromisoConBanco[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<VistaType>('semanal')
  const [mesesAdelante, setMesesAdelante] = useState(3)

  // Cargar compromisos con nombres de banco resueltos (mismo RPC que ClienteCompromisos)
  useEffect(() => {
    const cargar = async () => {
      if (!user) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .rpc('obtener_compromisos_usuario', { p_user_id: user.id })
        if (error) throw error
        setCompromisos((data || []) as CompromisoConBanco[])
      } catch (error) {
        console.error('Error cargando compromisos:', error)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [user?.id])

  // Solo compromisos vigentes
  const vigentes = useMemo(() =>
    compromisos.filter(c => c.estado === 'vigente'),
    [compromisos]
  )

  // Resolver nombre de contraparte
  const getNombreContraparte = (c: CompromisoConBanco): string => {
    if (c.es_externo) return c.contraparte_nombre || 'Externo'
    return c.banco_entidad || c.banco_nombre || 'N/A'
  }

  // Generar buckets semanales o mensuales
  const buckets = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const result: BucketItem[] = []

    if (vista === 'semanal') {
      const fin = new Date(hoy)
      fin.setMonth(fin.getMonth() + mesesAdelante)

      // Empezar desde el lunes de esta semana
      const inicioSemana = new Date(hoy)
      const dia = inicioSemana.getDay()
      const diff = dia === 0 ? -6 : 1 - dia
      inicioSemana.setDate(inicioSemana.getDate() + diff)

      let cursor = new Date(inicioSemana)
      while (cursor < fin) {
        const start = new Date(cursor)
        const end = new Date(cursor)
        end.setDate(end.getDate() + 6)

        const startStr = start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        const endStr = end.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        const label = `${startStr} - ${endStr}`

        const comps = vigentes.filter(c => {
          const fv = new Date(c.fecha_vencimiento)
          return fv >= start && fv <= end
        }).map(c => ({
          id: c.id,
          op_id: c.op_id,
          monto: c.monto,
          moneda: c.moneda,
          tasa: c.tasa,
          fecha_vencimiento: c.fecha_vencimiento,
          contraparte: getNombreContraparte(c),
          es_externo: c.es_externo
        }))

        result.push({
          label,
          startDate: start,
          endDate: end,
          compromisos: comps,
          totalGTQ: comps.filter(c => c.moneda === 'GTQ').reduce((s, c) => s + c.monto, 0),
          totalUSD: comps.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0)
        })

        cursor.setDate(cursor.getDate() + 7)
      }
    } else {
      for (let i = 0; i < mesesAdelante + 1; i++) {
        const start = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
        const end = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 0)

        const label = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          .replace(/^\w/, c => c.toUpperCase())

        const comps = vigentes.filter(c => {
          const fv = new Date(c.fecha_vencimiento)
          return fv >= start && fv <= end
        }).map(c => ({
          id: c.id,
          op_id: c.op_id,
          monto: c.monto,
          moneda: c.moneda,
          tasa: c.tasa,
          fecha_vencimiento: c.fecha_vencimiento,
          contraparte: getNombreContraparte(c),
          es_externo: c.es_externo
        }))

        result.push({
          label,
          startDate: start,
          endDate: end,
          compromisos: comps,
          totalGTQ: comps.filter(c => c.moneda === 'GTQ').reduce((s, c) => s + c.monto, 0),
          totalUSD: comps.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0)
        })
      }
    }

    return result
  }, [vigentes, vista, mesesAdelante])

  // Totales generales
  const totales = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const en7dias = new Date(hoy)
    en7dias.setDate(en7dias.getDate() + 7)

    const en30dias = new Date(hoy)
    en30dias.setDate(en30dias.getDate() + 30)

    const totalGTQ = vigentes.filter(c => c.moneda === 'GTQ').reduce((s, c) => s + c.monto, 0)
    const totalUSD = vigentes.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0)
    const totalPortafolio = totalGTQ + totalUSD * GTQ_PER_USD

    const vencer7 = vigentes.filter(c => {
      const fv = new Date(c.fecha_vencimiento)
      return fv >= hoy && fv <= en7dias
    })
    const vencer30 = vigentes.filter(c => {
      const fv = new Date(c.fecha_vencimiento)
      return fv >= hoy && fv <= en30dias
    })

    const vencer7GTQ = vencer7.filter(c => c.moneda === 'GTQ').reduce((s, c) => s + c.monto, 0)
    const vencer7USD = vencer7.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0)
    const vencer30GTQ = vencer30.filter(c => c.moneda === 'GTQ').reduce((s, c) => s + c.monto, 0)
    const vencer30USD = vencer30.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0)

    return {
      totalGTQ, totalUSD, totalPortafolio, count: vigentes.length,
      vencer7GTQ, vencer7USD, vencer7Total: vencer7GTQ + vencer7USD * GTQ_PER_USD,
      vencer30GTQ, vencer30USD, vencer30Total: vencer30GTQ + vencer30USD * GTQ_PER_USD
    }
  }, [vigentes])

  // Maximo monto para las barras proporcionales
  const maxMonto = useMemo(() => {
    return Math.max(...buckets.map(b => b.totalGTQ + b.totalUSD * 8), 1)
  }, [buckets])

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Calendario de Vencimientos</h2>
        <Card>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-white/10 rounded" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Calendario de Vencimientos</h2>
          <p className="text-[var(--muted)] text-sm mt-1">
            Flujos de vencimientos de compromisos vigentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={vista === 'semanal' ? 'primary' : 'secondary'}
            onClick={() => setVista('semanal')}
          >
            Semanal
          </Button>
          <Button
            variant={vista === 'mensual' ? 'primary' : 'secondary'}
            onClick={() => setVista('mensual')}
          >
            Mensual
          </Button>
        </div>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total del Portafolio</div>
          <div className="text-2xl font-black mt-1">{formatMoney(totales.totalPortafolio, 'GTQ')}</div>
          <div className="flex gap-3 mt-1 text-xs text-[var(--muted)]">
            {totales.totalGTQ > 0 && <span>Q {formatMoney(totales.totalGTQ, 'GTQ')}</span>}
            {totales.totalUSD > 0 && <span>$ {formatMoney(totales.totalUSD, 'USD')}</span>}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Total por Vencer (7 días)</div>
          <div className="text-2xl font-black mt-1 text-yellow-300">{formatMoney(totales.vencer7Total, 'GTQ')}</div>
          <div className="flex gap-3 mt-1 text-xs text-[var(--muted)]">
            {totales.vencer7GTQ > 0 && <span>Q {formatMoney(totales.vencer7GTQ, 'GTQ')}</span>}
            {totales.vencer7USD > 0 && <span>$ {formatMoney(totales.vencer7USD, 'USD')}</span>}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Total por Vencer (30 días)</div>
          <div className="text-2xl font-black mt-1 text-orange-300">{formatMoney(totales.vencer30Total, 'GTQ')}</div>
          <div className="flex gap-3 mt-1 text-xs text-[var(--muted)]">
            {totales.vencer30GTQ > 0 && <span>Q {formatMoney(totales.vencer30GTQ, 'GTQ')}</span>}
            {totales.vencer30USD > 0 && <span>$ {formatMoney(totales.vencer30USD, 'USD')}</span>}
          </div>
        </Card>
      </div>

      {/* Selector de horizonte */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-[var(--muted)]">Horizonte:</span>
        {[3, 6, 12].map(m => (
          <button
            key={m}
            onClick={() => setMesesAdelante(m)}
            className={`px-3 py-1 rounded text-sm ${
              mesesAdelante === m
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
            }`}
          >
            {m} meses
          </button>
        ))}
      </div>

      {/* Gráfico de barras + detalle */}
      <Card>
        <h3 className="font-bold mb-4">
          Flujo de Vencimientos ({vista === 'semanal' ? 'Semanal' : 'Mensual'})
        </h3>

        {buckets.every(b => b.compromisos.length === 0) ? (
          <p className="text-[var(--muted)] text-center py-8">
            No hay vencimientos en el período seleccionado.
          </p>
        ) : (
          <div className="space-y-3">
            {buckets.map((bucket, idx) => {
              const hasItems = bucket.compromisos.length > 0
              const barWidth = maxMonto > 0
                ? Math.max(((bucket.totalGTQ + bucket.totalUSD * 8) / maxMonto) * 100, 2)
                : 0

              // Determinar si esta semana/mes es la actual
              const hoy = new Date()
              const esCurrent = hoy >= bucket.startDate && hoy <= bucket.endDate

              return (
                <div
                  key={idx}
                  className={`rounded-lg border transition-all ${
                    esCurrent
                      ? 'border-blue-500/50 bg-blue-900/10'
                      : hasItems
                        ? 'border-[var(--line)] bg-white/5'
                        : 'border-transparent bg-white/[0.02]'
                  }`}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${esCurrent ? 'text-blue-300' : ''}`}>
                          {bucket.label}
                        </span>
                        {esCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white">
                            Actual
                          </span>
                        )}
                        {hasItems && (
                          <span className="text-xs text-[var(--muted)]">
                            ({bucket.compromisos.length} compromiso{bucket.compromisos.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 text-sm items-center">
                        {bucket.totalGTQ > 0 && (
                          <span className="font-semibold text-green-300">{formatMoney(bucket.totalGTQ, 'GTQ')}</span>
                        )}
                        {bucket.totalUSD > 0 && (
                          <span className="font-semibold text-blue-300">{formatMoney(bucket.totalUSD, 'USD')}</span>
                        )}
                        {(bucket.totalGTQ > 0 || bucket.totalUSD > 0) && (
                          <span className="font-bold text-white border-l border-white/20 pl-3">
                            Total {formatMoney(bucket.totalGTQ + bucket.totalUSD * GTQ_PER_USD, 'GTQ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barra visual */}
                    {hasItems && (
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div className="flex h-full">
                          {bucket.totalGTQ > 0 && (
                            <div
                              className="bg-green-500/60 h-full"
                              style={{
                                width: `${(bucket.totalGTQ / (bucket.totalGTQ + bucket.totalUSD * 8)) * barWidth}%`
                              }}
                            />
                          )}
                          {bucket.totalUSD > 0 && (
                            <div
                              className="bg-blue-500/60 h-full"
                              style={{
                                width: `${(bucket.totalUSD * 8 / (bucket.totalGTQ + bucket.totalUSD * 8)) * barWidth}%`
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Detalle de compromisos */}
                    {hasItems && (
                      <div className="space-y-1.5">
                        {bucket.compromisos
                          .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
                          .map(comp => {
                            const venc = calcularVencimiento(comp.fecha_vencimiento)
                            return (
                              <div
                                key={comp.id}
                                className="flex items-center justify-between text-xs p-2 bg-black/20 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{getIconoVencimiento(venc.estado)}</span>
                                  <span className="font-semibold">{comp.contraparte}</span>
                                  {comp.es_externo && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-purple-900/20 text-purple-300 border border-purple-900/30">
                                      Ext
                                    </span>
                                  )}
                                  <span className="text-[var(--muted)]">{comp.op_id}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold">
                                    {formatMoney(comp.monto, comp.moneda)}
                                  </span>
                                  <span className="text-[var(--good)]">{comp.tasa}%</span>
                                  <span className={`${venc.color} font-semibold`}>
                                    {venc.texto}
                                  </span>
                                  <span className="text-[var(--muted)]">
                                    {formatDate(comp.fecha_vencimiento)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Leyenda */}
      <div className="flex gap-4 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/60" />
          <span>GTQ</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500/60" />
          <span>USD</span>
        </div>
      </div>
    </div>
  )
}
