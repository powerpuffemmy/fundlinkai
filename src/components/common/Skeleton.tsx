import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  count?: number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  count = 1
}) => {
  const baseClass = 'animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]'
  
  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  }[variant]

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '4rem')
  }

  if (count === 1) {
    return (
      <div 
        className={`${baseClass} ${variantClass} ${className}`}
        style={style}
      />
    )
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className={`${baseClass} ${variantClass} ${className}`}
          style={style}
        />
      ))}
    </div>
  )
}

// Skeleton para tablas
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 6 
}) => (
  <div className="space-y-3">
    {/* Header */}
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height="2rem" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, colIndex) => (
          <Skeleton key={colIndex} height="3rem" />
        ))}
      </div>
    ))}
  </div>
)

// Skeleton para cards
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
  <div className={`grid ${count > 1 ? 'grid-cols-1 md:grid-cols-3' : ''} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-[var(--card)] border border-[var(--line)] rounded-lg p-6">
        <Skeleton height="1rem" width="60%" className="mb-3" />
        <Skeleton height="2.5rem" width="40%" />
      </div>
    ))}
  </div>
)

// Skeleton para lista de compromisos
export const CompromisosSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-[var(--card)] border border-[var(--line)] rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <Skeleton height="1.5rem" width="30%" />
          <Skeleton height="1.5rem" width="15%" />
        </div>
        <div className="space-y-2">
          <Skeleton height="1rem" width="80%" />
          <Skeleton height="1rem" width="60%" />
        </div>
      </div>
    ))}
  </div>
)
