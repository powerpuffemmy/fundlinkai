import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Oferta } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

// Extender el tipo Oferta para incluir datos de la subasta y cliente
interface OfertaConDetalles extends Oferta {
  subasta?: {
    monto: number
    moneda: string
    plazo: number
    tipo: string
    cliente_id: string
  }
  cliente?: {
    nombre: string
    entidad: string
  }
}

export const useOfertas = (subastaId?: string) => {
  const [ofertas, setOfertas] = useState<OfertaConDetalles[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchOfertas = async () => {
    try {
      setLoading(true)
      
      // ⭐ ACTUALIZADO: Ahora incluye datos de la subasta y del cliente
      let query = supabase
        .from('ofertas')
        .select(`
          *,
          subasta:subastas!subasta_id(monto, moneda, plazo, tipo, cliente_id),
          cliente:subastas!subasta_id(cliente:users!cliente_id(nombre, entidad))
        `)
      
      if (subastaId) {
        query = query.eq('subasta_id', subastaId)
      }

      // Si es un banco, solo mostrar sus ofertas
      if (user?.role.startsWith('banco')) {
        query = query.eq('banco_id', user.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      // Aplanar la estructura del cliente (viene anidado)
      const ofertasConDetalles = (data || []).map(oferta => ({
        ...oferta,
        cliente: oferta.cliente?.cliente
      }))
      
      setOfertas(ofertasConDetalles)
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
