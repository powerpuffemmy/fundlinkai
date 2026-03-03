import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { SolicitudColocacion, OfertaColocacion, Moneda } from '@/types/database'

interface SolicitudConOfertas extends SolicitudColocacion {
  ofertas?: OfertaColocacion[]
}

export const useSolicitudesColocacion = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudConOfertas[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchSolicitudes = async () => {
    try {
      setLoading(true)
      if (!user) return

      if (user.role.startsWith('cliente')) {
        // Cliente: ve sus propias solicitudes con ofertas
        const { data: solData, error: solError } = await supabase
          .from('solicitudes_colocacion')
          .select('*')
          .eq('cliente_id', user.id)
          .order('created_at', { ascending: false })

        if (solError) throw solError

        // Por cada solicitud, cargar sus ofertas con datos del banco
        const solicitudesConOfertas: SolicitudConOfertas[] = await Promise.all(
          (solData || []).map(async (sol) => {
            const { data: ofertasData } = await supabase
              .from('ofertas_colocacion')
              .select('*, banco:users!banco_id(nombre, entidad)')
              .eq('solicitud_id', sol.id)
              .order('created_at', { ascending: false })
            return { ...sol, ofertas: (ofertasData || []) as OfertaColocacion[] }
          })
        )
        setSolicitudes(solicitudesConOfertas)

      } else if (user.role.startsWith('banco')) {
        // Banco: ve solicitudes donde fue invitado
        const { data: scbData, error: scbError } = await supabase
          .from('solicitud_colocacion_bancos')
          .select('solicitud_id')
          .eq('banco_id', user.id)

        if (scbError) throw scbError

        const ids = (scbData || []).map(r => r.solicitud_id)
        if (ids.length === 0) {
          setSolicitudes([])
          return
        }

        const { data: solData, error: solError } = await supabase
          .from('solicitudes_colocacion')
          .select('*, cliente:users!cliente_id(nombre, entidad)')
          .in('id', ids)
          .order('created_at', { ascending: false })

        if (solError) throw solError

        // Por cada solicitud, cargar las ofertas de este banco
        const solicitudesConOfertas: SolicitudConOfertas[] = await Promise.all(
          (solData || []).map(async (sol) => {
            const { data: ofertasData } = await supabase
              .from('ofertas_colocacion')
              .select('*')
              .eq('solicitud_id', sol.id)
              .eq('banco_id', user.id)
              .order('created_at', { ascending: false })
            return { ...sol, ofertas: (ofertasData || []) as OfertaColocacion[] }
          })
        )
        setSolicitudes(solicitudesConOfertas)
      }
    } catch (error) {
      console.error('Error fetching solicitudes colocacion:', error)
    } finally {
      setLoading(false)
    }
  }

  const crearSolicitud = async (
    datos: {
      moneda: Moneda
      monto?: number | null
      plazo: number
      tasa_objetivo?: number | null
      fecha_cierre: string
      notas?: string
    },
    bancosIds: string[]
  ) => {
    if (!user) throw new Error('Usuario no autenticado')

    const { data, error } = await supabase
      .from('solicitudes_colocacion')
      .insert([{
        cliente_id: user.id,
        ...datos,
        estado: 'abierta'
      }])
      .select()
      .single()

    if (error) throw error

    // Insertar bancos invitados
    if (bancosIds.length > 0) {
      const { error: errorBancos } = await supabase
        .from('solicitud_colocacion_bancos')
        .insert(bancosIds.map(bid => ({ solicitud_id: data.id, banco_id: bid })))
      if (errorBancos) throw errorBancos
    }

    await fetchSolicitudes()
    return data as SolicitudColocacion
  }

  const cerrarSolicitud = async (id: string) => {
    const { error } = await supabase
      .from('solicitudes_colocacion')
      .update({ estado: 'cerrada', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await fetchSolicitudes()
  }

  const cancelarSolicitud = async (id: string) => {
    const { error } = await supabase
      .from('solicitudes_colocacion')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await fetchSolicitudes()
  }

  const enviarOferta = async (datos: {
    solicitud_id: string
    tasa: number
    monto: number
    notas?: string
  }) => {
    if (!user) throw new Error('Usuario no autenticado')

    const { data, error } = await supabase
      .from('ofertas_colocacion')
      .insert([{ banco_id: user.id, ...datos, estado: 'enviada' }])
      .select()
      .single()

    if (error) throw error
    await fetchSolicitudes()
    return data as OfertaColocacion
  }

  const aceptarOferta = async (oferta: OfertaColocacion) => {
    if (!user) throw new Error('Usuario no autenticado')

    // 1. Marcar oferta como aceptada
    const { error: e1 } = await supabase
      .from('ofertas_colocacion')
      .update({ estado: 'aceptada', updated_at: new Date().toISOString() })
      .eq('id', oferta.id)
    if (e1) throw e1

    // 2. Rechazar todas las demás ofertas de esa solicitud
    const { error: e2 } = await supabase
      .from('ofertas_colocacion')
      .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
      .eq('solicitud_id', oferta.solicitud_id)
      .neq('id', oferta.id)
      .eq('estado', 'enviada')
    if (e2) throw e2

    // 3. Cerrar la solicitud
    const { error: e3 } = await supabase
      .from('solicitudes_colocacion')
      .update({ estado: 'cerrada', updated_at: new Date().toISOString() })
      .eq('id', oferta.solicitud_id)
    if (e3) throw e3

    // 4. Crear Compromiso automáticamente
    const solicitud = solicitudes.find(s => s.id === oferta.solicitud_id)
    if (solicitud) {
      const fechaInicio = new Date()
      const fechaVencimiento = new Date(fechaInicio)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + solicitud.plazo)

      // Generar op_id
      const opId = `COL-${Date.now().toString(36).toUpperCase()}`

      const { error: e4 } = await supabase
        .from('compromisos')
        .insert([{
          op_id: opId,
          cliente_id: user.id,
          banco_id: oferta.banco_id,
          monto: oferta.monto,
          moneda: solicitud.moneda,
          tasa: oferta.tasa,
          plazo: solicitud.plazo,
          fecha_inicio: fechaInicio.toISOString(),
          fecha_vencimiento: fechaVencimiento.toISOString(),
          estado: 'vigente',
          notas: `Colocación directa. Solicitud: ${solicitud.id}`
        }])
      if (e4) throw e4
    }

    await fetchSolicitudes()
  }

  const rechazarOferta = async (ofertaId: string) => {
    const { error } = await supabase
      .from('ofertas_colocacion')
      .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
      .eq('id', ofertaId)
    if (error) throw error
    await fetchSolicitudes()
  }

  useEffect(() => {
    fetchSolicitudes()
  }, [user?.id])

  return {
    solicitudes,
    loading,
    crearSolicitud,
    cerrarSolicitud,
    cancelarSolicitud,
    enviarOferta,
    aceptarOferta,
    rechazarOferta,
    refetch: fetchSolicitudes
  }
}
