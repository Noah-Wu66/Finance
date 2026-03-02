import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { fetchAStockQuote } from '@/lib/mairui-data'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface Params {
  params: Promise<{ market: string; code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  const result = await fetchAStockQuote(code)
  if (!result.success || !result.data) {
    return fail('行情不存在', 404, result.message)
  }

  const quote = result.data
  return ok(
    {
      code,
      close: toNum(quote.close),
      pct_chg: toNum(quote.pct_chg),
      open: toNum(quote.open),
      high: toNum(quote.high),
      low: toNum(quote.low),
      volume: toNum(quote.volume ?? quote.vol),
      amount: toNum(quote.amount),
      trade_date: String(quote.trade_date || ''),
      currency: '',
      turnover_rate: toNum(quote.turnover_rate),
      amplitude: toNum(quote.amplitude),
      updated_at: new Date().toISOString()
    },
    '获取行情成功'
  )
}
