import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { fetchAStockQuote } from '@/lib/mairui-data'

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
  const result = await fetchAStockQuote(symbol)
  if (!result.success || !result.data) {
    return fail('行情不存在', 404, result.message)
  }

  const quote = result.data

  return ok(
    {
      symbol,
      code: symbol,
      full_symbol: symbol,
      market: '',
      price: toNum(quote.close),
      change_percent: toNum(quote.pct_chg),
      amount: toNum(quote.amount),
      prev_close: toNum(quote.pre_close),
      turnover_rate: toNum(quote.turnover_rate),
      amplitude: toNum(quote.amplitude),
      trade_date: String(quote.trade_date || ''),
      updated_at: new Date().toISOString()
    },
    '获取股票行情成功'
  )
}
