import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockFinancialSummary, fetchAStockProfileSummary, fetchAStockQuote } from '@/lib/mairui-data'
import { normalizeMarketName } from '@/lib/market'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const symbol = (request.nextUrl.searchParams.get('symbol') || '').trim().toUpperCase()
  if (!symbol) {
    return fail('缺少股票代码', 400)
  }

  const market = normalizeMarketName(request.nextUrl.searchParams.get('market') || undefined)
  const [profileResult, quoteResult, financialResult] = await Promise.all([
    getOrSetLocalCache(`profile:${symbol}`, () => fetchAStockProfileSummary(symbol), LOCAL_CACHE_ONE_MINUTE_MS),
    fetchAStockQuote(symbol),
    getOrSetLocalCache(`financial:${symbol}`, () => fetchAStockFinancialSummary(symbol), LOCAL_CACHE_ONE_MINUTE_MS)
  ])

  if (!profileResult.success && !quoteResult.success && !financialResult.success) {
    return fail('获取股票信息失败', 404)
  }

  const profile = (profileResult.data || {}) as { name?: string }
  const quote = (quoteResult.data || {}) as Record<string, unknown>
  const financial = financialResult.data

  const currentPrice = toNum(quote.close)
  const prevPrice = toNum(quote.pre_close)
  const change = Number.isFinite(Number(quote.change)) ? toNum(quote.change) : currentPrice - prevPrice
  const changePercent = Number.isFinite(Number(quote.pct_chg))
    ? toNum(quote.pct_chg)
    : (prevPrice > 0 ? (change / prevPrice) * 100 : 0)

  return ok(
    {
      symbol,
      name: String(profile.name || symbol),
      market,
      current_price: currentPrice,
      change,
      change_percent: changePercent,
      volume: toNum(quote.volume ?? quote.vol),
      market_cap: toNum(quote.total_mv),
      pe_ratio: toNum(financial?.pe ?? quote.pe),
      pb_ratio: toNum(financial?.pb ?? quote.pb),
      dividend_yield: toNum(quote.dv_ratio)
    },
    '获取股票信息成功'
  )
}
