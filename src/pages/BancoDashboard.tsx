import React from 'react'
import { Card } from '@/components/common/Card'

export const BancoDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Panel de Banco</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-[var(--muted)]">Solicitudes Activas</div>
          <div className="text-2xl font-black mt-1">3</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Monto Colocado</div>
          <div className="text-2xl font-black mt-1">$45.2M</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Ofertas Enviadas</div>
          <div className="text-2xl font-black mt-1">12</div>
        </Card>
        <Card>
          <div className="text-sm text-[var(--muted)]">Clientes Activos</div>
          <div className="text-2xl font-black mt-1">8</div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold mb-4">Funcionalidades Disponibles</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Solicitudes</div>
            <div className="text-sm text-[var(--muted)]">Ver y ofertar en subastas</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Oferta PUSH</div>
            <div className="text-sm text-[var(--muted)]">Enviar ofertas proactivas</div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-semibold mb-1">Compromisos</div>
            <div className="text-sm text-[var(--muted)]">Gestionar contratos</div>
          </div>
        </div>
      </Card>
    </div>
  )
}