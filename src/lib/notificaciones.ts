/**
 * notificaciones.ts — Helper para envío de emails desde el frontend.
 *
 * Todos los envíos son fire-and-forget: nunca lanzan error al llamador.
 * La Edge Function `enviar-email` resuelve el email del destinatario
 * usando su UUID, sin exponer emails en el frontend.
 */

import { supabase } from './supabase'

type TipoNotificacion =
  | 'nueva_oferta'
  | 'oferta_adjudicada'
  | 'subasta_cerrada'
  | 'nueva_subasta'
  | 'oferta_colocacion_recibida'
  | 'oferta_pendiente_aprobacion'
  | 'oferta_aprobada_mesa'
  | 'oferta_rechazada_mesa'
  | 'compromiso_confirmado'
  | 'compromiso_ejecutado'
  | 'compromiso_por_vencer'
  | 'documento_aprobado'
  | 'documento_rechazado'
  | 'cuenta_aprobada'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://app.fundlink.app'

// ── Core: envía un email sin bloquear al llamador ────────────────────────────
const enviar = async (
  tipo: TipoNotificacion,
  destinatario_id: string,
  datos: Record<string, unknown>
): Promise<void> => {
  try {
    const { error } = await supabase.functions.invoke('enviar-email', {
      body: { tipo, destinatario_id, datos: { ...datos, url_plataforma: APP_URL } }
    })
    if (error) console.warn(`[notificaciones] ${tipo} →`, error.message)
    else console.log(`[notificaciones] ✓ ${tipo} → ${destinatario_id}`)
  } catch (err) {
    console.warn('[notificaciones] Error (ignorado):', err)
  }
}

// ── Helpers específicos ───────────────────────────────────────────────────────

/** Banco envió oferta en subasta → notificar al cliente */
export const notifNuevaOferta = (
  clienteId: string,
  datos: { cliente_nombre: string; banco_nombre: string; monto: number | string; moneda: string; tasa: number; plazo: number }
) => enviar('nueva_oferta', clienteId, datos)

/** Cliente adjudicó → notificar al banco ganador */
export const notifOfertaAdjudicada = (
  bancoId: string,
  datos: { banco_nombre: string; cliente_nombre: string; op_id: string; monto: number | string; moneda: string; tasa: number; fecha_vencimiento: string }
) => enviar('oferta_adjudicada', bancoId, datos)

/** Banco (admin o mesa) envió oferta de colocación aprobada → notificar cliente */
export const notifOfertaColocacionRecibida = (
  clienteId: string,
  datos: { cliente_nombre: string; banco_nombre: string; monto: number | string; moneda: string; tasa: number; plazo: number; notas?: string }
) => enviar('oferta_colocacion_recibida', clienteId, datos)

/** Banco mesa envió oferta → banco_admin para aprobar */
export const notifOfertaPendienteAdmin = (
  adminId: string,
  datos: { banco_mesa_nombre: string; cliente_nombre: string; monto: number | string; moneda: string; tasa: number }
) => enviar('oferta_pendiente_aprobacion', adminId, datos)

/** Banco admin aprobó oferta de mesa */
export const notifOfertaAprobadaMesa = (
  bancoMesaId: string,
  datos: { banco_mesa_nombre: string; cliente_nombre: string; monto: number | string; moneda: string; tasa: number }
) => enviar('oferta_aprobada_mesa', bancoMesaId, datos)

/** Banco admin rechazó oferta de mesa */
export const notifOfertaRechazadaMesa = (
  bancoMesaId: string,
  datos: { banco_mesa_nombre: string; cliente_nombre: string; monto: number | string; moneda: string; tasa: number }
) => enviar('oferta_rechazada_mesa', bancoMesaId, datos)

/** Compromiso confirmado → notificar tanto al cliente como al banco */
export const notifCompromisoConfirmado = (
  destinatarioId: string,
  datos: { destinatario_nombre: string; contraparte: string; op_id: string; monto: number | string; moneda: string; tasa: number; plazo: number; fecha_inicio: string; fecha_vencimiento: string }
) => enviar('compromiso_confirmado', destinatarioId, datos)

/** Banco marcó compromiso como ejecutado → notificar cliente */
export const notifCompromisoEjecutado = (
  clienteId: string,
  datos: { cliente_nombre: string; banco_nombre: string; op_id: string; monto: number | string; moneda: string; tasa: number; fecha_ejecucion: string; fecha_vencimiento: string }
) => enviar('compromiso_ejecutado', clienteId, datos)

/** Alerta de vencimiento próximo → notificar cliente */
export const notifVencimientoProximo = (
  clienteId: string,
  datos: { cliente_nombre: string; banco_nombre: string; op_id: string; monto: number | string; moneda: string; tasa: number; dias_restantes: number; fecha_vencimiento: string }
) => enviar('compromiso_por_vencer', clienteId, datos)

/** Cuenta aprobada → bienvenida al cliente */
export const notifCuentaAprobada = (
  clienteId: string,
  datos: { cliente_nombre: string }
) => enviar('cuenta_aprobada', clienteId, datos)

/** Documento KYC aprobado */
export const notifDocumentoAprobado = (
  clienteId: string,
  datos: { cliente_nombre: string; tipo_documento: string; nombre_archivo: string; fecha_aprobacion: string }
) => enviar('documento_aprobado', clienteId, datos)

/** Documento KYC rechazado */
export const notifDocumentoRechazado = (
  clienteId: string,
  datos: { cliente_nombre: string; tipo_documento: string; motivo_rechazo: string }
) => enviar('documento_rechazado', clienteId, datos)
