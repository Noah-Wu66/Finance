import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockQuote } from '@/lib/mairui-data'
import { inferMarketFromCode, normalizeMarketName } from '@/lib/market'
import { userIdOrFilter } from '@/lib/mongo-helpers'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const marketFilter = request.nextUrl.searchParams.get('market') || undefined
  const market = marketFilter ? normalizeMarketName(marketFilter) : undefined
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '10')))

  const db = await getDb()

  const reports = await db
    .collection('analysis_reports')
    .aggregate([
      { $match: userIdOrFilter(user.userId) },
      { $group: { _id: '$stock_symbol', count: { $sum: 1 }, name: { $last: '$stock_name' }, market: { $last: '$market_type' } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ])
    .toArray()

  const items = (await Promise.all(reports.map(async (row) => {
    const symbol = String(row._id || '').toUpperCase()
    const mkt = normalizeMarketName(row.market || inferMarketFromCode(symbol))
    if (market && mkt !== market) return null

    const quoteResult = await getOrSetLocalCache(
      `quote:cached:${symbol}`,
      () => fetchAStockQuote(symbol),
      LOCAL_CACHE_ONE_MINUTE_MS
    )
    const quote = (quoteResult.data || {}) as Record<string, unknown>

    return {
      symbol,
      name: String(row.name || symbol),
      market: mkt,
      current_price: toNum(quote.close),
      change_percent: toNum(quote.pct_chg),
      volume: toNum(quote.volume ?? quote.vol),
      analysis_count: Number(row.count || 0)
    }
  }))).filter(Boolean)

  return ok(items, '获取热门股票成功')
}
