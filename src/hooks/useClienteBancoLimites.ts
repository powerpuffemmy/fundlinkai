import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClienteBancoLimite } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

interface BancoConLimite extends ClienteBancoLimite {
  banco_nombre?: string
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
      // Usar RPC con SECURITY DEFINER para traer nombres del catálogo de bancos
      // (el join directo a bancos falla por RLS para el rol cliente)
      const { data, error } = await supabase
        .rpc('obtener_limites_cliente', { p_cliente_id: user.id })
      if (error) throw error
      setLimites((data || []) as BancoConLimite[])
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

  // ── Fallback: construir BancoDisponible[] desde cliente_banco_limites ───────
  const _fallbackLimitesDirectos = async (): Promise<BancoDisponible[]> => {
    if (!user) return []
    try {
      const { data, error } = await supabase
        .from('cliente_banco_limites')
        .select('banco_id, limite_monto, monto_utilizado, activo, banco:users!banco_id(id, nombre, entidad)')
        .eq('cliente_id', user.id)
        .eq('activo', true)

      if (error || !data || data.length === 0) {
        // Último recurso: todos los banco_admin activos
        const { data: bancosData } = await supabase
          .from('users')
          .select('id, nombre, entidad')
          .eq('role', 'banco_admin')
          .eq('activo', true)
        return (bancosData || []).map((b: any) => ({
          banco_id: b.id,
          banco_nombre: b.entidad || b.nombre || b.id,
          banco_entidad: b.entidad || '',
          limite_monto: 0,
          monto_utilizado: 0,
          monto_disponible: 0,
          todos_user_ids: [b.id],
        }))
      }

      return (data || []).map((l: any) => ({
        banco_id: l.banco_id,
        banco_nombre: (l.banco as any)?.entidad || (l.banco as any)?.nombre || l.banco_id,
        banco_entidad: (l.banco as any)?.entidad || '',
        limite_monto: l.limite_monto ?? 0,
        monto_utilizado: l.monto_utilizado ?? 0,
        monto_disponible: (l.limite_monto ?? 0) - (l.monto_utilizado ?? 0),
        todos_user_ids: [l.banco_id],
      }))
    } catch {
      return []
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

      // Si el RPC funciona y devuelve datos, usarlos
      if (!error && data && data.length > 0) return data as BancoDisponible[]

      // Fallback: consulta directa, filtrar client-side por monto disponible
      const todos = await _fallbackLimitesDirectos()
      return todos.filter(b => b.monto_disponible >= monto || b.limite_monto === 0)
    } catch (error) {
      console.error('Error obteniendo bancos disponibles:', error)
      return _fallbackLimitesDirectos()
    }
  }

  // Obtener todos los bancos activos del cliente
  const obtenerTodosBancos = async (): Promise<BancoDisponible[]> => {
    try {
      const { data, error } = await supabase
        .rpc('obtener_todos_bancos')

      // RPC returns { id, nombre, entidad } — map to BancoDisponible shape
      if (!error && data && data.length > 0) {
        return (data as any[]).map(b => ({
          banco_id: b.id,
          banco_nombre: b.nombre,
          banco_entidad: b.entidad || b.nombre,
          limite_monto: 0,
          monto_utilizado: 0,
          monto_disponible: 0,
          todos_user_ids: [b.id],
        }))
      }

      // Fallback: consulta directa
      return _fallbackLimitesDirectos()
    } catch (error) {
      console.error('Error obteniendo bancos:', error)
      return _fallbackLimitesDirectos()
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
