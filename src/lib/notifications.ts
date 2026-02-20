/**
 * FUNDLINK: Sistema de Notificaciones
 *
 * Helper para enviar notificaciones por email desde el frontend.
 * Usa la Edge Function 'enviar-email'.
 */

import { supabase } from './supabase'

// Tipos de notificación disponibles
export type TipoNotificacion =
  | 'nueva_oferta'
  | 'oferta_adjudicada'
  | 'subasta_cerrada'
  | 'compromiso_creado'
  | 'compromiso_por_vencer'
  | 'nueva_subasta'
  | 'documento_aprobado'
  | 'documento_rechazado'
  | 'cuenta_aprobada'

interface Destinatario {
  email: string
  nombre: string
}

interface NotificacionResult {
  success: boolean
  message: string
  id?: string
  error?: string
}

/**
 * Enviar notificación por email
 */
export async function enviarNotificacion(
  tipo: TipoNotificacion,
  destinatario: Destinatario,
  datos: Record<string, unknown>
): Promise<NotificacionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('enviar-email', {
      body: {
        tipo,
        destinatario,
        datos: {
          ...datos,
          url_plataforma: window.location.origin
        }
      }
    })

    if (error) {
      console.error('Error enviando notificación:', error)
      return {
        success: false,
        message: 'Error enviando notificación',
        error: error.message
      }
    }

    return {
      success: true,
      message: 'Notificación enviada',
      id: data?.id
    }
  } catch (err) {
    console.error('Error en enviarNotificacion:', err)
    return {
      success: false,
      message: 'Error inesperado',
      error: err instanceof Error ? err.message : 'Error desconocido'
    }
  }
}

// =====================
// HELPERS ESPECÍFICOS
// =====================

/**
 * Notificar al cliente que recibió una nueva oferta
 */
export async function notificarNuevaOferta(
  clienteEmail: string,
  clienteNombre: string,
  datos: {
    banco_nombre: string
    monto: number
    moneda: string
    tasa: number
    plazo: number
  }
): Promise<NotificacionResult> {
  return enviarNotificacion('nueva_oferta', { email: clienteEmail, nombre: clienteNombre }, {
    cliente_nombre: clienteNombre,
    ...datos
  })
}

/**
 * Notificar al banco que su oferta fue adjudicada
 */
export async function notificarOfertaAdjudicada(
  bancoEmail: string,
  bancoNombre: string,
  datos: {
    cliente_nombre: string
    monto: number
    moneda: string
    tasa: number
    op_id: string
    fecha_vencimiento: string
  }
): Promise<NotificacionResult> {
  return enviarNotificacion('oferta_adjudicada', { email: bancoEmail, nombre: bancoNombre }, {
    banco_nombre: bancoNombre,
    ...datos
  })
}

/**
 * Notificar a bancos invitados sobre nueva subasta
 */
export async function notificarNuevaSubasta(
  bancos: Array<{ email: string; nombre: string; entidad: string }>,
  datos: {
    cliente_nombre: string
    monto: number
    moneda: string
    plazo: number
    tipo_subasta: string
    duracion: number
  }
): Promise<NotificacionResult[]> {
  const resultados = await Promise.all(
    bancos.map(banco =>
      enviarNotificacion('nueva_subasta', { email: banco.email, nombre: banco.nombre }, {
        banco_nombre: banco.entidad,
        ...datos
      })
    )
  )
  return resultados
}

/**
 * Notificar compromiso creado a ambas partes
 */
export async function notificarCompromisoCreado(
  cliente: { email: string; nombre: string },
  banco: { email: string; nombre: string },
  datos: {
    op_id: string
    monto: number
    moneda: string
    tasa: number
    fecha_inicio: string
    fecha_vencimiento: string
  }
): Promise<{ cliente: NotificacionResult; banco: NotificacionResult }> {
  const [resultadoCliente, resultadoBanco] = await Promise.all([
    enviarNotificacion('compromiso_creado', cliente, datos),
    enviarNotificacion('compromiso_creado', banco, datos)
  ])

  return {
    cliente: resultadoCliente,
    banco: resultadoBanco
  }
}

/**
 * Notificar compromiso próximo a vencer
 */
export async function notificarCompromisoPorVencer(
  clienteEmail: string,
  clienteNombre: string,
  datos: {
    op_id: string
    banco_nombre: string
    monto: number
    moneda: string
    dias_restantes: number
    fecha_vencimiento: string
  }
): Promise<NotificacionResult> {
  return enviarNotificacion('compromiso_por_vencer', { email: clienteEmail, nombre: clienteNombre }, datos)
}

/**
 * Notificar documento KYC aprobado
 */
export async function notificarDocumentoAprobado(
  clienteEmail: string,
  clienteNombre: string,
  datos: {
    tipo_documento: string
    nombre_archivo: string
  }
): Promise<NotificacionResult> {
  return enviarNotificacion('documento_aprobado', { email: clienteEmail, nombre: clienteNombre }, {
    cliente_nombre: clienteNombre,
    ...datos,
    fecha_aprobacion: new Date().toLocaleDateString('es-GT')
  })
}

/**
 * Notificar documento KYC rechazado
 */
export async function notificarDocumentoRechazado(
  clienteEmail: string,
  clienteNombre: string,
  datos: {
    tipo_documento: string
    motivo_rechazo: string
  }
): Promise<NotificacionResult> {
  return enviarNotificacion('documento_rechazado', { email: clienteEmail, nombre: clienteNombre }, {
    cliente_nombre: clienteNombre,
    ...datos
  })
}

/**
 * Notificar cuenta aprobada
 */
export async function notificarCuentaAprobada(
  clienteEmail: string,
  clienteNombre: string
): Promise<NotificacionResult> {
  return enviarNotificacion('cuenta_aprobada', { email: clienteEmail, nombre: clienteNombre }, {
    cliente_nombre: clienteNombre
  })
}
