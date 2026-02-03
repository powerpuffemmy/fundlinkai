import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Compromiso } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

// Extender el tipo Compromiso para incluir los datos relacionados
interface CompromisoConDetalles extends Compromiso {
  banco?: {
    nombre: string
    entidad: string
    logo_url?: string
  }
  cliente?: {
    nombre: string
    entidad: string
  }
}

export const useCompromisos = () => {
  const [compromisos, setCompromisos] = useState<CompromisoConDetalles[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchCompromisos = async () => {
    try {
      setLoading(true)
      
      // ⭐ ACTUALIZADO: Ahora incluye datos del banco (con logo) y cliente
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

  useEffect(() => {
    fetchCompromisos()
  }, [])

  return {
    compromisos,
    loading,
    crearCompromiso,
    refetch: fetchCompromisos
  }
}
