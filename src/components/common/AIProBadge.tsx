import React from 'react'

interface AIProBadgeProps {
  isAIPro?: boolean
  size?: 'small' | 'medium'
  showLabel?: boolean
}

export const AIProBadge: React.FC<AIProBadgeProps> = ({ 
  isAIPro = false, 
  size = 'medium',
  showLabel = true 
}) => {
  if (!isAIPro) return null

  const sizeClasses = {
    small: 'text-[10px] px-1.5 py-0.5',
    medium: 'text-xs px-2 py-1'
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded border bg-purple-900/20 border-purple-500/50 text-purple-200 font-semibold ${sizeClasses[size]}`}
      title="Banco con acceso a funcionalidades AI Pro"
    >
      ⭐ {showLabel && 'AI Pro'}
    </span>
  )
}
