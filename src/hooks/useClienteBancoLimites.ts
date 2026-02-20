import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClienteBancoLimite } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

interface BancoConLimite extends ClienteBancoLimite {
  banco_nombre?: string
  banco_entidad?: string
}

interface BancoDisponible {
  banco_id: string
  banco_nombre: string
  banco_entidad: string
  limite_monto: number
  monto_utilizado: number
  monto_disponible: number
  todos_user_ids: string[]
}

export const useClienteBancoLimites = () => {
  const [limites, setLimites] = useState<BancoConLimite[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchLimites = async () => {
    try {
      setLoading(true)
      
      if (!user) return

      const { data, error } = await supabase
        .from('cliente_banco_limites')
        .select(`
          *,
          banco:users!banco_id(nombre, entidad)
        `)
        .eq('cliente_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const limitesConBanco = (data || []).map(limite => ({
        ...limite,
        banco_nombre: limite.banco?.nombre,
        banco_entidad: limite.banco?.entidad
      }))

      setLimites(limitesConBanco)
    } catch (error) {
      console.error('Error fetching limites:', error)
    } finally {
      setLoading(false)
    }
  }

  const crearLimite = async (limite: Omit<ClienteBancoLimite, 'id' | 'created_at' | 'updated_at' | 'monto_utilizado'>) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      const { data, error } = await supabase
        .from('cliente_banco_limites')
        .insert([{
          ...limite,
          monto_utilizado: 0
        }])
        .select()
        .single()

      if (error) throw error

      await fetchLimites()
      return data
    } catch (error) {
      console.error('Error creating limite:', error)
      throw error
    }
  }

  const actualizarLimite = async (id: string, updates: Partial<ClienteBancoLimite>) => {
    try {
      const { error } = await supabase
        .from('cliente_banco_limites')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      await fetchLimites()
    } catch (error) {
      console.error('Error updating limite:', error)
      throw error
    }
  }

  const eliminarLimite = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cliente_banco_limites')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchLimites()
    } catch (error) {
      console.error('Error deleting limite:', error)
      throw error
    }
  }

  // Obtener bancos disponibles para un monto específico
  const obtenerBancosDisponibles = async (monto: number): Promise<BancoDisponible[]> => {
    try {
      if (!user) return []

      const { data, error } = await supabase
        .rpc('obtener_bancos_disponibles', {
          p_cliente_id: user.id,
          p_monto: monto
        })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error obteniendo bancos disponibles:', error)
      return []
    }
  }

  // Obtener todos los bancos activos (para configuración inicial)
  const obtenerTodosBancos = async () => {
    try {
      const { data, error } = await supabase
        .rpc('obtener_todos_bancos')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error obteniendo bancos:', error)
      return []
    }
  }

  useEffect(() => {
    fetchLimites()
  }, [user?.id])

  return {
    limites,
    loading,
    crearLimite,
    actualizarLimite,
    eliminarLimite,
    obtenerBancosDisponibles,
    obtenerTodosBancos,
    refetch: fetchLimites
  }
}
