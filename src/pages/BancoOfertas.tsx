import React from 'react'
import { Card } from '@/components/common/Card'
import { useOfertas } from '@/hooks/useOfertas'
import { formatDateTime } from '@/lib/utils'

export const BancoOfertas: React.FC = () => {
  const { ofertas, loading } = useOfertas()

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, string> = {
      enviada: 'bg-blue-900/20 border-blue-900/50 text-blue-200',
      aprobada: 'bg-green-900/20 border-green-900/50 text-green-200',
      rechazada: 'bg-red-900/20 border-red-900/50 text-red-200',
      adjudicada: 'bg-purple-900/20 border-purple-900/50 text-purple-200'
    }
    return badges[estado] || 'bg-gray-900/20 border-gray-900/50 text-gray-200'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Mis Ofertas</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando ofertas...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mis Ofertas</h2>

      {ofertas.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No has enviado ofertas aún.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Fecha</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Aprobada Admin</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map(oferta => (
                  <tr key={oferta.id} className="border-b border-[var(--line)] hover:bg-white/5">
                    <td className="p-3 text-sm">{formatDateTime(oferta.created_at)}</td>
                    <td className="p-3 text-sm font-semibold">{oferta.tasa}%</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded border ${getEstadoBadge(oferta.estado)}`}>
                        {oferta.estado.charAt(0).toUpperCase() + oferta.estado.slice(1)}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {oferta.aprobada_por_admin ? (
                        <span className="text-[var(--good)]">✓ Sí</span>
                      ) : (
                        <span className="text-[var(--warn)]">⏳ Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}