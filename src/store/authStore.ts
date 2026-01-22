import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/database'

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password?: string) => Promise<void>
  logout: () => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (email: string, password = 'demo123') => {
    set({ isLoading: true })
    try {
      // Buscar el usuario directamente en la tabla users por email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (userError) throw userError
      
      if (userData) {
        const user: User = {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          nombre: userData.nombre,
          entidad: userData.entidad,
          activo: userData.activo,
          created_at: userData.created_at,
          updated_at: userData.updated_at
        }
        set({ user, isLoading: false })
        
        // Guardar en localStorage
        localStorage.setItem('fundlink_user', JSON.stringify(user))
      } else {
        throw new Error('Credenciales inválidas')
      }
    } catch (error) {
      console.error('Error en login:', error)
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    set({ user: null })
    localStorage.removeItem('fundlink_user')
  },

  setUser: (user: User | null) => {
    set({ user })
    if (user) {
      localStorage.setItem('fundlink_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('fundlink_user')
    }
  }
}))

// Restaurar sesión desde localStorage al cargar
const savedUser = localStorage.getItem('fundlink_user')
if (savedUser) {
  try {
    const user = JSON.parse(savedUser)
    useAuthStore.setState({ user })
  } catch (error) {
    console.error('Error al restaurar sesión:', error)
    localStorage.removeItem('fundlink_user')
  }
}