'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
  secondary:
    'bg-[var(--bg-tertiary)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
  soft:
    'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-700/15 dark:text-primary-300 dark:hover:bg-primary-700/25',
  danger:
    'bg-danger-50 text-danger-700 hover:bg-danger-100 dark:bg-danger-700/15 dark:text-danger-400 dark:hover:bg-danger-700/25',
  ghost:
    'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-lg gap-2'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-150 ease-out
          cursor-pointer select-none
          disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
