export function inferMarketFromCode(symbol: string): string {
  const code = symbol.trim().toUpperCase()

  if (code.endsWith('.BJ')) return '京市A股'
  if (code.startsWith('68')) {
    return '科创板'
  }

  if (code.startsWith('8') || code.startsWith('4') || code.endsWith('.BJ')) {
    return '京市A股'
  }

  if (code.startsWith('15') || code.startsWith('16') || code.startsWith('50') || code.endsWith('.FOF')) {
    return '基金'
  }

  if (code.startsWith('399') || code.endsWith('.HI') || code.endsWith('.BKZS')) {
    return '指数'
  }

  if (code.endsWith('.HK')) return '港股'

  return 'A股'
}

export function normalizeMarketName(market?: string): string {
  if (!market) return 'A股'

  const m = market.toLowerCase()
  if (m.includes('科创')) return '科创板'
  if (m.includes('京市') || m.includes('北交所') || m.includes('bj')) return '京市A股'
  if (m.includes('基金') || m.includes('etf') || m.includes('fof')) return '基金'
  if (m.includes('指数')) return '指数'
  if (m.includes('港股') || m.includes('hk')) return '港股'
  if (m.includes('a股') || m.includes('沪') || m.includes('深')) return 'A股'

  return 'A股'
}

export function getMarketType(code: string): 'a_stock' | 'kc_stock' | 'bj_stock' | 'fund' | 'index' | 'hk_stock' {
  const market = inferMarketFromCode(code)
  const normalized = normalizeMarketName(market)
  
  switch (normalized) {
    case '科创板':
      return 'kc_stock'
    case '京市A股':
      return 'bj_stock'
    case '基金':
      return 'fund'
    case '指数':
      return 'index'
    case '港股':
      return 'hk_stock'
    default:
      return 'a_stock'
  }
}
