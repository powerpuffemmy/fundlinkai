import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { calcularVencimiento, getIconoVencimiento } from '@/lib/vencimientoUtils'
import type { Moneda, Compromiso } from '@/types/database'

const GTQ_PER_USD = 7.7

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative inline-block group ml-1.5 align-middle">
    <span className="text-[var(--muted)] cursor-help text-xs select-none">ⓘ</span>
    <div className="pointer-events-none absolute left-0 bottom-full mb-2 w-64 text-xs bg-[#1c1c1c] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
      {text}
    </div>
  </div>
)

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

  useEffect(() => {
    cargar()
  }, [user?.id])

  // Compromisos activos (vigente + ejecutado + confirmado)
  const vigentes = useMemo(() =>
    compromisos.filter(c => ['vigente', 'ejecutado', 'confirmado'].includes(c.estado)),
    [compromisos]
  )

  // Parsear fecha de vencimiento en hora LOCAL (evita desfase UTC)
  const parseFechaVenc = (fv: string) =>
    new Date(fv.length === 10 ? fv + 'T00:00:00' : fv)

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
          const fv = parseFechaVenc(c.fecha_vencimiento)
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
          const fv = parseFechaVenc(c.fecha_vencimiento)
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
      const fv = parseFechaVenc(c.fecha_vencimiento)
      return fv >= hoy && fv <= en7dias
    })
    const vencer30 = vigentes.filter(c => {
      const fv = parseFechaVenc(c.fecha_vencimiento)
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

  // ── Chart 1: Total portafolio + vencimientos por mes (12 meses) ──────────
  const datosGrafica1 = useMemo(() => {
    const hoy = new Date()
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const puntos: { label: string; total: number; isFirst: boolean }[] = []

    // Primera columna = total portafolio
    puntos.push({ label: 'Portafolio', total: totales.totalPortafolio, isFirst: true })

    for (let i = 0; i < 12; i++) {
      const mesDate = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const mesEnd  = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 0)
      const total   = vigentes
        .filter(c => {
          const fv = parseFechaVenc(c.fecha_vencimiento)
          return fv >= mesDate && fv <= mesEnd
        })
        .reduce((s, c) => s + (c.moneda === 'GTQ' ? c.monto : c.monto * GTQ_PER_USD), 0)

      const labelMes = MESES[mesDate.getMonth()]
      const labelYear = mesDate.getFullYear() !== hoy.getFullYear()
        ? ` ${mesDate.getFullYear().toString().slice(2)}`
        : ''
      puntos.push({ label: labelMes + labelYear, total, isFirst: false })
    }
    return puntos
  }, [vigentes, totales.totalPortafolio])

  // ── Chart 2: Total del mes actual + vencimientos por semana ──────────────
  const datosGrafica2 = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const mesStart = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const mesEnd   = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)

    const totalMes = vigentes
      .filter(c => {
        const fv = parseFechaVenc(c.fecha_vencimiento)
        return fv >= mesStart && fv <= mesEnd
      })
      .reduce((s, c) => s + (c.moneda === 'GTQ' ? c.monto : c.monto * GTQ_PER_USD), 0)

    const puntos: { label: string; total: number; isFirst: boolean }[] = [
      { label: 'Total Mes', total: totalMes, isFirst: true }
    ]

    // Semanas del mes actual
    const cursor = new Date(mesStart)
    const diaInicio = cursor.getDay()
    const diffLunes = diaInicio === 0 ? -6 : 1 - diaInicio
    cursor.setDate(cursor.getDate() + diffLunes)
    // Ajustar para que el cursor no quede antes del inicio del mes
    if (cursor < mesStart) cursor.setDate(cursor.getDate())

    let semNum = 1
    while (cursor <= mesEnd) {
      const semStart = new Date(Math.max(cursor.getTime(), mesStart.getTime()))
      const semEnd   = new Date(cursor)
      semEnd.setDate(semEnd.getDate() + 6)
      const semEndCapped = new Date(Math.min(semEnd.getTime(), mesEnd.getTime()))

      const totalSem = vigentes
        .filter(c => {
          const fv = parseFechaVenc(c.fecha_vencimiento)
          return fv >= semStart && fv <= semEndCapped
        })
        .reduce((s, c) => s + (c.moneda === 'GTQ' ? c.monto : c.monto * GTQ_PER_USD), 0)

      const dStr = semStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      puntos.push({ label: `Sem ${semNum}\n${dStr}`, total: totalSem, isFirst: false })

      cursor.setDate(cursor.getDate() + 7)
      semNum++
      if (semNum > 6) break
    }
    return puntos
  }, [vigentes])

  // ── Tooltip personalizado ─────────────────────────────────────────────────
  const TooltipMonto = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#1a1f2e] border border-white/10 rounded px-3 py-2 text-sm shadow-lg">
        <div className="font-semibold text-white mb-1">{label}</div>
        <div className="text-green-300">{formatMoney(payload[0]?.value ?? 0, 'GTQ')}</div>
      </div>
    )
  }

  // ── Formateador eje Y ─────────────────────────────────────────────────────
  const fmtY = (v: number) => {
    if (v >= 1_000_000) return `Q${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `Q${(v / 1_000).toFixed(0)}K`
    return `Q${v}`
  }

  // Referencia para las barras: total del portafolio (no el máximo del bucket)
  // así cada barra muestra qué % del portafolio total vence en ese período
  const refPortafolio = totales.totalPortafolio > 0 ? totales.totalPortafolio : 1

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
          <Button
            variant="secondary"
            onClick={cargar}
            disabled={loading}
          >
            ↻ Actualizar
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

      {/* ── Gráfica 1: Portafolio total + vencimientos mensuales 12 meses ── */}
      <Card>
        <h3 className="font-bold mb-4">Vencimientos Mensuales — 12 Meses<InfoTooltip text="Primera columna: total del portafolio vigente. Columnas siguientes: monto que vence cada mes." /></h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datosGrafica1} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtY}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<TooltipMonto />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {datosGrafica1.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isFirst ? '#38bdf8' : entry.total > 0 ? '#22c55e' : '#374151'}
                  fillOpacity={entry.total > 0 ? 0.85 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#38bdf8' }} />Total Portafolio</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#22c55e' }} />Vencimiento mensual</div>
        </div>
      </Card>

      {/* ── Gráfica 2: Total mes actual + vencimientos por semana ── */}
      <Card>
        <h3 className="font-bold mb-4">Vencimientos por Semana — Mes Actual<InfoTooltip text="Primera columna: total que vence en el mes en curso. Columnas siguientes: desglose semanal." /></h3>
        {datosGrafica2.every(d => d.total === 0) ? (
          <p className="text-[var(--muted)] text-sm text-center py-8">
            No hay vencimientos en el mes actual.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={datosGrafica2} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtY}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip content={<TooltipMonto />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {datosGrafica2.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.isFirst ? '#f59e0b' : entry.total > 0 ? '#60a5fa' : '#374151'}
                    fillOpacity={entry.total > 0 ? 0.85 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-2 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#f59e0b' }} />Total del Mes</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#60a5fa' }} />Vencimiento semanal</div>
        </div>
      </Card>

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
                              className="bg-green-500/70 h-full"
                              style={{
                                width: `${(bucket.totalGTQ / refPortafolio) * 100}%`
                              }}
                            />
                          )}
                          {bucket.totalUSD > 0 && (
                            <div
                              className="bg-blue-500/70 h-full"
                              style={{
                                width: `${(bucket.totalUSD * GTQ_PER_USD / refPortafolio) * 100}%`
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
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-sky-900/20 text-sky-300 border border-sky-900/30">
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
