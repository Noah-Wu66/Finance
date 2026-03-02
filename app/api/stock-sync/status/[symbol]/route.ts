import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockFinancialSummary, fetchAStockQuote } from '@/lib/tushare-data'

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const [quoteResult, financialResult] = await Promise.all([
    getOrSetLocalCache(`quote:cached:${symbol}`, () => fetchAStockQuote(symbol), LOCAL_CACHE_ONE_MINUTE_MS),
    getOrSetLocalCache(`financial:${symbol}`, () => fetchAStockFinancialSummary(symbol), LOCAL_CACHE_ONE_MINUTE_MS)
  ])

  const quote = (quoteResult.data || {}) as Record<string, unknown>
  const reportDate = financialResult.data?.reportDate || null
  const tradeDate = quote.trade_date ? String(quote.trade_date) : null

  return ok(
    {
      symbol,
      historical_data: {
        last_sync: quoteResult.success ? tradeDate : null,
        last_date: quoteResult.success ? tradeDate : null,
        total_records: quoteResult.success ? 1 : 0
      },
      financial_data: {
        last_sync: financialResult.success ? new Date().toISOString() : null,
        last_report_period: reportDate,
        total_records: financialResult.success ? 1 : 0
      }
    },
    '获取同步状态成功'
  )
}
