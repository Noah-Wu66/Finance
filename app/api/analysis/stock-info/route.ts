import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { normalizeMarketName } from '@/lib/market'

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
  const db = await getDb()

  const [basic, latestQuote, prevQuote, financial] = await Promise.all([
    db.collection('stock_basic_info').findOne({ symbol }),
    db
      .collection('stock_quotes')
      .find({ symbol })
      .sort({ trade_date: -1, updated_at: -1 })
      .limit(1)
      .next(),
    db
      .collection('stock_quotes')
      .find({ symbol })
      .sort({ trade_date: -1, updated_at: -1 })
      .skip(1)
      .limit(1)
      .next(),
    db
      .collection('financial_data')
      .find({ symbol })
      .sort({ report_date: -1, updated_at: -1 })
      .limit(1)
      .next()
  ])

  const currentPrice = Number(latestQuote?.close ?? 0)
  const prevPrice = Number(prevQuote?.close ?? currentPrice)
  const change = currentPrice - prevPrice
  const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0

  return ok(
    {
      symbol,
      name: String(basic?.name || symbol),
      market,
      current_price: currentPrice,
      change,
      change_percent: changePercent,
      volume: Number(latestQuote?.volume ?? 0),
      market_cap: Number(basic?.total_mv ?? basic?.market_cap ?? 0),
      pe_ratio: Number(financial?.pe ?? 0),
      pb_ratio: Number(financial?.pb ?? 0),
      dividend_yield: Number(financial?.dividend_yield ?? 0)
    },
    '获取股票信息成功'
  )
}
