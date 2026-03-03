export function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function toYmd(value: unknown): string {
  const source = String(value || '').trim()
  if (!source) return ''
  const compact = source.replace(/[^0-9]/g, '')
  if (compact.length >= 8) return compact.slice(0, 8)
  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear().toString()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}
