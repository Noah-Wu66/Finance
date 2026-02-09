import type { TdHTMLAttributes, ThHTMLAttributes, HTMLAttributes, TableHTMLAttributes } from 'react'

export function Table({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className}`} {...props} />
    </div>
  )
}

export function Thead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />
}

export function Tbody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-[var(--border)] ${className}`} {...props} />
}

export function Tr({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`transition-colors hover:bg-[var(--bg-hover)] ${className}`} {...props} />
}

export function Th({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`
        px-4 py-3 text-left text-xs font-medium
        text-[var(--fg-muted)] uppercase tracking-wider
        border-b border-[var(--border)]
        bg-[var(--bg-secondary)]
        ${className}
      `}
      {...props}
    />
  )
}

export function Td({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`px-4 py-3 text-sm text-[var(--fg-secondary)] ${className}`}
      {...props}
    />
  )
}
