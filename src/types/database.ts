export type UserRole = 'cliente' | 'banco_admin' | 'banco_mesa' | 'banco_auditor' | 'webadmin'

export type TipoSubasta = 'abierta' | 'sellada' | 'holandesa' | 'multi'

export type Moneda = 'USD' | 'GTQ'

export type EstadoSubasta = 'abierta' | 'esperando' | 'cerrada' | 'cancelada'

export type EstadoOferta = 'enviada' | 'aprobada' | 'rechazada' | 'adjudicada'

export type EstadoPush = 'vigente' | 'aceptada' | 'rechazada' | 'expirada'

export type EstadoCompromiso = 'vigente' | 'vencido' | 'renovado' | 'cancelado'

export interface User {
  id: string
  email: string
  role: UserRole
  nombre: string
  entidad: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Subasta {
  id: string
  cliente_id: string
  tipo: TipoSubasta
  moneda: Moneda
  monto: number
  plazo: number
  duracion: number
  tramos: number[]
  estado: EstadoSubasta
  aprobada: boolean
  created_at: string
  expires_at: string
  updated_at: string
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
  banco_id: string
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