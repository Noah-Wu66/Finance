import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getStockBasicByCode, getLatestQuoteByCode } from '@/lib/stock-data'

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const [basic, quote] = await Promise.all([getStockBasicByCode(symbol), getLatestQuoteByCode(symbol)])
  if (!basic && !quote) {
    return fail('股票不存在', 404)
  }

  return ok(
    {
      symbol,
      stock_code: symbol,
      stock_name: basic?.name || symbol,
      market: basic?.market || 'A股',
      current_price: quote?.close ?? null,
      change_percent: quote?.pct_chg ?? null,
      volume: quote?.volume ?? null,
      industry: basic?.industry || null,
      total_mv: basic?.total_mv || null
    },
    '获取股票基础信息成功'
  )
}
