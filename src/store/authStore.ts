import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/database'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  login: async (email: string, password: string) => {
    try {
      // Intentar login con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('No se pudo obtener usuario')
      }

      // Obtener datos completos del usuario de la tabla users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authData.user.email)
        .single()

      if (userError) throw userError

      if (!userData) {
        throw new Error('Usuario no encontrado en la base de datos')
      }

      set({ user: userData, loading: false })
      return { success: true }

    } catch (error: any) {
      console.error('Error en login:', error)
      return { 
        success: false, 
        error: error.message || 'Error al iniciar sesión' 
      }
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut()
      set({ user: null })
    } catch (error) {
      console.error('Error en logout:', error)
    }
  },

  initialize: async () => {
    try {
      set({ loading: true })

      // Verificar si hay sesión activa
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Obtener datos del usuario de la tabla users
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single()

        if (error) throw error

        set({ user: userData, loading: false, initialized: true })
      } else {
        set({ user: null, loading: false, initialized: true })
      }

      // Escuchar cambios de autenticación
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .single()

          set({ user: userData })
        } else if (event === 'SIGNED_OUT') {
          set({ user: null })
        }
      })

    } catch (error) {
      console.error('Error inicializando auth:', error)
      set({ user: null, loading: false, initialized: true })
    }
  }
}))
