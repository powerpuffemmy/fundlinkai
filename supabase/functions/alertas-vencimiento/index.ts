/**
 * FUNDLINK — Edge Function: alertas-vencimiento
 *
 * Envía alertas de vencimiento a clientes con compromisos que vencen en 7 y 30 días.
 * Diseñada para ejecutarse diariamente a las 8:00 AM (GT, UTC-6 = 14:00 UTC).
 *
 * Schedule en migration 014:
 *   SELECT cron.schedule('fundlink-alertas-vencimiento', '0 14 * * *', $$
 *     SELECT net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/alertas-vencimiento',
 *       headers := '{"Authorization":"Bearer <ANON_KEY>","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     )
 *   $$);
 *
 * Deploy: supabase functions deploy alertas-vencimiento
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const hoy     = new Date()
    hoy.setHours(0, 0, 0, 0)

    const en7  = new Date(hoy); en7.setDate(en7.getDate() + 7)
    const en30 = new Date(hoy); en30.setDate(en30.getDate() + 30)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    // Compromisos activos con cliente y banco
    const { data: compromisos, error } = await supabaseAdmin
      .from('compromisos')
      .select(`
        id, op_id, monto, moneda, tasa, fecha_vencimiento,
        cliente_id,
        cliente:users!cliente_id(nombre, entidad, email),
        banco:users!banco_id(nombre, entidad)
      `)
      .in('estado', ['vigente', 'confirmado', 'ejecutado'])
      .eq('es_externo', false)  // Solo compromisos FundLink

    if (error) throw error

    const edgeUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace('/rest/v1', '') + '/functions/v1/enviar-email'
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    }

    let enviados7  = 0
    let enviados30 = 0

    for (const comp of (compromisos || [])) {
      const fv = comp.fecha_vencimiento.split('T')[0]
      const clienteNombre = (comp.cliente as any)?.entidad || (comp.cliente as any)?.nombre || 'Cliente'
      const bancoNombre   = (comp.banco as any)?.entidad  || (comp.banco as any)?.nombre   || 'Banco'

      const diasRestantes = Math.round(
        (new Date(fv).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      )

      const datos = {
        cliente_nombre: clienteNombre,
        banco_nombre: bancoNombre,
        op_id: comp.op_id,
        monto: comp.monto,
        moneda: comp.moneda,
        tasa: comp.tasa,
        dias_restantes: diasRestantes,
        fecha_vencimiento: fv,
      }

      // Alerta 7 días
      if (fv === fmt(en7)) {
        await fetch(edgeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tipo: 'compromiso_por_vencer', destinatario_id: comp.cliente_id, datos }),
        }).catch(e => console.error('Error alerta 7d:', e))
        enviados7++
      }

      // Alerta 30 días
      if (fv === fmt(en30)) {
        await fetch(edgeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tipo: 'compromiso_por_vencer', destinatario_id: comp.cliente_id, datos }),
        }).catch(e => console.error('Error alerta 30d:', e))
        enviados30++
      }
    }

    console.log(`[alertas-vencimiento] Enviadas: ${enviados7} alertas a 7 días, ${enviados30} alertas a 30 días`)

    return new Response(
      JSON.stringify({ success: true, enviados7, enviados30, total: (compromisos || []).length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[alertas-vencimiento] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
