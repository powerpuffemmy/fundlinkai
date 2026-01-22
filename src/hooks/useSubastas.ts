import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Subasta } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

export const useSubastas = () => {
  const [subastas, setSubastas] = useState<Subasta[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchSubastas = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('subastas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSubastas(data || [])
    } catch (error) {
      console.error('Error fetching subastas:', error)
    } finally {
      setLoading(false)
    }
  }

  const crearSubasta = async (subasta: Omit<Subasta, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const { data, error } = await supabase
        .from('subastas')
        .insert([subasta])
        .select()
        .single()

      if (error) throw error

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user.id,
        p_accion: 'Crear Subasta',
        p_detalle: `Subasta ${subasta.tipo} por ${subasta.monto} ${subasta.moneda}`,
        p_metadata: { subasta_id: data.id }
      })

      await fetchSubastas()
      return data
    } catch (error) {
      console.error('Error creating subasta:', error)
      throw error
    }
  }

  const actualizarSubasta = async (id: string, updates: Partial<Subasta>) => {
    try {
      const { error } = await supabase
        .from('subastas')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      await fetchSubastas()
    } catch (error) {
      console.error('Error updating subasta:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchSubastas()
  }, [])

  return {
    subastas,
    loading,
    crearSubasta,
    actualizarSubasta,
    refetch: fetchSubastas
  }
}