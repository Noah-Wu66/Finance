export function inferMarketFromCode(symbol: string): string {
  const code = symbol.trim().toUpperCase()

  if (/^[0-9]{6}$/.test(code)) {
    return 'A股'
  }

  if (/^[0-9]{5}$/.test(code)) {
    return '港股'
  }

  if (/^[A-Z]{1,5}$/.test(code)) {
    return '美股'
  }

  return 'A股'
}

export function normalizeMarketName(market?: string) {
  if (!market) return 'A股'
  if (market.includes('港')) return '港股'
  if (market.includes('美') || market.toLowerCase().includes('us')) return '美股'
  return 'A股'
}
