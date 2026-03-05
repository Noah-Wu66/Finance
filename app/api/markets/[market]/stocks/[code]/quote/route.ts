import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockQuote, hasTushareLicence } from '@/lib/tushare-data'
import { toNum } from '@/lib/utils'

interface Params {
  params: Promise<{ market: string; code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  if (!hasTushareLicence()) {
    return fail('未配置 TUSHARE_TOKEN', 503)
  }

  const { market: rawMarket, code: rawCode } = await params
  const market = rawMarket.toUpperCase()
  const code = rawCode.toUpperCase()
  const result = await getOrSetLocalCache(`stock-quote:${code}`, () => fetchAStockQuote(code))
  if (!result.success || !result.data) {
    return fail('获取行情失败，上游数据暂不可用', 503, result.message)
  }

  const quote = result.data
  return ok(
    {
      code,
      market,
      close: toNum(quote.close),
      pct_chg: toNum(quote.pct_chg),
      open: toNum(quote.open),
      high: toNum(quote.high),
      low: toNum(quote.low),
      volume: toNum(quote.volume ?? quote.vol),
      amount: toNum(quote.amount),
      trade_date: String(quote.trade_date || ''),
      currency: 'CNY',
      turnover_rate: toNum(quote.turnover_rate),
      amplitude: toNum(quote.amplitude),
      updated_at: new Date().toISOString()
    },
    '获取行情成功'
  )
}