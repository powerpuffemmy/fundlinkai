import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-lg ${className}`}>
      {children}
    </div>
  )
}