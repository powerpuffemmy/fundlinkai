import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="flex flex-col">
      {label && (
        <label className="text-xs text-[var(--muted)] mb-1.5">
          {label}
        </label>
      )}
      <select
        className={`w-full px-3 py-2.5 rounded-lg border border-[#253047] bg-[var(--field)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}