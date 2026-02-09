import type { ReactNode } from 'react'

type Status = 'running' | 'completed' | 'failed' | 'stopped' | 'canceled' | 'pending'

const statusConfig: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  running: {
    bg: 'bg-primary-50 dark:bg-primary-700/15',
    text: 'text-primary-700 dark:text-primary-300',
    dot: 'bg-primary-500',
    label: '运行中'
  },
  completed: {
    bg: 'bg-success-50 dark:bg-success-700/15',
    text: 'text-success-700 dark:text-success-300',
    dot: 'bg-success-500',
    label: '已完成'
  },
  failed: {
    bg: 'bg-danger-50 dark:bg-danger-700/15',
    text: 'text-danger-700 dark:text-danger-400',
    dot: 'bg-danger-500',
    label: '失败'
  },
  stopped: {
    bg: 'bg-warning-50 dark:bg-warning-700/15',
    text: 'text-warning-700 dark:text-warning-400',
    dot: 'bg-warning-500',
    label: '已停止'
  },
  canceled: {
    bg: 'bg-warning-50 dark:bg-warning-700/15',
    text: 'text-warning-700 dark:text-warning-400',
    dot: 'bg-warning-500',
    label: '已取消'
  },
  pending: {
    bg: 'bg-[var(--bg-tertiary)]',
    text: 'text-[var(--fg-secondary)]',
    dot: 'bg-[var(--fg-muted)]',
    label: '等待中'
  }
}

interface StatusBadgeProps {
  status: Status
  label?: string
  children?: ReactNode
}

export function StatusBadge({ status, label, children }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full
        px-2.5 py-0.5 text-xs font-semibold
        ${config.bg} ${config.text}
      `}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {children || label || config.label}
    </span>
  )
}
