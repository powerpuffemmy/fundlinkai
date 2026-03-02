export const formatMoney = (amount: number, currency: 'USD' | 'GTQ' = 'GTQ'): string => {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const addDays = (date: string, days: number): string => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result.toISOString().split('T')[0]
}

export const generateOpId = (): string => {
  return 'OP-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
}

export const daysBetween = (date1: string, date2: string): number => {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export const formatDuracion = (minutos: number): string => {
  if (minutos >= 1440) {
    const dias = Math.round(minutos / 1440)
    return `${dias} día${dias !== 1 ? 's' : ''}`
  }
  if (minutos >= 60) {
    const horas = Math.round(minutos / 60)
    return `${horas} hora${horas !== 1 ? 's' : ''}`
  }
  return `${minutos} min`
}

export const formatTipoSubasta = (tipo: string): string => {
  const labels: Record<string, string> = {
    rapida: 'Rápida',
    programada: 'Programada',
    abierta: 'Abierta',
    sellada: 'Sellada',
    holandesa: 'Holandesa',
    multi: 'Multi-tramo'
  }
  return labels[tipo] || tipo
}