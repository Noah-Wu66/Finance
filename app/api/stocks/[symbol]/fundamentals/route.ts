import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockFinancialSummary, fetchAStockProfileSummary, fetchAStockQuote, hasTushareLicence } from '@/lib/tushare-data'

function pickNum(...values: unknown[]): number {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return 0
}

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  if (!hasTushareLicence()) {
    return fail('未配置 TUSHARE_TOKEN', 503)
  }

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const [profileResult, financialResult, quoteResult] = await Promise.all([
    getOrSetLocalCache(`profile:${symbol}`, () => fetchAStockProfileSummary(symbol), LOCAL_CACHE_ONE_MINUTE_MS),
    getOrSetLocalCache(`financial:${symbol}`, () => fetchAStockFinancialSummary(symbol), LOCAL_CACHE_ONE_MINUTE_MS),
    getOrSetLocalCache(`quote:cached:${symbol}`, () => fetchAStockQuote(symbol), LOCAL_CACHE_ONE_MINUTE_MS)
  ])

  if (!profileResult.success && !financialResult.success && !quoteResult.success) {
    console.error(`[fundamentals] all sources failed for ${symbol}`, {
      profile: profileResult.message,
      financial: financialResult.message,
      quote: quoteResult.message
    })
    return fail('获取基本面失败，上游数据暂不可用', 503)
  }

  const profile = (profileResult.data || {}) as { name?: string; industry?: string }
  const financial = financialResult.data
  const quote = (quoteResult.data || {}) as Record<string, unknown>
  const updatedAt = new Date().toISOString()

  return ok(
    {
      symbol,
      code: symbol,
      full_symbol: symbol,
      name: profile.name || symbol,
      industry: profile.industry || null,
      market: 'A股',
      sector: null,
      pe: pickNum(financial?.pe, quote.pe),
      pb: pickNum(financial?.pb, quote.pb),
      ps: pickNum(quote.ps),
      pe_ttm: pickNum(quote.pe_ttm),
      pb_mrq: pickNum(quote.pb),
      ps_ttm: pickNum(quote.ps_ttm),
      roe: pickNum(financial?.roe),
      debt_ratio: null,
      total_mv: pickNum(quote.total_mv),
      circ_mv: pickNum(quote.circ_mv),
      turnover_rate: pickNum(quote.turnover_rate),
      volume_ratio: pickNum(quote.volume_ratio),
      pe_is_realtime: true,
      pe_source: quoteResult.success ? 'daily_basic' : 'fina_indicator',
      pe_updated_at: updatedAt,
      updated_at: updatedAt
    },
    '获取基本面成功'
  )
}
