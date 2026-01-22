import React from 'react'
import { Card } from '@/components/common/Card'

export const WebAdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Panel de Administración</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Total Usuarios</div>
          <div className="text-2xl font-black mt-1">8</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Subastas Activas</div>
          <div className="text-2xl font-black mt-1">1</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Compromisos Vigentes</div>
          <div className="text-2xl font-black mt-1">2</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Volumen Total</div>
          <div className="text-2xl font-black mt-1">$118M</div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold mb-4">Administración del Sistema</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Usuarios</div>
            <div className="text-sm text-[var(--muted)]">Gestionar cuentas y roles</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Auditoría</div>
            <div className="text-sm text-[var(--muted)]">Ver log de operaciones</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Reportes</div>
            <div className="text-sm text-[var(--muted)]">Análisis y estadísticas</div>
          </div>
        </div>
      </Card>
    </div>
  )
}