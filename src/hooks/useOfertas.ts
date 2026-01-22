import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Oferta } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

export const useOfertas = (subastaId?: string) => {
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchOfertas = async () => {
    try {
      setLoading(true)
      let query = supabase.from('ofertas').select('*')
      
      if (subastaId) {
        query = query.eq('subasta_id', subastaId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setOfertas(data || [])
    } catch (error) {
      console.error('Error fetching ofertas:', error)
    } finally {
      setLoading(false)
    }
  }

  const crearOferta = async (oferta: Omit<Oferta, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const { data, error } = await supabase
        .from('ofertas')
        .insert([oferta])
        .select()
        .single()

      if (error) throw error

      // Log auditoría
      await supabase.rpc('log_auditoria', {
        p_user_id: user.id,
        p_accion: 'Crear Oferta',
        p_detalle: `Oferta a tasa ${oferta.tasa}%`,
        p_metadata: { oferta_id: data.id, subasta_id: oferta.subasta_id }
      })

      await fetchOfertas()
      return data
    } catch (error) {
      console.error('Error creating oferta:', error)
      throw error
    }
  }

  const actualizarOferta = async (id: string, updates: Partial<Oferta>) => {
    try {
      const { error } = await supabase
        .from('ofertas')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      await fetchOfertas()
    } catch (error) {
      console.error('Error updating oferta:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchOfertas()
  }, [subastaId])

  return {
    ofertas,
    loading,
    crearOferta,
    actualizarOferta,
    refetch: fetchOfertas
  }
}