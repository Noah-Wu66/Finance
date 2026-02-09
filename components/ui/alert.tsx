import type { ReactNode } from 'react'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

const variantStyles: Record<AlertVariant, string> = {
  error: 'bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-700/10 dark:border-danger-700/30 dark:text-danger-400',
  success: 'bg-success-50 border-success-200 text-success-700 dark:bg-success-700/10 dark:border-success-700/30 dark:text-success-400',
  warning: 'bg-warning-50 border-warning-200 text-warning-700 dark:bg-warning-700/10 dark:border-warning-700/30 dark:text-warning-400',
  info: 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-700/10 dark:border-primary-700/30 dark:text-primary-400'
}

interface AlertProps {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}

export function Alert({ variant = 'error', children, className = '' }: AlertProps) {
  return (
    <div
      className={`
        rounded-lg border px-4 py-3 text-sm
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
