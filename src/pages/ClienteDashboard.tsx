import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { calcularVencimiento, getIconoVencimiento } from '@/lib/vencimientoUtils'
import type { Moneda } from '@/types/database'

interface CompromisoConBanco {
  id: string
  op_id: string
  monto: number
  moneda: Moneda
  tasa: number
  fecha_vencimiento: string
  banco_nombre?: string
  banco_entidad?: string
}

export const ClienteDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const { compromisos: comprimisosBase } = useCompromisos()
  const [compromisosProximos, setCompromisosProximos] = useState<CompromisoConBanco[]>([])
  const [loading, setLoading] = useState(true)

  const misCompromisos = comprimisosBase.filter(c => c.cliente_id === user?.id && c.estado === 'vigente')

  // Cargar compromisos próximos a vencer
  useEffect(() => {
    const cargarProximosVencer = async () => {
      if (misCompromisos.length === 0) {
        setLoading(false)
        return
      }

      try {
        // Filtrar compromisos < 15 días
        const proximos = misCompromisos
          .map(c => ({ ...c, vencimiento: calcularVencimiento(c.fecha_vencimiento) }))
          .filter(c => c.vencimiento.diasRestantes <= 15 && c.vencimiento.diasRestantes >= 0)
          .sort((a, b) => a.vencimiento.diasRestantes - b.vencimiento.diasRestantes)

        // Cargar datos de bancos
        const promesas = proximos.map(async (comp) => {
          const { data: banco } = await supabase
            .from('users')
            .select('nombre, entidad')
            .eq('id', comp.banco_id)
            .single()

          return {
            id: comp.id,
            op_id: comp.op_id,
            monto: comp.monto,
            moneda: comp.moneda,
            tasa: comp.tasa,
            fecha_vencimiento: comp.fecha_vencimiento,
            banco_nombre: banco?.nombre,
            banco_entidad: banco?.entidad
          }
        })

        const resultado = await Promise.all(promesas)
        setCompromisosProximos(resultado)
      } catch (error) {
        console.error('Error cargando compromisos próximos:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarProximosVencer()
  }, [misCompromisos.length])

  // Calcular métricas
  const totalCompromisos = misCompromisos.length
  const montoTotal = misCompromisos.reduce((sum, c) => sum + c.monto, 0)
  const tasaPromedio = totalCompromisos > 0
    ? misCompromisos.reduce((sum, c) => sum + c.tasa, 0) / totalCompromisos
    : 0

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Panel de Tesorería</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Compromisos Vigentes</div>
          <div className="text-2xl font-black mt-1">{totalCompromisos}</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Total</div>
          <div className="text-2xl font-black mt-1">
            {formatMoney(montoTotal, 'USD')}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Tasa Promedio</div>
          <div className="text-2xl font-black mt-1">{tasaPromedio.toFixed(2)}%</div>
        </Card>
        <Card className={compromisosProximos.length > 0 ? 'bg-red-900/10 border-red-900/50' : ''}>
          <div className="text-sm text-[var(--muted)]">Próximos a Vencer</div>
          <div className={`text-2xl font-black mt-1 ${compromisosProximos.length > 0 ? 'text-red-400' : ''}`}>
            {compromisosProximos.length}
          </div>
          {compromisosProximos.length > 0 && (
            <div className="text-xs text-red-300 mt-1">⚠️ Próximos 15 días</div>
          )}
        </Card>
      </div>

      {/* ⭐ NUEVO: Alerta de compromisos próximos a vencer */}
      {!loading && compromisosProximos.length > 0 && (
        <Card className="bg-red-900/10 border-red-900/50">
          <div className="flex items-start gap-3">
            <div className="text-3xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2 text-red-400">
                Atención: Compromisos Próximos a Vencer
              </h3>
              <p className="text-sm text-[var(--muted)] mb-3">
                Tienes {compromisosProximos.length} compromiso(s) que vence(n) en los próximos 15 días
              </p>
              <div className="space-y-2">
                {compromisosProximos.slice(0, 3).map(comp => {
                  const vencimientoInfo = calcularVencimiento(comp.fecha_vencimiento)
                  
                  return (
                    <div 
                      key={comp.id}
                      className="flex items-center justify-between p-3 bg-black/20 rounded border border-red-900/30"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{comp.banco_entidad}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatMoney(comp.monto, comp.moneda)} al {comp.tasa}% • OP-{comp.op_id}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${vencimientoInfo.color}`}>
                          {getIconoVencimiento(vencimientoInfo.estado)} {vencimientoInfo.texto}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatDate(comp.fecha_vencimiento)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {compromisosProximos.length > 3 && (
                <p className="text-xs text-[var(--muted)] mt-2">
                  + {compromisosProximos.length - 3} más compromisos próximos
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-bold mb-4">Funcionalidades Disponibles</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-blue-900/50 cursor-pointer transition-colors">
            <div className="font-semibold mb-1">💰 Nueva Subasta</div>
            <div className="text-sm text-[var(--muted)]">Crear solicitud de colocación</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-blue-900/50 cursor-pointer transition-colors">
            <div className="font-semibold mb-1">📊 Aprobaciones</div>
            <div className="text-sm text-[var(--muted)]">Revisar ofertas recibidas</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-blue-900/50 cursor-pointer transition-colors">
            <div className="font-semibold mb-1">📋 Compromisos</div>
            <div className="text-sm text-[var(--muted)]">Ver contratos vigentes</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
