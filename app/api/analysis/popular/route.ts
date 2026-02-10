import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { inferMarketFromCode, normalizeMarketName } from '@/lib/market'
import { userIdOrFilter } from '@/lib/mongo-helpers'

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

  const items = []
  for (const row of reports) {
    const symbol = String(row._id || '').toUpperCase()
    const mkt = normalizeMarketName(row.market || inferMarketFromCode(symbol))
    if (market && mkt !== market) continue

    const quote = await db
      .collection('stock_quotes')
      .find({ symbol })
      .sort({ trade_date: -1 })
      .limit(1)
      .next()

    items.push({
      symbol,
      name: String(row.name || symbol),
      market: mkt,
      current_price: Number(quote?.close ?? 0),
      change_percent: Number(quote?.pct_chg ?? 0),
      volume: Number(quote?.volume ?? 0),
      analysis_count: Number(row.count || 0)
    })
  }

  return ok(items, '获取热门股票成功')
}
