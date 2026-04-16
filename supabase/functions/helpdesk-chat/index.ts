/**
 * FUNDLINK — Edge Function: helpdesk-chat
 *
 * Recibe mensajes del chat de Help Desk y responde usando Claude (Anthropic).
 * Requiere autenticación de usuario FundLink.
 *
 * Secrets requeridos:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
 *
 * Deploy:
 *   supabase functions deploy helpdesk-chat
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Eres el asistente de soporte de FundLink, una plataforma guatemalteca de intermediación financiera que conecta clientes corporativos con bancos para operaciones de colocación de excedentes de liquidez y subastas de tasas de interés.

Tu rol es ayudar a los usuarios con:
- Cómo usar la plataforma (navegación, funcionalidades)
- Procesos de solicitudes de colocación y subastas
- Compromisos y vencimientos de inversiones
- Gestión de ofertas bancarias (para usuarios banco)
- Aprobaciones y flujos de trabajo
- Preguntas sobre tasas (Tasa Cierre y Tasa Objetivo)
- Onboarding y configuración de cuentas

Conceptos clave de FundLink:
- Solicitud de Colocación: el cliente publica cuánto dinero desea colocar, por cuánto tiempo y a qué tasa objetivo
- Tasa Objetivo (antes Tasa Indicativa): tasa referencial que el cliente espera obtener
- Tasa Cierre (antes Tasa en Firme): tasa definitiva comprometida por el banco en su oferta
- Subasta: mecanismo donde múltiples bancos compiten con sus tasas
- Compromiso: acuerdo final entre cliente y banco después de aceptar una oferta
- Roles: cliente_admin, cliente_usuario, banco_admin, banco_mesa, banco_auditor, webadmin

Responde siempre en español. Sé conciso, claro y profesional. Si no sabes algo específico sobre la plataforma, indica al usuario que contacte a soporte@fundlink.gt.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { messages, userRole } = await req.json()
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Mensajes requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'Servicio de chat no configurado' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Agregar contexto de rol al system prompt
    const roleContext = userRole
      ? `\n\nEl usuario actual tiene el rol: ${userRole}.`
      : ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT + roleContext,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Anthropic API error:', response.status, errBody)
      return new Response(JSON.stringify({ error: 'Error al contactar el servicio de IA' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text ?? 'No pude generar una respuesta.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('helpdesk-chat error:', err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
