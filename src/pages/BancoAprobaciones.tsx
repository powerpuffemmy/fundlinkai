import React, { useEffect, useState } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateTime } from '@/lib/utils'
import type { Oferta } from '@/types/database'

interface OfertaConDetalles extends Oferta {
  banco_nombre?: string
  subasta?: {
    monto: number
    moneda: string
    plazo: number
    tipo: string
  }
  usuario_nombre?: string
}

export const BancoAprobaciones: React.FC = () => {
  const { user } = useAuthStore()
  const [ofertas, setOfertas] = useState<OfertaConDetalles[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<Record<string, boolean>>({})

  const cargarOfertas = async () => {
    if (!user || user.role !== 'banco_admin') return

    try {
      setLoading(true)

      // Obtener ofertas de usuarios del mismo banco que requieren aprobación
      const { data: mismosBanco, error: errorUsuarios } = await supabase
        .from('users')
        .select('id')
        .eq('entidad', user.entidad)
        .eq('role', 'banco_mesa')

      if (errorUsuarios) throw errorUsuarios

      const idsUsuarios = mismosBanco?.map(u => u.id) || []

      if (idsUsuarios.length === 0) {
        setOfertas([])
        return
      }

      // Obtener ofertas pendientes de aprobación
      const { data, error } = await supabase
        .from('ofertas')
        .select(`
          *,
          banco:users!ofertas_banco_id_fkey(nombre),
          subasta:subastas(monto, moneda, plazo, tipo)
        `)
        .in('banco_id', idsUsuarios)
        .eq('aprobada_por_admin', false)
        .eq('estado', 'enviada')
        .order('created_at', { ascending: false })

      if (error) throw error

      const ofertasConDetalles = data?.map(o => ({
        ...o,
        banco_nombre: o.banco?.nombre,
        usuario_nombre: o.banco?.nombre,
        subasta: Array.isArray(o.subasta) ? o.subasta[0] : o.subasta
      })) || []

      setOfertas(ofertasConDetalles)
    } catch (error) {
      console.error('Error cargando ofertas:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarOfertas()
  }, [user])

  const handleAprobar = async (ofertaId: string) => {
    try {
      setProcesando(prev => ({ ...prev, [ofertaId]: true }))

      const { error } = await supabase
        .from('ofertas')
        .update({ aprobada_por_admin: true })
        .eq('id', ofertaId)

      if (error) throw error

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Aprobar Oferta Mesa',
        p_detalle: `Admin aprobó oferta de Mesa`,
        p_metadata: { oferta_id: ofertaId }
      })

      alert('Oferta aprobada exitosamente')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al aprobar:', error)
      alert('Error al aprobar la oferta')
    } finally {
      setProcesando(prev => ({ ...prev, [ofertaId]: false }))
    }
  }

  const handleRechazar = async (ofertaId: string) => {
    const confirmar = window.confirm('¿Seguro que deseas rechazar esta oferta?')
    if (!confirmar) return

    try {
      setProcesando(prev => ({ ...prev, [ofertaId]: true }))

      const { error } = await supabase
        .from('ofertas')
        .update({ estado: 'rechazada' })
        .eq('id', ofertaId)

      if (error) throw error

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user?.id,
        p_accion: 'Rechazar Oferta Mesa',
        p_detalle: `Admin rechazó oferta de Mesa`,
        p_metadata: { oferta_id: ofertaId }
      })

      alert('Oferta rechazada')
      await cargarOfertas()
    } catch (error) {
      console.error('Error al rechazar:', error)
      alert('Error al rechazar la oferta')
    } finally {
      setProcesando(prev => ({ ...prev, [ofertaId]: false }))
    }
  }

  if (user?.role !== 'banco_admin') {
    return (
      <Card>
        <p className="text-[var(--muted)]">
          Solo los administradores del banco pueden ver esta sección.
        </p>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Aprobaciones</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Aprobaciones de Mesa de Dinero</h2>

      {ofertas.length === 0 ? (
        <Card>
          <p className="text-[var(--muted)] text-center py-8">
            No hay ofertas pendientes de aprobación
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-[var(--muted)] mb-4">
            {ofertas.length} oferta(s) pendiente(s) de aprobación
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Enviada por</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Subasta</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Monto</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Plazo</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Tasa Ofertada</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Fecha</th>
                  <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map(oferta => (
                  <tr key={oferta.id} className="border-b border-[var(--line)] hover:bg-white/5">
                    <td className="p-3">
                      <div className="font-semibold text-sm">{oferta.usuario_nombre}</div>
                      <div className="text-xs text-[var(--muted)]">Mesa de Dinero</div>
                    </td>
                    <td className="p-3 text-sm">
                      {oferta.subasta?.tipo || '—'}
                    </td>
                    <td className="p-3 font-semibold">
                      {oferta.subasta ? formatMoney(oferta.subasta.monto, oferta.subasta.moneda as 'USD' | 'GTQ') : '—'}                    </td>
                    <td className="p-3 text-sm">
                      {oferta.subasta?.plazo || '—'} días
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-[var(--good)] text-lg">{oferta.tasa}%</span>
                    </td>
                    <td className="p-3 text-xs">
                      {formatDateTime(oferta.created_at)}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="primary"
                          className="text-xs"
                          onClick={() => handleAprobar(oferta.id)}
                          disabled={procesando[oferta.id]}
                        >
                          {procesando[oferta.id] ? 'Aprobando...' : 'Aprobar'}
                        </Button>
                        <Button
                          variant="small"
                          className="text-xs"
                          onClick={() => handleRechazar(oferta.id)}
                          disabled={procesando[oferta.id]}
                        >
                          Rechazar
                        </Button>
                      </div>
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