/**
 * FUNDLINK: Edge Function para Envío de Emails
 *
 * Usa Resend para enviar emails transaccionales.
 * Soporta múltiples tipos de notificaciones.
 *
 * Configurar en Supabase:
 * supabase secrets set RESEND_API_KEY=re_xxxxx
 *
 * Deploy: supabase functions deploy enviar-email
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tipos de notificación soportados
type TipoNotificacion =
  | 'nueva_oferta'           // Banco envió oferta → notificar cliente
  | 'oferta_adjudicada'      // Cliente adjudicó → notificar banco
  | 'subasta_cerrada'        // Subasta cerró → notificar participantes
  | 'compromiso_creado'      // Nuevo compromiso → notificar ambas partes
  | 'compromiso_por_vencer'  // Vence en X días → notificar cliente
  | 'nueva_subasta'          // Nueva subasta → notificar bancos invitados
  | 'documento_aprobado'     // KYC aprobado → notificar cliente
  | 'documento_rechazado'    // KYC rechazado → notificar cliente
  | 'cuenta_aprobada'        // Cuenta aprobada → notificar cliente

interface EmailRequest {
  tipo: TipoNotificacion
  destinatario: {
    email: string
    nombre: string
  }
  datos: Record<string, unknown>
}

// Plantillas de email
const plantillas: Record<TipoNotificacion, (datos: Record<string, unknown>) => { subject: string; html: string }> = {

  nueva_oferta: (datos) => ({
    subject: `Nueva oferta recibida - ${datos.monto} ${datos.moneda}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .content { line-height: 1.6; }
          .highlight { background: #1a1a3e; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00d4ff; }
          .value { font-size: 24px; font-weight: bold; color: #00ff88; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
          </div>
          <div class="content">
            <h2>¡Nueva oferta recibida!</h2>
            <p>Hola ${datos.cliente_nombre},</p>
            <p>Has recibido una nueva oferta en tu subasta:</p>

            <div class="highlight">
              <p><strong>Banco:</strong> ${datos.banco_nombre}</p>
              <p><strong>Monto:</strong> ${datos.monto} ${datos.moneda}</p>
              <p><strong>Tasa ofrecida:</strong> <span class="value">${datos.tasa}%</span></p>
              <p><strong>Plazo:</strong> ${datos.plazo} días</p>
            </div>

            <p>Ingresa a la plataforma para revisar todas las ofertas y adjudicar.</p>

            <a href="${datos.url_plataforma}" class="button">Ver Ofertas</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink. No responder a este correo.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  oferta_adjudicada: (datos) => ({
    subject: `¡Felicidades! Tu oferta fue adjudicada - OP-${datos.op_id}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .success-badge { background: #00ff88; color: #000; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; }
          .highlight { background: #1a1a3e; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00ff88; }
          .value { font-size: 24px; font-weight: bold; color: #00ff88; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
            <div class="success-badge">ADJUDICADO</div>
          </div>
          <div class="content">
            <h2>¡Tu oferta fue adjudicada!</h2>
            <p>Hola ${datos.banco_nombre},</p>
            <p>Excelentes noticias. Tu oferta ha sido seleccionada por el cliente.</p>

            <div class="highlight">
              <p><strong>Operación:</strong> OP-${datos.op_id}</p>
              <p><strong>Cliente:</strong> ${datos.cliente_nombre}</p>
              <p><strong>Monto:</strong> ${datos.monto} ${datos.moneda}</p>
              <p><strong>Tasa:</strong> <span class="value">${datos.tasa}%</span></p>
              <p><strong>Vencimiento:</strong> ${datos.fecha_vencimiento}</p>
            </div>

            <p>El compromiso ha sido registrado en la plataforma.</p>

            <a href="${datos.url_plataforma}" class="button">Ver Compromiso</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink. No responder a este correo.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  subasta_cerrada: (datos) => ({
    subject: `Subasta cerrada - ${datos.monto} ${datos.moneda}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .highlight { background: #1a1a3e; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
          </div>
          <div class="content">
            <h2>Subasta Cerrada</h2>
            <p>La subasta ha finalizado.</p>

            <div class="highlight">
              <p><strong>Monto:</strong> ${datos.monto} ${datos.moneda}</p>
              <p><strong>Total ofertas:</strong> ${datos.total_ofertas}</p>
              <p><strong>Estado:</strong> ${datos.estado}</p>
            </div>

            <a href="${datos.url_plataforma}" class="button">Ver Detalles</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  compromiso_creado: (datos) => ({
    subject: `Nuevo compromiso registrado - OP-${datos.op_id}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .highlight { background: #1a1a3e; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00d4ff; }
          .value { font-size: 20px; font-weight: bold; color: #00ff88; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
          </div>
          <div class="content">
            <h2>Compromiso Registrado</h2>
            <p>Se ha creado un nuevo compromiso financiero.</p>

            <div class="highlight">
              <p><strong>Operación:</strong> <span class="value">OP-${datos.op_id}</span></p>
              <p><strong>Monto:</strong> ${datos.monto} ${datos.moneda}</p>
              <p><strong>Tasa:</strong> ${datos.tasa}%</p>
              <p><strong>Fecha inicio:</strong> ${datos.fecha_inicio}</p>
              <p><strong>Fecha vencimiento:</strong> ${datos.fecha_vencimiento}</p>
            </div>

            <p>Puedes descargar el contrato PDF desde la plataforma.</p>

            <a href="${datos.url_plataforma}" class="button">Ver Compromiso</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  compromiso_por_vencer: (datos) => ({
    subject: `⚠️ Compromiso por vencer en ${datos.dias_restantes} días - OP-${datos.op_id}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .warning { background: #ff6b35; color: #000; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; }
          .highlight { background: #3a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff6b35; }
          .days { font-size: 48px; font-weight: bold; color: #ff6b35; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
            <div class="warning">PRÓXIMO A VENCER</div>
          </div>
          <div class="content">
            <h2>Compromiso por Vencer</h2>

            <div class="highlight" style="text-align: center;">
              <div class="days">${datos.dias_restantes}</div>
              <p>días restantes</p>
            </div>

            <p><strong>Operación:</strong> OP-${datos.op_id}</p>
            <p><strong>Banco:</strong> ${datos.banco_nombre}</p>
            <p><strong>Monto:</strong> ${datos.monto} ${datos.moneda}</p>
            <p><strong>Fecha vencimiento:</strong> ${datos.fecha_vencimiento}</p>

            <p>Recuerda coordinar la renovación o liquidación con tu banco.</p>

            <a href="${datos.url_plataforma}" class="button">Ver Compromiso</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  nueva_subasta: (datos) => ({
    subject: `Nueva oportunidad de inversión - ${datos.monto} ${datos.moneda}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .new-badge { background: #00d4ff; color: #000; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; }
          .highlight { background: #1a1a3e; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00d4ff; }
          .value { font-size: 24px; font-weight: bold; color: #00ff88; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .timer { background: #ff6b35; color: #000; padding: 5px 15px; border-radius: 4px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
            <div class="new-badge">NUEVA SUBASTA</div>
          </div>
          <div class="content">
            <h2>Nueva Oportunidad de Inversión</h2>
            <p>Hola ${datos.banco_nombre},</p>
            <p>Has sido invitado a participar en una nueva subasta:</p>

            <div class="highlight">
              <p><strong>Cliente:</strong> ${datos.cliente_nombre}</p>
              <p><strong>Monto:</strong> <span class="value">${datos.monto} ${datos.moneda}</span></p>
              <p><strong>Plazo:</strong> ${datos.plazo} días</p>
              <p><strong>Tipo:</strong> ${datos.tipo_subasta}</p>
              <p><strong>Cierra en:</strong> <span class="timer">${datos.duracion} horas</span></p>
            </div>

            <p>¡No pierdas esta oportunidad! Envía tu oferta antes de que cierre.</p>

            <a href="${datos.url_plataforma}" class="button">Participar Ahora</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  documento_aprobado: (datos) => ({
    subject: `✅ Documento aprobado - ${datos.tipo_documento}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .success { background: #00ff88; color: #000; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; }
          .highlight { background: #1a3a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00ff88; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
            <div class="success">APROBADO</div>
          </div>
          <div class="content">
            <h2>Documento Aprobado</h2>
            <p>Hola ${datos.cliente_nombre},</p>
            <p>Tu documento ha sido revisado y aprobado.</p>

            <div class="highlight">
              <p><strong>Documento:</strong> ${datos.tipo_documento}</p>
              <p><strong>Archivo:</strong> ${datos.nombre_archivo}</p>
              <p><strong>Fecha aprobación:</strong> ${datos.fecha_aprobacion}</p>
            </div>

            <a href="${datos.url_plataforma}" class="button">Ver Documentos</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  documento_rechazado: (datos) => ({
    subject: `❌ Documento requiere corrección - ${datos.tipo_documento}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .rejected { background: #ff4444; color: #fff; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; }
          .highlight { background: #3a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff4444; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
            <div class="rejected">REQUIERE CORRECCIÓN</div>
          </div>
          <div class="content">
            <h2>Documento Rechazado</h2>
            <p>Hola ${datos.cliente_nombre},</p>
            <p>Tu documento ha sido revisado y requiere correcciones.</p>

            <div class="highlight">
              <p><strong>Documento:</strong> ${datos.tipo_documento}</p>
              <p><strong>Motivo:</strong> ${datos.motivo_rechazo}</p>
            </div>

            <p>Por favor, sube un nuevo documento corregido.</p>

            <a href="${datos.url_plataforma}" class="button">Subir Documento</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  cuenta_aprobada: (datos) => ({
    subject: `🎉 ¡Bienvenido a FundLink! Tu cuenta ha sido aprobada`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #12122a; border-radius: 12px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00d4ff; }
          .welcome { font-size: 48px; margin: 20px 0; }
          .highlight { background: #1a1a3e; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #00d4ff; color: #000; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FundLink</div>
            <div class="welcome">🎉</div>
          </div>
          <div class="content">
            <h2>¡Bienvenido a FundLink!</h2>
            <p>Hola ${datos.cliente_nombre},</p>
            <p>Tu cuenta ha sido aprobada. Ya puedes comenzar a crear subastas y recibir ofertas de financiamiento.</p>

            <div class="highlight">
              <h3>¿Qué puedes hacer ahora?</h3>
              <ul>
                <li>Crear tu primera subasta</li>
                <li>Configurar tus bancos preferidos</li>
                <li>Subir documentos adicionales</li>
              </ul>
            </div>

            <a href="${datos.url_plataforma}" class="button">Comenzar</a>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de FundLink.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no configurada')
    }

    const { tipo, destinatario, datos }: EmailRequest = await req.json()

    // Validar tipo de notificación
    if (!plantillas[tipo]) {
      return new Response(
        JSON.stringify({ error: `Tipo de notificación no válido: ${tipo}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar destinatario
    if (!destinatario?.email) {
      return new Response(
        JSON.stringify({ error: 'Email de destinatario requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Agregar URL de plataforma por defecto
    const datosCompletos = {
      ...datos,
      url_plataforma: datos.url_plataforma || 'https://fundlink.app'
    }

    // Generar contenido del email
    const { subject, html } = plantillas[tipo](datosCompletos)

    // Enviar email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FundLink <notificaciones@fundlink.app>',
        to: [destinatario.email],
        subject: subject,
        html: html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Error Resend:', result)
      throw new Error(result.message || 'Error enviando email')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email enviado exitosamente',
        id: result.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error en enviar-email:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error interno'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
