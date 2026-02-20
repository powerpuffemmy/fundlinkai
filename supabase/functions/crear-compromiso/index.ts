/**
 * FUNDLINK: Edge Function para Crear Compromiso Manual
 *
 * Esta función permite a WebAdmin crear compromisos manualmente:
 * 1. Valida que el usuario es WebAdmin
 * 2. Valida todos los datos del compromiso
 * 3. Verifica límites del banco con el cliente
 * 4. Crea el compromiso
 * 5. Actualiza el límite utilizado
 *
 * Deploy: supabase functions deploy crear-compromiso
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CrearCompromisoRequest {
  cliente_id: string
  banco_id: string
  monto: number
  moneda: 'USD' | 'GTQ'
  tasa: number
  plazo: number
  fecha_inicio: string
  notas?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar autorización
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Obtener usuario y verificar rol
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que es WebAdmin
    const { data: userData, error: roleError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || userData?.role !== 'webadmin') {
      return new Response(
        JSON.stringify({ error: 'Solo WebAdmin puede crear compromisos manualmente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Parsear y validar body
    const body: CrearCompromisoRequest = await req.json()

    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(body.cliente_id) || !uuidRegex.test(body.banco_id)) {
      return new Response(
        JSON.stringify({ error: 'IDs de cliente o banco inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar monto
    if (typeof body.monto !== 'number' || body.monto <= 0 || body.monto > 100_000_000) {
      return new Response(
        JSON.stringify({ error: 'Monto inválido (debe ser entre 0 y 100M)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar moneda
    if (!['USD', 'GTQ'].includes(body.moneda)) {
      return new Response(
        JSON.stringify({ error: 'Moneda debe ser USD o GTQ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar tasa
    if (typeof body.tasa !== 'number' || body.tasa <= 0 || body.tasa > 50) {
      return new Response(
        JSON.stringify({ error: 'Tasa inválida (debe ser entre 0% y 50%)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar plazo
    if (typeof body.plazo !== 'number' || body.plazo < 1 || body.plazo > 365) {
      return new Response(
        JSON.stringify({ error: 'Plazo inválido (debe ser entre 1 y 365 días)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar fecha inicio
    const fechaInicio = new Date(body.fecha_inicio)
    if (isNaN(fechaInicio.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Fecha de inicio inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Cliente admin para operaciones privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5. Verificar que cliente y banco existen
    const { data: cliente } = await supabaseAdmin
      .from('users')
      .select('id, nombre, entidad, role')
      .eq('id', body.cliente_id)
      .eq('role', 'cliente')
      .single()

    if (!cliente) {
      return new Response(
        JSON.stringify({ error: 'Cliente no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: banco } = await supabaseAdmin
      .from('users')
      .select('id, nombre, entidad, role')
      .eq('id', body.banco_id)
      .in('role', ['banco_admin', 'banco_mesa', 'banco_auditor'])
      .single()

    if (!banco) {
      return new Response(
        JSON.stringify({ error: 'Banco no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Verificar límite disponible
    const { data: limite } = await supabaseAdmin
      .from('cliente_banco_limites')
      .select('*')
      .eq('cliente_id', body.cliente_id)
      .eq('banco_id', body.banco_id)
      .eq('activo', true)
      .single()

    if (!limite) {
      return new Response(
        JSON.stringify({ error: 'No existe línea de crédito activa entre este cliente y banco' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const disponible = limite.limite_monto - limite.monto_utilizado
    if (body.monto > disponible) {
      return new Response(
        JSON.stringify({
          error: `Límite insuficiente. Disponible: ${disponible.toLocaleString()}, Solicitado: ${body.monto.toLocaleString()}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Calcular fecha de vencimiento
    const fechaVencimiento = new Date(fechaInicio)
    fechaVencimiento.setDate(fechaVencimiento.getDate() + body.plazo)

    // 8. Generar OP-ID único
    const opId = 'OP-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    // 9. Crear compromiso
    const { data: compromiso, error: compromisoError } = await supabaseAdmin
      .from('compromisos')
      .insert({
        op_id: opId,
        cliente_id: body.cliente_id,
        banco_id: body.banco_id,
        monto: body.monto,
        moneda: body.moneda,
        tasa: body.tasa,
        plazo: body.plazo,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
        estado: 'vigente',
        notas: body.notas || `Creado manualmente por WebAdmin`
      })
      .select()
      .single()

    if (compromisoError) {
      throw new Error('Error creando compromiso: ' + compromisoError.message)
    }

    // 10. Log de auditoría
    await supabaseAdmin
      .from('auditoria')
      .insert({
        user_id: user.id,
        user_email: user.email,
        user_role: 'webadmin',
        accion: 'CREAR_COMPROMISO_MANUAL',
        detalle: `Compromiso ${opId} creado manualmente`,
        metadata: {
          compromiso_id: compromiso.id,
          op_id: opId,
          cliente_id: body.cliente_id,
          banco_id: body.banco_id,
          monto: body.monto,
          tasa: body.tasa
        }
      })

    // 11. Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Compromiso creado exitosamente',
        compromiso: {
          id: compromiso.id,
          op_id: opId,
          cliente: cliente.entidad,
          banco: banco.entidad,
          monto: body.monto,
          moneda: body.moneda,
          tasa: body.tasa,
          fecha_inicio: fechaInicio.toISOString().split('T')[0],
          fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0]
        }
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error en crear-compromiso:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
