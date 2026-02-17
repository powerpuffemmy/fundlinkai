/**
 * FUNDLINK: Edge Function para Crear Usuario
 *
 * 1. Verifica que quien llama es webadmin
 * 2. Crea el usuario en auth.users (Admin API) → obtiene UUID real
 * 3. Inserta en public.users con ese mismo UUID
 *
 * Deploy: supabase functions deploy create-auth-user
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar que quien llama es webadmin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      throw new Error('No autorizado')
    }

    // Verificar rol usando id (no email) para evitar el bug de desync
    const { data: callerData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerData?.role !== 'webadmin') {
      throw new Error('Solo webadmins pueden crear usuarios')
    }

    // Obtener datos del body
    const { email, password, nombre, entidad, role, activo } = await req.json()

    if (!email || !password || !nombre || !entidad || !role) {
      throw new Error('Faltan campos requeridos: email, password, nombre, entidad, role')
    }

    // Crear usuario en auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, entidad, role }
    })

    if (authError) throw authError

    const authId = authData.user.id

    // Insertar en public.users con el UUID real de auth
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authId,
        email,
        nombre,
        entidad,
        role,
        activo: activo ?? true,
        primer_login: true,
      })
      .select()
      .single()

    if (insertError) {
      // Rollback: eliminar de auth si falla la inserción en public.users
      await supabaseAdmin.auth.admin.deleteUser(authId)
      throw new Error('Error en public.users: ' + insertError.message)
    }

    // Log de auditoría
    await supabaseAdmin
      .from('auditoria')
      .insert({
        user_id: user.id,
        user_email: user.email,
        user_role: 'webadmin',
        accion: 'CREAR_USUARIO',
        detalle: `Usuario ${email} creado con rol ${role}`,
        metadata: { nuevo_user_id: authId, email, role }
      })

    return new Response(
      JSON.stringify({ success: true, user: newUser }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
