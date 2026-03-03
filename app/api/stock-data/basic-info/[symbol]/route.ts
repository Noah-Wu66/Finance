import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockProfileSummary, fetchAStockQuote } from '@/lib/tushare-data'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const [profileResult, quoteResult] = await Promise.all([
    getOrSetLocalCache(`profile:${symbol}`, () => fetchAStockProfileSummary(symbol), LOCAL_CACHE_ONE_MINUTE_MS),
    getOrSetLocalCache(`stock-quote:${symbol}`, () => fetchAStockQuote(symbol), LOCAL_CACHE_ONE_MINUTE_MS)
  ])

  if (!profileResult.success && !quoteResult.success) {
    return fail('股票不存在', 404)
  }

  const profile = (profileResult.data || {}) as { name?: string; industry?: string }
  const quote = (quoteResult.data || {}) as Record<string, unknown>

  return ok(
    {
      symbol,
      stock_code: symbol,
      stock_name: String(profile.name || symbol),
      market: 'A股',
      current_price: quoteResult.success ? toNum(quote.close) : null,
      change_percent: quoteResult.success ? toNum(quote.pct_chg) : null,
      volume: quoteResult.success ? toNum(quote.volume ?? quote.vol) : null,
      industry: profile.industry ? String(profile.industry) : null,
      total_mv: quoteResult.success ? toNum(quote.total_mv) : null
    },
    '获取股票基础信息成功'
  )
}
