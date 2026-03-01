import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Compromiso, Moneda } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

// Extender el tipo Compromiso para incluir los datos relacionados
interface CompromisoConDetalles extends Compromiso {
  banco?: {
    nombre: string
    entidad: string
    logo_url?: string
  } | null
  cliente?: {
    nombre: string
    entidad: string
  }
}

interface DatosCompromisoExterno {
  contraparte_nombre: string
  monto: number
  moneda: Moneda
  tasa: number
  plazo: number
  fecha_inicio: string
  notas?: string
  documento_url?: string
}

export const useCompromisos = () => {
  const [compromisos, setCompromisos] = useState<CompromisoConDetalles[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchCompromisos = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('compromisos')
        .select(`
          *,
          banco:users!banco_id(nombre, entidad, logo_url),
          cliente:users!cliente_id(nombre, entidad)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCompromisos(data || [])
    } catch (error) {
      console.error('Error fetching compromisos:', error)
    } finally {
      setLoading(false)
    }
  }

  const crearCompromiso = async (compromiso: Omit<Compromiso, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const { data, error } = await supabase
        .from('compromisos')
        .insert([compromiso])
        .select(`
          *,
          banco:users!banco_id(nombre, entidad, logo_url),
          cliente:users!cliente_id(nombre, entidad)
        `)
        .single()

      if (error) throw error

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user.id,
        p_accion: 'Crear Compromiso',
        p_detalle: `Compromiso ${data.op_id} por ${compromiso.monto} ${compromiso.moneda}`,
        p_metadata: { compromiso_id: data.id }
      })

      await fetchCompromisos()
      return data
    } catch (error) {
      console.error('Error creating compromiso:', error)
      throw error
    }
  }

  const crearCompromisoExterno = async (datos: DatosCompromisoExterno) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const fechaInicio = new Date(datos.fecha_inicio)
      const fechaVencimiento = new Date(fechaInicio)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + datos.plazo)

      const { data, error } = await supabase
        .from('compromisos')
        .insert([{
          cliente_id: user.id,
          banco_id: null,
          es_externo: true,
          contraparte_nombre: datos.contraparte_nombre,
          monto: datos.monto,
          moneda: datos.moneda,
          tasa: datos.tasa,
          plazo: datos.plazo,
          fecha_inicio: fechaInicio.toISOString().split('T')[0],
          fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
          estado: 'vigente' as const,
          notas: datos.notas || null,
          documento_url: datos.documento_url || null,
        }])
        .select()
        .single()

      if (error) throw error

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user.id,
        p_accion: 'Crear Compromiso Externo',
        p_detalle: `Compromiso externo con ${datos.contraparte_nombre} por ${datos.monto} ${datos.moneda}`,
        p_metadata: { compromiso_id: data.id }
      })

      await fetchCompromisos()
      return data
    } catch (error) {
      console.error('Error creating compromiso externo:', error)
      throw error
    }
  }

  const actualizarCompromisoExterno = async (
    id: string,
    datos: Partial<DatosCompromisoExterno & { estado: string }>
  ) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const updateData: Record<string, any> = { ...datos }

      // Recalcular fecha_vencimiento si cambian fecha_inicio o plazo
      if (datos.fecha_inicio || datos.plazo) {
        const fechaInicio = new Date(datos.fecha_inicio || '')
        if (datos.plazo && !isNaN(fechaInicio.getTime())) {
          const fechaVencimiento = new Date(fechaInicio)
          fechaVencimiento.setDate(fechaVencimiento.getDate() + datos.plazo)
          updateData.fecha_vencimiento = fechaVencimiento.toISOString().split('T')[0]
          updateData.fecha_inicio = fechaInicio.toISOString().split('T')[0]
        }
      }

      const { error } = await supabase
        .from('compromisos')
        .update(updateData)
        .eq('id', id)
        .eq('es_externo', true)
        .eq('cliente_id', user.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user.id,
        p_accion: 'Actualizar Compromiso Externo',
        p_detalle: `Compromiso externo ${id} actualizado`,
        p_metadata: { compromiso_id: id, cambios: Object.keys(datos) }
      })

      await fetchCompromisos()
    } catch (error) {
      console.error('Error updating compromiso externo:', error)
      throw error
    }
  }

  const eliminarCompromisoExterno = async (id: string) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const { error } = await supabase
        .from('compromisos')
        .delete()
        .eq('id', id)
        .eq('es_externo', true)
        .eq('cliente_id', user.id)

      if (error) throw error

      await supabase.rpc('log_auditoria', {
        p_user_id: user.id,
        p_accion: 'Eliminar Compromiso Externo',
        p_detalle: `Compromiso externo ${id} eliminado`,
        p_metadata: { compromiso_id: id }
      })

      await fetchCompromisos()
    } catch (error) {
      console.error('Error deleting compromiso externo:', error)
      throw error
    }
  }

  const subirDocumentoCompromiso = async (archivo: File): Promise<string> => {
    if (!user) throw new Error('Usuario no autenticado')

    const fileExt = archivo.name.split('.').pop()
    const fileName = `${user.id}/compromiso_${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('compromisos-documentos')
      .upload(fileName, archivo)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('compromisos-documentos')
      .getPublicUrl(fileName)

    return publicUrl
  }

  useEffect(() => {
    fetchCompromisos()
  }, [])

  return {
    compromisos,
    loading,
    crearCompromiso,
    crearCompromisoExterno,
    actualizarCompromisoExterno,
    eliminarCompromisoExterno,
    subirDocumentoCompromiso,
    refetch: fetchCompromisos
  }
}
