import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-gradient-to-b from-white/[0.04] to-white/[0.02] border border-[var(--line)] rounded-xl p-4 shadow-lg ${className}`}>
      {children}
    </div>
  )
}