import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getDailyQuotesByCode } from '@/lib/stock-data'

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const period = (request.nextUrl.searchParams.get('period') || 'day') as 'day' | 'week' | 'month' | '5m' | '15m' | '30m' | '60m'
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '120')))
  const adj = (request.nextUrl.searchParams.get('adj') || 'none') as 'none' | 'qfq' | 'hfq'

  const rows = await getDailyQuotesByCode(symbol, { limit })
  const items = rows.map((row) => ({
    time: row.trade_date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    amount: row.amount
  }))

  return ok(
    {
      symbol,
      code: symbol,
      period,
      limit,
      adj,
      source: 'stock_quotes',
      items
    },
    '获取K线成功'
  )
}
