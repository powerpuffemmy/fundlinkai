import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Compromiso } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

export const useCompromisos = () => {
  const [compromisos, setCompromisos] = useState<Compromiso[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchCompromisos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('compromisos')
        .select('*')
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
        .select()
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