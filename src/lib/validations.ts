/**
 * FUNDLINK: Validaciones de Seguridad
 * Validar inputs antes de enviar a Supabase
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

// =====================
// VALIDACIONES DE SUBASTA
// =====================

export function validateMonto(monto: number, moneda: 'USD' | 'GTQ'): ValidationResult {
  if (typeof monto !== 'number' || isNaN(monto)) {
    return { valid: false, error: 'El monto debe ser un número válido' }
  }
  if (monto <= 0) {
    return { valid: false, error: 'El monto debe ser mayor a 0' }
  }
  if (monto > 100_000_000) {
    return { valid: false, error: 'El monto excede el límite permitido (100M)' }
  }
  // Mínimos por moneda
  const minimo = moneda === 'USD' ? 1000 : 10000
  if (monto < minimo) {
    return { valid: false, error: `El monto mínimo es ${moneda === 'USD' ? '$1,000' : 'Q10,000'}` }
  }
  return { valid: true }
}

export function validatePlazo(plazo: number): ValidationResult {
  if (typeof plazo !== 'number' || isNaN(plazo)) {
    return { valid: false, error: 'El plazo debe ser un número válido' }
  }
  if (plazo < 1) {
    return { valid: false, error: 'El plazo mínimo es 1 día' }
  }
  if (plazo > 365) {
    return { valid: false, error: 'El plazo máximo es 365 días' }
  }
  if (!Number.isInteger(plazo)) {
    return { valid: false, error: 'El plazo debe ser un número entero' }
  }
  return { valid: true }
}

export function validateDuracion(duracion: number): ValidationResult {
  if (typeof duracion !== 'number' || isNaN(duracion)) {
    return { valid: false, error: 'La duración debe ser un número válido' }
  }
  if (duracion < 1) {
    return { valid: false, error: 'La duración mínima es 1 hora' }
  }
  if (duracion > 72) {
    return { valid: false, error: 'La duración máxima es 72 horas' }
  }
  return { valid: true }
}

export function validateTasa(tasa: number): ValidationResult {
  if (typeof tasa !== 'number' || isNaN(tasa)) {
    return { valid: false, error: 'La tasa debe ser un número válido' }
  }
  if (tasa <= 0) {
    return { valid: false, error: 'La tasa debe ser mayor a 0%' }
  }
  if (tasa > 50) {
    return { valid: false, error: 'La tasa no puede exceder 50%' }
  }
  return { valid: true }
}

export function validateTasaObjetivo(tasa: number | null | undefined): ValidationResult {
  if (tasa === null || tasa === undefined) {
    return { valid: true } // Es opcional
  }
  return validateTasa(tasa)
}

// =====================
// VALIDACIONES DE MONEDA
// =====================

const MONEDAS_PERMITIDAS = ['USD', 'GTQ'] as const
type Moneda = typeof MONEDAS_PERMITIDAS[number]

export function validateMoneda(moneda: string): ValidationResult {
  if (!MONEDAS_PERMITIDAS.includes(moneda as Moneda)) {
    return { valid: false, error: 'Moneda no permitida. Use USD o GTQ' }
  }
  return { valid: true }
}

// =====================
// VALIDACIONES DE TIPO SUBASTA
// =====================

const TIPOS_SUBASTA = ['abierta', 'sellada', 'holandesa', 'multi'] as const
type TipoSubasta = typeof TIPOS_SUBASTA[number]

export function validateTipoSubasta(tipo: string): ValidationResult {
  if (!TIPOS_SUBASTA.includes(tipo as TipoSubasta)) {
    return { valid: false, error: 'Tipo de subasta no válido' }
  }
  return { valid: true }
}

// =====================
// VALIDACIONES DE TEXTO
// =====================

export function validateTexto(texto: string, campo: string, minLength = 1, maxLength = 500): ValidationResult {
  if (typeof texto !== 'string') {
    return { valid: false, error: `${campo} debe ser texto` }
  }
  const trimmed = texto.trim()
  if (trimmed.length < minLength) {
    return { valid: false, error: `${campo} es requerido` }
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${campo} excede el límite de ${maxLength} caracteres` }
  }
  // Prevenir inyección SQL básica
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i
  if (sqlPatterns.test(trimmed)) {
    return { valid: false, error: `${campo} contiene caracteres no permitidos` }
  }
  return { valid: true }
}

export function validateEmail(email: string): ValidationResult {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email inválido' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Formato de email inválido' }
  }
  if (email.length > 254) {
    return { valid: false, error: 'Email demasiado largo' }
  }
  return { valid: true }
}

export function validateTelefono(telefono: string): ValidationResult {
  if (!telefono || telefono.trim() === '') {
    return { valid: true } // Opcional
  }
  // Solo números, espacios, guiones y paréntesis
  const telefonoRegex = /^[\d\s\-\(\)\+]+$/
  if (!telefonoRegex.test(telefono)) {
    return { valid: false, error: 'Formato de teléfono inválido' }
  }
  if (telefono.replace(/\D/g, '').length < 8) {
    return { valid: false, error: 'Teléfono debe tener al menos 8 dígitos' }
  }
  return { valid: true }
}

// =====================
// VALIDACIONES DE LÍMITES
// =====================

export function validateLimite(limite: number): ValidationResult {
  if (typeof limite !== 'number' || isNaN(limite)) {
    return { valid: false, error: 'El límite debe ser un número válido' }
  }
  if (limite <= 0) {
    return { valid: false, error: 'El límite debe ser mayor a 0' }
  }
  if (limite > 500_000_000) {
    return { valid: false, error: 'El límite excede el máximo permitido (500M)' }
  }
  return { valid: true }
}

// =====================
// VALIDACIÓN DE ARRAYS
// =====================

export function validateBancosInvitados(bancoIds: string[]): ValidationResult {
  if (!Array.isArray(bancoIds)) {
    return { valid: false, error: 'Lista de bancos inválida' }
  }
  if (bancoIds.length === 0) {
    return { valid: false, error: 'Debe seleccionar al menos un banco' }
  }
  if (bancoIds.length > 20) {
    return { valid: false, error: 'Máximo 20 bancos por subasta' }
  }
  // Validar que son UUIDs válidos
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  for (const id of bancoIds) {
    if (!uuidRegex.test(id)) {
      return { valid: false, error: 'ID de banco inválido' }
    }
  }
  return { valid: true }
}

// =====================
// VALIDACIÓN DE FECHAS
// =====================

export function validateFechaFutura(fecha: string, campo: string): ValidationResult {
  const date = new Date(fecha)
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${campo} no es una fecha válida` }
  }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (date < hoy) {
    return { valid: false, error: `${campo} debe ser una fecha futura` }
  }
  return { valid: true }
}

// =====================
// VALIDACIÓN COMPUESTA PARA SUBASTA
// =====================

interface DatosSubasta {
  tipo: string
  moneda: string
  monto: number
  plazo: number
  duracion: number
  tasa_objetivo?: number | null
  bancos_invitados: string[]
}

export function validateSubastaCompleta(datos: DatosSubasta): ValidationResult {
  const validaciones = [
    validateTipoSubasta(datos.tipo),
    validateMoneda(datos.moneda),
    validateMonto(datos.monto, datos.moneda as 'USD' | 'GTQ'),
    validatePlazo(datos.plazo),
    validateDuracion(datos.duracion),
    validateTasaObjetivo(datos.tasa_objetivo),
    validateBancosInvitados(datos.bancos_invitados),
  ]

  for (const resultado of validaciones) {
    if (!resultado.valid) {
      return resultado
    }
  }

  return { valid: true }
}

// =====================
// VALIDACIÓN COMPUESTA PARA OFERTA
// =====================

interface DatosOferta {
  tasa: number
  subasta_id: string
}

export function validateOfertaCompleta(datos: DatosOferta): ValidationResult {
  const tasaValidation = validateTasa(datos.tasa)
  if (!tasaValidation.valid) return tasaValidation

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(datos.subasta_id)) {
    return { valid: false, error: 'ID de subasta inválido' }
  }

  return { valid: true }
}

// =====================
// SANITIZACIÓN
// =====================

export function sanitizeText(texto: string): string {
  return texto
    .trim()
    .replace(/[<>]/g, '') // Remover caracteres HTML
    .slice(0, 1000) // Limitar longitud
}

export function sanitizeNumber(valor: unknown): number | null {
  if (typeof valor === 'number' && !isNaN(valor)) {
    return valor
  }
  if (typeof valor === 'string') {
    const num = parseFloat(valor.replace(/[^0-9.-]/g, ''))
    if (!isNaN(num)) return num
  }
  return null
}
