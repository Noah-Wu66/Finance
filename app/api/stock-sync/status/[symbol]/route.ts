import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getDailyQuotesByCode, getFundamentalsByCode } from '@/lib/stock-data'

interface Params {
  params: { symbol: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const symbol = params.symbol.toUpperCase()
  const [quotes, financial] = await Promise.all([
    getDailyQuotesByCode(symbol, { limit: 1 }),
    getFundamentalsByCode(symbol)
  ])

  const latestQuote = quotes[0]

  return ok(
    {
      symbol,
      historical_data: {
        last_sync: latestQuote?.trade_date || null,
        last_date: latestQuote?.trade_date || null,
        total_records: quotes.length
      },
      financial_data: {
        last_sync: financial?.updated_at || null,
        last_report_period: financial?.updated_at || null,
        total_records: financial ? 1 : 0
      }
    },
    '获取同步状态成功'
  )
}
