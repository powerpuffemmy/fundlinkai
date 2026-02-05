// Utilidades para manejo de vencimientos de compromisos

export interface VencimientoInfo {
  diasRestantes: number
  texto: string
  color: string
  estado: 'vigente' | 'proximo' | 'critico' | 'vencido'
}

export const calcularVencimiento = (fechaVencimiento: string): VencimientoInfo => {
  const hoy = new Date()
  const vencimiento = new Date(fechaVencimiento)
  const diffTime = vencimiento.getTime() - hoy.getTime()
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  let estado: VencimientoInfo['estado']
  let color: string
  let texto: string

  if (diasRestantes < 0) {
    estado = 'vencido'
    color = 'text-gray-400'
    texto = 'Vencido'
  } else if (diasRestantes <= 7) {
    estado = 'critico'
    color = 'text-red-400'
    texto = `${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`
  } else if (diasRestantes <= 30) {
    estado = 'proximo'
    color = 'text-yellow-400'
    texto = `${diasRestantes} días`
  } else {
    estado = 'vigente'
    color = 'text-green-400'
    texto = `${diasRestantes} días`
  }

  return {
    diasRestantes,
    texto,
    color,
    estado
  }
}

export const getColorBgVencimiento = (estado: VencimientoInfo['estado']): string => {
  switch (estado) {
    case 'vencido':
      return 'bg-gray-900/20 border-gray-900/50'
    case 'critico':
      return 'bg-red-900/20 border-red-900/50'
    case 'proximo':
      return 'bg-yellow-900/20 border-yellow-900/50'
    case 'vigente':
      return 'bg-green-900/20 border-green-900/50'
    default:
      return 'bg-white/5 border-white/10'
  }
}

export const getIconoVencimiento = (estado: VencimientoInfo['estado']): string => {
  switch (estado) {
    case 'vencido':
      return '⏱️'
    case 'critico':
      return '🔴'
    case 'proximo':
      return '⚠️'
    case 'vigente':
      return '✅'
    default:
      return '📅'
  }
}
