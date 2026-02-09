import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { searchStockBasics } from '@/lib/stock-data'

interface Params {
  params: { market: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '20')))
  if (!q) {
    return ok({ stocks: [], total: 0 }, '请输入关键词')
  }

  const marketCode = params.market.toUpperCase()
  const marketMap: Record<string, string> = {
    CN: 'A股',
    HK: '港股',
    US: '美股'
  }
  const marketName = marketMap[marketCode] || marketCode

  const all = await searchStockBasics(q, limit * 2)
  const stocks = all.filter((item) => item.market === marketName).slice(0, limit)
  return ok({ stocks, total: stocks.length }, '搜索成功')
}
