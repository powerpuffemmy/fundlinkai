import React from 'react'
import { Card } from '@/components/common/Card'

export const ClienteDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Panel de Tesorería</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Liquidez</div>
          <div className="text-2xl font-black mt-1">$25.4M</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Colocado (30d)</div>
          <div className="text-2xl font-black mt-1">$62.8M</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Tasa promedio</div>
          <div className="text-2xl font-black mt-1">5.80%</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Bancos activos</div>
          <div className="text-2xl font-black mt-1">5</div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold mb-4">Funcionalidades Disponibles</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Nueva Subasta</div>
            <div className="text-sm text-[var(--muted)]">Crear solicitud de colocación</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Aprobaciones</div>
            <div className="text-sm text-[var(--muted)]">Revisar ofertas recibidas</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Compromisos</div>
            <div className="text-sm text-[var(--muted)]">Ver contratos vigentes</div>
          </div>
        </div>
      </Card>
    </div>
  )
}