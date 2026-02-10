import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold text-[var(--fg)] m-0">{title}</h2>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-[var(--fg-muted)] m-0">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </div>
  )
}
