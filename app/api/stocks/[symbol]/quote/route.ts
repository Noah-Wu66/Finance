import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getLatestQuoteByCode } from '@/lib/stock-data'

interface Params {
  params: { symbol: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const symbol = params.symbol.toUpperCase()
  const quote = await getLatestQuoteByCode(symbol)
  if (!quote) return fail('行情不存在', 404)

  return ok(
    {
      symbol,
      code: symbol,
      full_symbol: symbol,
      market: '',
      price: quote.close,
      change_percent: quote.pct_chg,
      amount: quote.amount,
      prev_close: 0,
      turnover_rate: quote.turnover_rate,
      amplitude: quote.amplitude,
      trade_date: quote.trade_date,
      updated_at: new Date().toISOString()
    },
    '获取股票行情成功'
  )
}
