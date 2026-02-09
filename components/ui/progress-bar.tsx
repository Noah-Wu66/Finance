interface ProgressBarProps {
  value: number
  size?: 'sm' | 'md'
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, size = 'md', className = '', showLabel = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex-1 ${height} rounded-full bg-[var(--bg-tertiary)] overflow-hidden`}>
        <div
          className={`${height} rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-[width] duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-[var(--fg-muted)] tabular-nums w-10 text-right">
          {clamped}%
        </span>
      )}
    </div>
  )
}
