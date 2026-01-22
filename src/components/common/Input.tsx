import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col">
      {label && (
        <label className="text-xs text-[var(--muted)] mb-1.5">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3 py-2.5 rounded-lg border border-[#253047] bg-[var(--field)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors ${className}`}
        {...props}
      />
    </div>
  )
}