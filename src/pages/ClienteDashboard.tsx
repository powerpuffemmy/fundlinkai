import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from '@/components/common/Card'
import { CardSkeleton } from '@/components/common/Skeleton'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { calcularVencimiento, getIconoVencimiento } from '@/lib/vencimientoUtils'
import type { Moneda } from '@/types/database'

const GTQ_PER_USD = 7.7

interface CompromisoRow {
  id: string
  op_id: string
  monto: number
  moneda: Moneda
  tasa: number
  estado: string
  fecha_vencimiento: string
  fecha_inicio: string
  created_at: string
  banco_id?: string
  es_externo?: boolean
  contraparte_nombre?: string
  banco_nombre?: string
  banco_entidad?: string
}

interface ResumenDia {
  ofertasSubasta: number
  ofertasColocacion: number
  compromisosNuevos: number
  detalleOfertas: { op_id: string; tasa: number; monto: number; moneda: string; tipo: string }[]
  detalleCompromisos: { op_id: string; monto: number; moneda: string; contraparte: string }[]
}

type Page = string

interface Props {
  onNavigate: (page: Page) => void
}

export const ClienteDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuthStore()
  const [compromisos, setCompromisos] = useState<CompromisoRow[]>([])
  const [resumen, setResumen] = useState<ResumenDia>({
    ofertasSubasta: 0, ofertasColocacion: 0, compromisosNuevos: 0,
    detalleOfertas: [], detalleCompromisos: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const cargar = async () => {
      setLoading(true)
      try {
        // Compromisos del cliente
        const { data: comps } = await supabase
          .rpc('obtener_compromisos_usuario', { p_user_id: user.id })

        const rows = (comps || []) as CompromisoRow[]
        setCompromisos(rows)

        // Resumen del día (desde medianoche hoy)
        const hoyISO = new Date()
        hoyISO.setHours(0, 0, 0, 0)
        const hoyStr = hoyISO.toISOString()

        // Subastas del cliente
        const { data: subastas } = await supabase
          .from('subastas')
          .select('id, op_id')
          .eq('cliente_id', user.id)

        const subIds = (subastas || []).map((s: any) => s.id)

        // Ofertas de hoy en subastas
        let ofertasSubHoy: any[] = []
        if (subIds.length > 0) {
          const { data } = await supabase
            .from('ofertas')
            .select('id, tasa, monto, moneda, subasta_id, subastas(op_id)')
            .in('subasta_id', subIds)
            .gte('created_at', hoyStr)
          ofertasSubHoy = data || []
        }

        // Solicitudes de colocación del cliente
        const { data: solicitudes } = await supabase
          .from('solicitudes_colocacion')
          .select('id')
          .eq('cliente_id', user.id)

        const solIds = (solicitudes || []).map((s: any) => s.id)

        // Ofertas de colocación de hoy
        let ofertasColHoy: any[] = []
        if (solIds.length > 0) {
          const { data } = await supabase
            .from('ofertas_colocacion')
            .select('id, tasa, monto, moneda')
            .in('solicitud_id', solIds)
            .eq('aprobada_por_admin', true)
            .gte('created_at', hoyStr)
          ofertasColHoy = data || []
        }

        // Compromisos nuevos hoy
        const compHoy = rows.filter(c => c.created_at >= hoyStr)

        setResumen({
          ofertasSubasta: ofertasSubHoy.length,
          ofertasColocacion: ofertasColHoy.length,
          compromisosNuevos: compHoy.length,
          detalleOfertas: [
            ...ofertasSubHoy.map((o: any) => ({
              op_id: (o.subastas as any)?.op_id || '—',
              tasa: o.tasa,
              monto: o.monto,
              moneda: o.moneda,
              tipo: 'Subasta'
            })),
            ...ofertasColHoy.map((o: any) => ({
              op_id: '—',
              tasa: o.tasa,
              monto: o.monto,
              moneda: o.moneda,
              tipo: 'Colocación'
            }))
          ],
          detalleCompromisos: compHoy.map(c => ({
            op_id: c.op_id,
            monto: c.monto,
            moneda: c.moneda,
            contraparte: c.es_externo ? (c.contraparte_nombre || 'Externo') : (c.banco_entidad || c.banco_nombre || '—')
          }))
        })
      } catch (err) {
        console.error('Error en dashboard cliente:', err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [user?.id])

  // ── Compromisos activos ──────────────────────────────────────────────────
  const activos = useMemo(() =>
    compromisos.filter(c => ['vigente', 'ejecutado', 'confirmado'].includes(c.estado)),
    [compromisos]
  )

  // ── Métricas ─────────────────────────────────────────────────────────────
  const totalPortafolio = useMemo(() => {
    const gtq = activos.filter(c => c.moneda === 'GTQ').reduce((s, c) => s + c.monto, 0)
    const usd = activos.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0)
    return gtq + usd * GTQ_PER_USD
  }, [activos])

  const tasaPromedio = activos.length > 0
    ? activos.reduce((s, c) => s + c.tasa, 0) / activos.length
    : 0

  const proximosVencer = useMemo(() =>
    activos
      .map(c => ({ ...c, venc: calcularVencimiento(c.fecha_vencimiento) }))
      .filter(c => c.venc.diasRestantes <= 15 && c.venc.diasRestantes >= 0)
      .sort((a, b) => a.venc.diasRestantes - b.venc.diasRestantes),
    [activos]
  )

  // Parsear fecha de vencimiento en hora LOCAL (evita desfase UTC)
  const parseFechaVenc = (fv: string) =>
    new Date(fv.length === 10 ? fv + 'T00:00:00' : fv)

  // ── Chart 1: Portafolio + vencimientos mensuales 12 meses ────────────────
  const datosGrafica1 = useMemo(() => {
    const hoy = new Date()
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const puntos: { label: string; total: number; isFirst: boolean }[] = [
      { label: 'Portafolio', total: totalPortafolio, isFirst: true }
    ]
    for (let i = 0; i < 12; i++) {
      const mesDate = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const mesEnd  = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 0)
      const total = activos
        .filter(c => { const fv = parseFechaVenc(c.fecha_vencimiento); return fv >= mesDate && fv <= mesEnd })
        .reduce((s, c) => s + (c.moneda === 'GTQ' ? c.monto : c.monto * GTQ_PER_USD), 0)
      const labelYear = mesDate.getFullYear() !== hoy.getFullYear()
        ? ` ${mesDate.getFullYear().toString().slice(2)}` : ''
      puntos.push({ label: MESES[mesDate.getMonth()] + labelYear, total, isFirst: false })
    }
    return puntos
  }, [activos, totalPortafolio])

  // ── Chart 2: Total mes + semanas ──────────────────────────────────────────
  const datosGrafica2 = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const mesStart = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const mesEnd   = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    const totalMes = activos
      .filter(c => { const fv = parseFechaVenc(c.fecha_vencimiento); return fv >= mesStart && fv <= mesEnd })
      .reduce((s, c) => s + (c.moneda === 'GTQ' ? c.monto : c.monto * GTQ_PER_USD), 0)

    const puntos: { label: string; total: number; isFirst: boolean }[] = [
      { label: 'Total Mes', total: totalMes, isFirst: true }
    ]
    const cursor = new Date(mesStart)
    const diff = cursor.getDay() === 0 ? -6 : 1 - cursor.getDay()
    cursor.setDate(cursor.getDate() + diff)
    let sem = 1
    while (cursor <= mesEnd && sem <= 6) {
      const s = new Date(Math.max(cursor.getTime(), mesStart.getTime()))
      const e = new Date(cursor); e.setDate(e.getDate() + 6)
      const eCapped = new Date(Math.min(e.getTime(), mesEnd.getTime()))
      const t = activos
        .filter(c => { const fv = parseFechaVenc(c.fecha_vencimiento); return fv >= s && fv <= eCapped })
        .reduce((s2, c) => s2 + (c.moneda === 'GTQ' ? c.monto : c.monto * GTQ_PER_USD), 0)
      const dStr = s.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      puntos.push({ label: `Sem ${sem}\n${dStr}`, total: t, isFirst: false })
      cursor.setDate(cursor.getDate() + 7)
      sem++
    }
    return puntos
  }, [activos])

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const TooltipMonto = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#1a1f2e] border border-white/10 rounded px-3 py-2 text-sm shadow-lg">
        <div className="font-semibold text-white mb-1">{label}</div>
        <div className="text-green-300">{formatMoney(payload[0]?.value ?? 0, 'GTQ')}</div>
      </div>
    )
  }
  const fmtY = (v: number) => {
    if (v >= 1_000_000) return `Q${(v/1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `Q${(v/1_000).toFixed(0)}K`
    return `Q${v}`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Panel de Tesorería</h2>
        <CardSkeleton count={4} />
      </div>
    )
  }

  const totalOfertas = resumen.ofertasSubasta + resumen.ofertasColocacion

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {user?.logo_url && (
          <img src={user.logo_url} alt="" className="h-12 w-12 object-contain rounded-lg bg-white/5 p-1" />
        )}
        <div>
          <h2 className="text-2xl font-bold">Panel de Tesorería</h2>
          <p className="text-sm text-[var(--muted)]">{user?.entidad}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Compromisos Activos</div>
          <div className="text-2xl font-black mt-1">{activos.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Portafolio</div>
          <div className="text-xl font-black mt-1">{formatMoney(totalPortafolio, 'GTQ')}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Tasa Promedio</div>
          <div className="text-2xl font-black mt-1">{tasaPromedio.toFixed(2)}%</div>
        </Card>
        <Card className={proximosVencer.length > 0 ? 'bg-red-900/10 border-red-900/50' : ''}>
          <div className="text-sm text-[var(--muted)]">Próximos a Vencer</div>
          <div className={`text-2xl font-black mt-1 ${proximosVencer.length > 0 ? 'text-red-400' : ''}`}>
            {proximosVencer.length}
          </div>
          {proximosVencer.length > 0 && <div className="text-xs text-red-300 mt-1">⚠ 15 días</div>}
        </Card>
      </div>

      {/* ── RESUMEN DEL DÍA ─────────────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold mb-3">Resumen del Día</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-black text-blue-400">{resumen.ofertasSubasta}</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">Ofertas en Subastas</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-black text-purple-400">{resumen.ofertasColocacion}</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">Ofertas de Colocación</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
            <div className="text-2xl font-black text-green-400">{resumen.compromisosNuevos}</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">Contratos Nuevos</div>
          </div>
        </div>

        {totalOfertas === 0 && resumen.compromisosNuevos === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-2">Sin actividad hoy.</p>
        ) : (
          <div className="space-y-2">
            {resumen.detalleOfertas.slice(0, 5).map((o, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-900/50">
                    {o.tipo}
                  </span>
                  <span className="text-[var(--muted)] font-mono text-xs">{o.op_id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(o.monto, o.moneda as Moneda)}</span>
                  <span className="text-[var(--good)]">{o.tasa}%</span>
                </div>
              </div>
            ))}
            {resumen.detalleCompromisos.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-300 border border-green-900/50">
                    Contrato
                  </span>
                  <span className="font-semibold text-xs">{c.contraparte}</span>
                  <span className="text-[var(--muted)] font-mono text-xs">{c.op_id}</span>
                </div>
                <span className="font-semibold">{formatMoney(c.monto, c.moneda as Moneda)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Alerta próximos a vencer */}
      {proximosVencer.length > 0 && (
        <Card className="bg-red-900/10 border-red-900/50">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-bold mb-2 text-red-400">
                {proximosVencer.length} compromiso(s) vence(n) en 15 días
              </h3>
              <div className="space-y-2">
                {proximosVencer.slice(0, 3).map(comp => (
                  <div key={comp.id} className="flex items-center justify-between p-2 bg-black/20 rounded border border-red-900/30 text-sm">
                    <div>
                      <div className="font-semibold">{comp.banco_entidad || comp.contraparte_nombre || '—'}</div>
                      <div className="text-xs text-[var(--muted)]">{formatMoney(comp.monto, comp.moneda)} · {comp.op_id}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${comp.venc.color}`}>{getIconoVencimiento(comp.venc.estado)} {comp.venc.texto}</div>
                      <div className="text-xs text-[var(--muted)]">{formatDate(comp.fecha_vencimiento)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── GRÁFICA 1: Portafolio + vencimientos mensuales ─────────────── */}
      <Card>
        <h3 className="font-bold mb-1">Vencimientos Mensuales — 12 Meses</h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Primera columna: total del portafolio. Columnas siguientes: monto que vence cada mes.
        </p>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={datosGrafica1} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtY} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip content={<TooltipMonto />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="total" radius={[4,4,0,0]}>
              {datosGrafica1.map((e, i) => (
                <Cell key={i} fill={e.isFirst ? '#6366f1' : e.total > 0 ? '#22c55e' : '#374151'} fillOpacity={e.total > 0 ? 0.85 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#6366f1' }} />Total Portafolio</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#22c55e' }} />Vencimiento mensual</div>
        </div>
      </Card>

      {/* ── GRÁFICA 2: Total mes + semanas ──────────────────────────────── */}
      <Card>
        <h3 className="font-bold mb-1">Vencimientos por Semana — Mes Actual</h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Primera columna: total del mes en curso. Columnas siguientes: desglose semanal.
        </p>
        {datosGrafica2.every(d => d.total === 0) ? (
          <p className="text-[var(--muted)] text-sm text-center py-8">No hay vencimientos en el mes actual.</p>
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={datosGrafica2} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtY} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<TooltipMonto />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="total" radius={[4,4,0,0]}>
                {datosGrafica2.map((e, i) => (
                  <Cell key={i} fill={e.isFirst ? '#f59e0b' : e.total > 0 ? '#60a5fa' : '#374151'} fillOpacity={e.total > 0 ? 0.85 : 0.3} />
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

      {/* ── ACCESOS RÁPIDOS ──────────────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold mb-3">Accesos Rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: '💰', label: 'Nueva Subasta',   sub: 'Solicitar colocación',    page: 'nueva-subasta' },
            { icon: '📋', label: 'Compromisos',      sub: 'Ver contratos vigentes',  page: 'compromisos'  },
            { icon: '📅', label: 'Vencimientos',     sub: 'Calendario y flujos',     page: 'vencimientos' },
            { icon: '🏦', label: 'Colocaciones',     sub: 'Solicitudes directas',    page: 'colocaciones' },
            { icon: '📊', label: 'Mis Subastas',     sub: 'Ver subastas activas',    page: 'subastas'     },
            { icon: '📁', label: 'Historial',        sub: 'Subastas finalizadas',    page: 'historial'    },
          ].map(({ icon, label, sub, page }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-blue-500/50 hover:bg-blue-900/10 cursor-pointer transition-colors text-left"
            >
              <div className="font-semibold mb-1">{icon} {label}</div>
              <div className="text-sm text-[var(--muted)]">{sub}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
