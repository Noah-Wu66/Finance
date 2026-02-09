import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

const baseInputClass = `
  w-full rounded-lg border border-[var(--input-border)]
  bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)]
  placeholder:text-[var(--fg-muted)]
  outline-none transition-all duration-150
  focus:border-[var(--input-focus)] focus:ring-2 focus:ring-[var(--input-focus)]/20
  disabled:opacity-50 disabled:cursor-not-allowed
`

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    return (
      <div className="grid gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-[var(--fg-secondary)]">
            {label}
          </label>
        )}
        <input ref={ref} id={id} className={`${baseInputClass} ${error ? 'border-danger-500!' : ''} ${className}`} {...props} />
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className = '', id, children, ...props }, ref) => {
    return (
      <div className="grid gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-[var(--fg-secondary)]">
            {label}
          </label>
        )}
        <select ref={ref} id={id} className={`${baseInputClass} ${className}`} {...props}>
          {children}
        </select>
      </div>
    )
  }
)
Select.displayName = 'Select'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = '', id, ...props }, ref) => {
    return (
      <div className="grid gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-[var(--fg-secondary)]">
            {label}
          </label>
        )}
        <textarea ref={ref} id={id} className={`${baseInputClass} resize-y min-h-[80px] ${className}`} {...props} />
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
