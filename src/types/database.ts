export type UserRole = 'cliente_admin' | 'cliente_usuario' | 'banco_admin' | 'banco_mesa' | 'banco_auditor' | 'webadmin'

export type TipoSubasta = 'rapida' | 'programada'

export type Moneda = 'USD' | 'GTQ'

export type EstadoSubasta = 'abierta' | 'esperando' | 'cerrada' | 'cancelada' | 'expirada'

export type EstadoOferta = 'enviada' | 'aprobada' | 'rechazada' | 'adjudicada'

export type EstadoPush = 'vigente' | 'aceptada' | 'rechazada' | 'expirada'

export type EstadoCompromiso = 'vigente' | 'vencido' | 'renovado' | 'cancelado'

export type TipoDocumentoKYC = 'cedula' | 'rtu' | 'patente' | 'estados_financieros' | 'otro'

export type EstadoDocumentoKYC = 'pendiente' | 'aprobado' | 'rechazado'

export type EstadoSolicitudColocacion = 'abierta' | 'cerrada' | 'cancelada'

export type EstadoOfertaColocacion = 'enviada' | 'aceptada' | 'rechazada'

export interface User {
  id: string
  email: string
  role: UserRole
  nombre: string
  entidad: string
  activo: boolean
  ai_pro?: boolean
  logo_url?: string
  created_at: string
  updated_at: string
  telefono?: string
  onboarding_completado?: boolean
  aprobado_por_admin?: boolean
  fecha_aprobacion?: string
  aprobado_por?: string
  notas_aprobacion?: string
  primer_login?: boolean
}

export interface Subasta {
  id: string
  cliente_id: string
  tipo: TipoSubasta
  moneda: Moneda
  monto: number
  plazo: number
  duracion: number
  tasa_objetivo?: number | null
  tramos: number[]
  estado: EstadoSubasta
  aprobada: boolean
  created_at: string
  expires_at: string
  updated_at: string
  cliente?: {
    nombre: string
    entidad: string
  }
}

export interface Oferta {
  id: string
  subasta_id: string
  banco_id: string
  tasa: number
  estado: EstadoOferta
  aprobada_por_admin: boolean
  notas?: string
  created_at: string
  updated_at: string
}

export interface OfertaPush {
  id: string
  banco_id: string
  cliente_id: string
  moneda: Moneda
  monto: number
  tasa: number
  plazo: number
  estado: EstadoPush
  expires_at: string
  created_at: string
  updated_at: string
}

export interface Compromiso {
  id: string
  op_id: string
  cliente_id: string
  banco_id: string | null
  subasta_id?: string
  oferta_id?: string
  monto: number
  moneda: Moneda
  tasa: number
  plazo: number
  fecha_inicio: string
  fecha_vencimiento: string
  estado: EstadoCompromiso
  notas?: string
  es_externo?: boolean
  contraparte_nombre?: string
  documento_url?: string
  created_at: string
  updated_at: string
}

export interface ClienteBancoLimite {
  id: string
  cliente_id: string
  banco_id: string
  limite_monto: number
  monto_utilizado: number
  activo: boolean
  created_at: string
  updated_at: string
  banco?: {
    id: string
    nombre: string
    entidad: string
    logo_url?: string
  }
}

export interface DocumentoKYC {
  id: string
  cliente_id: string
  tipo_documento: TipoDocumentoKYC
  nombre_archivo: string
  url_archivo: string
  descripcion?: string
  estado: EstadoDocumentoKYC
  revisado_por?: string
  fecha_revision?: string
  notas_revision?: string
  created_at: string
  updated_at: string
}

export interface ReglasBanco {
  id: string
  banco_id: string
  max_exposicion_cliente: number
  max_exposicion_moneda: number
  max_tenor_dias: number
  rating_minimo: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface SolicitudColocacion {
  id: string
  cliente_id: string
  moneda: Moneda
  monto?: number | null
  plazo: number
  tasa_objetivo?: number | null
  fecha_cierre: string
  estado: EstadoSolicitudColocacion
  notas?: string
  created_at: string
  updated_at: string
  cliente?: { nombre: string; entidad: string }
}

export interface OfertaColocacion {
  id: string
  solicitud_id: string
  banco_id: string
  tasa: number
  monto: number
  notas?: string
  estado: EstadoOfertaColocacion
  created_at: string
  updated_at: string
  banco?: { nombre: string; entidad: string }
}

export interface Auditoria {
  id: string
  user_id?: string
  user_email?: string
  user_role?: string
  accion: string
  detalle?: string
  metadata?: Record<string, any>
  ip_address?: string
  created_at: string
}
