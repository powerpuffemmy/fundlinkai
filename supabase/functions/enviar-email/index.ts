/**
 * FUNDLINK — Edge Function: enviar-email
 *
 * Envía emails transaccionales vía Resend.
 * Acepta `destinatario_id` (UUID) o `destinatario.email` directo.
 *
 * Secrets requeridos:
 *   supabase secrets set RESEND_API_KEY=re_xxxxx
 *   supabase secrets set SUPABASE_URL=https://xxx.supabase.co
 *   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * Deploy:
 *   supabase functions deploy enviar-email
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_EMAIL = 'FundLink <notificaciones@fundlink.app>'
const APP_URL    = 'https://app.fundlink.app'

// ── Tipos ────────────────────────────────────────────────────────────────────
type TipoNotificacion =
  // ── Subastas ──
  | 'nueva_oferta'                  // Banco envió oferta en subasta → cliente
  | 'oferta_adjudicada'             // Cliente adjudicó → banco ganador
  | 'subasta_cerrada'               // Subasta cerrada → cliente
  | 'nueva_subasta'                 // Nueva subasta disponible → bancos invitados
  // ── Colocaciones ──
  | 'oferta_colocacion_recibida'    // Banco envió oferta en colocación → cliente
  | 'oferta_pendiente_aprobacion'   // Banco mesa envió oferta → banco_admin para aprobar
  | 'oferta_aprobada_mesa'          // Banco admin aprobó oferta de mesa → banco_mesa
  | 'oferta_rechazada_mesa'         // Banco admin rechazó oferta de mesa → banco_mesa
  // ── Compromisos ──
  | 'compromiso_creado'             // Alias legacy
  | 'compromiso_confirmado'         // Compromiso creado/confirmado → cliente + banco
  | 'compromiso_ejecutado'          // Banco ejecutó (desembolsó) → cliente
  | 'compromiso_por_vencer'         // Alerta X días antes del vencimiento → cliente
  // ── KYC / Admin ──
  | 'documento_aprobado'
  | 'documento_rechazado'
  | 'cuenta_aprobada'

interface EmailRequest {
  tipo: TipoNotificacion
  /** UUID del usuario destinatario — la función busca su email automáticamente */
  destinatario_id?: string
  /** Alternativa: pasar email+nombre directamente */
  destinatario?: { email: string; nombre: string }
  datos: Record<string, unknown>
}

// ── Helpers de estilo ────────────────────────────────────────────────────────
const baseStyle = `
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; color: #1a1a2e; margin: 0; padding: 0; }
  .wrapper { background: #f4f6f9; padding: 32px 16px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; text-align: center; }
  .logo-text { font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -1px; }
  .logo-ai { color: #7dd3fc; }
  .badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-top: 12px; }
  .body { padding: 36px 32px; }
  h2 { margin: 0 0 8px; font-size: 22px; color: #0c4a6e; }
  p { margin: 0 0 16px; line-height: 1.7; color: #374151; }
  .card { background: #f0f9ff; border-left: 4px solid #38bdf8; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
  .card-warn { background: #fff7ed; border-left-color: #f59e0b; }
  .card-success { background: #f0fdf4; border-left-color: #22c55e; }
  .card-danger { background: #fef2f2; border-left-color: #ef4444; }
  .card p { margin: 6px 0; font-size: 15px; }
  .card .label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .value { font-size: 18px; font-weight: 700; color: #0c4a6e; }
  .big-number { font-size: 56px; font-weight: 900; text-align: center; padding: 16px 0; }
  .btn { display: inline-block; background: #0284c7; color: #ffffff !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 8px; }
  .footer { background: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb; }
  .footer p { font-size: 12px; color: #9ca3af; margin: 4px 0; }
`

const layout = (badge: string, badgeColor: string, inner: string) => `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>${baseStyle}</style></head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <div class="logo-text">FUNDLINK<span class="logo-ai">AI</span></div>
      <div class="badge" style="background:${badgeColor};color:#fff">${badge}</div>
    </div>
    <div class="body">${inner}</div>
    <div class="footer">
      <p>Este es un mensaje automático de FundLinkAI. Por favor no responder a este correo.</p>
      <p>© ${new Date().getFullYear()} FundLinkAI · Plataforma de Subastas Financieras</p>
    </div>
  </div>
</div>
</body>
</html>`

const btn = (url: string, label = 'Abrir Plataforma') =>
  `<p style="text-align:center;margin-top:28px"><a href="${url}" class="btn">${label}</a></p>`

// ── Plantillas ───────────────────────────────────────────────────────────────
const plantillas: Record<TipoNotificacion, (d: Record<string, unknown>) => { subject: string; html: string }> = {

  // ── SUBASTAS ────────────────────────────────────────────────────────────────

  nueva_oferta: (d) => ({
    subject: `💰 Nueva oferta recibida — ${d.monto} ${d.moneda} al ${d.tasa}%`,
    html: layout('NUEVA OFERTA', '#0284c7', `
      <h2>¡Recibiste una nueva oferta!</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, un banco ha enviado una propuesta en tu subasta:</p>
      <div class="card">
        <p><span class="label">Banco</span><br><span class="value">${d.banco_nombre}</span></p>
        <p><span class="label">Monto ofrecido</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}% anual</span></p>
        <p><span class="label">Plazo</span><br><span class="value">${d.plazo} días</span></p>
      </div>
      <p>Ingresa a la plataforma para comparar todas las ofertas y seleccionar la mejor opción.</p>
      ${btn(d.url_plataforma as string, 'Ver Ofertas')}
    `)
  }),

  oferta_adjudicada: (d) => ({
    subject: `🎉 ¡Tu oferta fue seleccionada! — ${d.op_id}`,
    html: layout('ADJUDICADO', '#22c55e', `
      <h2>¡Tu oferta fue seleccionada!</h2>
      <p>Hola <strong>${d.banco_nombre}</strong>, el cliente ha elegido tu propuesta:</p>
      <div class="card card-success">
        <p><span class="label">Operación</span><br><span class="value">${d.op_id}</span></p>
        <p><span class="label">Cliente</span><br><span class="value">${d.cliente_nombre}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}%</span></p>
        <p><span class="label">Vencimiento</span><br><span class="value">${d.fecha_vencimiento}</span></p>
      </div>
      <p>El compromiso ha sido registrado. Coordina el desembolso con el cliente.</p>
      ${btn(d.url_plataforma as string, 'Ver Compromiso')}
    `)
  }),

  subasta_cerrada: (d) => ({
    subject: `Subasta cerrada — ${d.monto} ${d.moneda}`,
    html: layout('SUBASTA CERRADA', '#6b7280', `
      <h2>Tu subasta ha cerrado</h2>
      <div class="card">
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Ofertas recibidas</span><br><span class="value">${d.total_ofertas}</span></p>
        <p><span class="label">Estado</span><br><span class="value">${d.estado}</span></p>
      </div>
      ${btn(d.url_plataforma as string, 'Ver Detalles')}
    `)
  }),

  nueva_subasta: (d) => ({
    subject: `🏦 Nueva oportunidad — ${d.monto} ${d.moneda} · ${d.plazo} días`,
    html: layout('NUEVA SUBASTA', '#3b82f6', `
      <h2>Nueva oportunidad de inversión</h2>
      <p>Hola <strong>${d.banco_nombre}</strong>, has sido invitado a participar:</p>
      <div class="card">
        <p><span class="label">Cliente</span><br><span class="value">${d.cliente_nombre}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Plazo</span><br><span class="value">${d.plazo} días</span></p>
        <p><span class="label">Tipo</span><br><span class="value">${d.tipo_subasta}</span></p>
        <p><span class="label">Cierra en</span><br><span class="value">${d.duracion} horas</span></p>
      </div>
      <p><strong>¡Envía tu oferta antes de que cierre!</strong></p>
      ${btn(d.url_plataforma as string, 'Participar Ahora')}
    `)
  }),

  // ── COLOCACIONES ────────────────────────────────────────────────────────────

  oferta_colocacion_recibida: (d) => ({
    subject: `💼 Nueva oferta de colocación — ${d.tasa}% · ${d.monto} ${d.moneda}`,
    html: layout('OFERTA DE COLOCACIÓN', '#0284c7', `
      <h2>Recibiste una oferta de colocación</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, un banco ha respondido a tu solicitud de colocación directa:</p>
      <div class="card">
        <p><span class="label">Banco</span><br><span class="value">${d.banco_nombre}</span></p>
        <p><span class="label">Monto propuesto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa en firme</span><br><span class="value">${d.tasa}% anual</span></p>
        <p><span class="label">Plazo</span><br><span class="value">${d.plazo} días</span></p>
        ${d.notas ? `<p><span class="label">Notas del banco</span><br>${d.notas}</p>` : ''}
      </div>
      <p>Ingresa a la plataforma para revisar y aceptar la oferta.</p>
      ${btn(d.url_plataforma as string, 'Ver Oferta')}
    `)
  }),

  oferta_pendiente_aprobacion: (d) => ({
    subject: `⏳ Oferta de colocación pendiente de aprobación`,
    html: layout('PENDIENTE APROBACIÓN', '#f59e0b', `
      <h2>Oferta de mesa pendiente de revisión</h2>
      <p>Un banco de mesa ha enviado una oferta que requiere tu aprobación:</p>
      <div class="card card-warn">
        <p><span class="label">Banco Mesa</span><br><span class="value">${d.banco_mesa_nombre}</span></p>
        <p><span class="label">Cliente</span><br><span class="value">${d.cliente_nombre}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa propuesta</span><br><span class="value">${d.tasa}%</span></p>
      </div>
      <p>Revisa y aprueba o rechaza la oferta en la sección de Aprobaciones.</p>
      ${btn(d.url_plataforma as string, 'Ir a Aprobaciones')}
    `)
  }),

  oferta_aprobada_mesa: (d) => ({
    subject: `✅ Tu oferta de colocación fue aprobada`,
    html: layout('OFERTA APROBADA', '#22c55e', `
      <h2>¡Tu oferta fue aprobada!</h2>
      <p>Hola <strong>${d.banco_mesa_nombre}</strong>, el administrador ha aprobado tu oferta de colocación. Ya es visible para el cliente.</p>
      <div class="card card-success">
        <p><span class="label">Cliente</span><br><span class="value">${d.cliente_nombre}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}%</span></p>
      </div>
      ${btn(d.url_plataforma as string, 'Ver Estado')}
    `)
  }),

  oferta_rechazada_mesa: (d) => ({
    subject: `❌ Tu oferta de colocación fue rechazada`,
    html: layout('OFERTA RECHAZADA', '#ef4444', `
      <h2>Tu oferta no fue aprobada</h2>
      <p>Hola <strong>${d.banco_mesa_nombre}</strong>, el administrador ha rechazado tu oferta de colocación.</p>
      <div class="card card-danger">
        <p><span class="label">Cliente</span><br><span class="value">${d.cliente_nombre}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa propuesta</span><br><span class="value">${d.tasa}%</span></p>
      </div>
      <p>Puedes enviar una nueva oferta ajustada si lo consideras conveniente.</p>
      ${btn(d.url_plataforma as string, 'Ver Colocaciones')}
    `)
  }),

  // ── COMPROMISOS ─────────────────────────────────────────────────────────────

  compromiso_creado: (d) => ({   // legacy alias
    subject: `📋 Compromiso registrado — ${d.op_id}`,
    html: layout('COMPROMISO CONFIRMADO', '#0284c7', `
      <h2>Compromiso registrado</h2>
      <p>Se ha generado un nuevo compromiso financiero en la plataforma:</p>
      <div class="card">
        <p><span class="label">Operación</span><br><span class="value">${d.op_id}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}% anual</span></p>
        <p><span class="label">Fecha inicio</span><br><span class="value">${d.fecha_inicio}</span></p>
        <p><span class="label">Fecha vencimiento</span><br><span class="value">${d.fecha_vencimiento}</span></p>
      </div>
      <p>Puedes descargar la Constancia de Intención de Colocación (PDF) desde la plataforma.</p>
      ${btn(d.url_plataforma as string, 'Ver Compromiso')}
    `)
  }),

  compromiso_confirmado: (d) => ({
    subject: `📋 Nuevo compromiso confirmado — ${d.op_id} · ${d.monto} ${d.moneda}`,
    html: layout('COMPROMISO CONFIRMADO', '#0284c7', `
      <h2>Compromiso confirmado</h2>
      <p>Hola <strong>${d.destinatario_nombre}</strong>, se ha confirmado el siguiente compromiso financiero:</p>
      <div class="card">
        <p><span class="label">Operación</span><br><span class="value">${d.op_id}</span></p>
        <p><span class="label">Contraparte</span><br><span class="value">${d.contraparte}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}% anual</span></p>
        <p><span class="label">Plazo</span><br><span class="value">${d.plazo} días</span></p>
        <p><span class="label">Fecha inicio</span><br><span class="value">${d.fecha_inicio}</span></p>
        <p><span class="label">Fecha vencimiento</span><br><span class="value">${d.fecha_vencimiento}</span></p>
      </div>
      <p>El contrato preliminar está disponible para descarga en la plataforma.</p>
      ${btn(d.url_plataforma as string, 'Ver Compromiso')}
    `)
  }),

  compromiso_ejecutado: (d) => ({
    subject: `✅ Desembolso confirmado — ${d.op_id}`,
    html: layout('DESEMBOLSO EJECUTADO', '#22c55e', `
      <h2>¡Desembolso confirmado!</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, el banco ha confirmado la ejecución (desembolso) del siguiente compromiso:</p>
      <div class="card card-success">
        <p><span class="label">Operación</span><br><span class="value">${d.op_id}</span></p>
        <p><span class="label">Banco</span><br><span class="value">${d.banco_nombre}</span></p>
        <p><span class="label">Monto desembolsado</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}%</span></p>
        <p><span class="label">Fecha ejecución</span><br><span class="value">${d.fecha_ejecucion}</span></p>
        <p><span class="label">Vencimiento</span><br><span class="value">${d.fecha_vencimiento}</span></p>
      </div>
      <p>Puedes descargar el Certificado de Ejecución desde la plataforma.</p>
      ${btn(d.url_plataforma as string, 'Ver Certificado')}
    `)
  }),

  compromiso_por_vencer: (d) => ({
    subject: `⚠️ Compromiso vence en ${d.dias_restantes} días — ${d.op_id}`,
    html: layout('PRÓXIMO A VENCER', '#f59e0b', `
      <h2>Aviso de Vencimiento</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, uno de tus compromisos está próximo a vencer:</p>
      <div class="big-number" style="color:#f59e0b">${d.dias_restantes}</div>
      <p style="text-align:center;color:#6b7280;margin-top:-12px">días restantes</p>
      <div class="card card-warn">
        <p><span class="label">Operación</span><br><span class="value">${d.op_id}</span></p>
        <p><span class="label">Banco</span><br><span class="value">${d.banco_nombre}</span></p>
        <p><span class="label">Monto</span><br><span class="value">${d.monto} ${d.moneda}</span></p>
        <p><span class="label">Tasa</span><br><span class="value">${d.tasa}%</span></p>
        <p><span class="label">Fecha vencimiento</span><br><span class="value">${d.fecha_vencimiento}</span></p>
      </div>
      <p>Recuerda coordinar con tu banco la renovación o liquidación.</p>
      ${btn(d.url_plataforma as string, 'Ver Calendario')}
    `)
  }),

  // ── KYC / ADMIN ─────────────────────────────────────────────────────────────

  documento_aprobado: (d) => ({
    subject: `✅ Documento aprobado — ${d.tipo_documento}`,
    html: layout('DOCUMENTO APROBADO', '#22c55e', `
      <h2>Documento aprobado</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, tu documento ha sido revisado y aprobado.</p>
      <div class="card card-success">
        <p><span class="label">Tipo de documento</span><br><span class="value">${d.tipo_documento}</span></p>
        <p><span class="label">Archivo</span><br>${d.nombre_archivo}</p>
        <p><span class="label">Fecha aprobación</span><br>${d.fecha_aprobacion}</p>
      </div>
      ${btn(d.url_plataforma as string, 'Ver Documentos')}
    `)
  }),

  documento_rechazado: (d) => ({
    subject: `❌ Documento requiere corrección — ${d.tipo_documento}`,
    html: layout('REQUIERE CORRECCIÓN', '#ef4444', `
      <h2>Documento con observaciones</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, tu documento ha sido revisado y requiere correcciones.</p>
      <div class="card card-danger">
        <p><span class="label">Documento</span><br><span class="value">${d.tipo_documento}</span></p>
        <p><span class="label">Motivo</span><br>${d.motivo_rechazo}</p>
      </div>
      <p>Por favor sube una versión corregida del documento.</p>
      ${btn(d.url_plataforma as string, 'Subir Documento')}
    `)
  }),

  cuenta_aprobada: (d) => ({
    subject: `🎉 ¡Bienvenido a FundLinkAI! Tu cuenta está activa`,
    html: layout('CUENTA APROBADA', '#0284c7', `
      <h2>¡Bienvenido a FundLinkAI!</h2>
      <p>Hola <strong>${d.cliente_nombre}</strong>, tu cuenta ha sido aprobada y ya puedes comenzar a operar.</p>
      <div class="card">
        <p>✔ Crear subastas de fondos</p>
        <p>✔ Recibir ofertas de bancos</p>
        <p>✔ Gestionar compromisos y vencimientos</p>
        <p>✔ Solicitar colocaciones directas</p>
      </div>
      ${btn(d.url_plataforma as string, 'Comenzar')}
    `)
  }),
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada')

    const body: EmailRequest = await req.json()
    const { tipo, datos, destinatario_id, destinatario: destinatarioDirecto } = body

    // Validar tipo
    if (!plantillas[tipo]) {
      return new Response(
        JSON.stringify({ error: `Tipo no válido: ${tipo}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resolver destinatario
    let email: string
    let nombre: string

    if (destinatario_id) {
      // Buscar usuario en Supabase usando service role
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('email, nombre, entidad')
        .eq('id', destinatario_id)
        .single()

      if (userError || !userData) {
        return new Response(
          JSON.stringify({ error: `Usuario no encontrado: ${destinatario_id}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      email  = userData.email
      nombre = userData.nombre || userData.entidad || 'Usuario'
    } else if (destinatarioDirecto?.email) {
      email  = destinatarioDirecto.email
      nombre = destinatarioDirecto.nombre || 'Usuario'
    } else {
      return new Response(
        JSON.stringify({ error: 'Se requiere destinatario_id o destinatario.email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generar email con datos completos
    const datosCompletos = {
      ...datos,
      destinatario_nombre: nombre,
      url_plataforma: (datos.url_plataforma as string) || APP_URL,
    }
    const { subject, html } = plantillas[tipo](datosCompletos)

    // Enviar vía Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html }),
    })

    const result = await resendRes.json()
    if (!resendRes.ok) {
      console.error('Resend error:', result)
      throw new Error(result.message || 'Error enviando email')
    }

    console.log(`[enviar-email] ✓ ${tipo} → ${email} (id: ${result.id})`)
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[enviar-email] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
