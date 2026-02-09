import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-[var(--fg-faint)] mb-3">{icon}</div>}
      {title && <h3 className="text-sm font-medium text-[var(--fg-secondary)] m-0">{title}</h3>}
      {description && <p className="mt-1 text-sm text-[var(--fg-muted)] m-0 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
