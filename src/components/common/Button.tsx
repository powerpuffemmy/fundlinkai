import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'small'
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'secondary', 
  children, 
  className = '',
  ...props 
}) => {
  const baseStyles = 'px-3 py-2 rounded-lg font-semibold transition-all duration-200'
  
  const variants = {
    primary: 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white hover:opacity-90',
    secondary: 'bg-[#0f172a] border border-[var(--line)] text-[var(--text)] hover:bg-[#1e293b]',
    small: 'bg-[#0f172a] border border-[var(--line)] text-[var(--text)] text-xs px-2.5 py-1.5 hover:bg-[#1e293b]'
  }

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}