import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getNewsByCode } from '@/lib/stock-data'

interface Params {
  params: { symbol: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const symbol = params.symbol.toUpperCase()
  const hoursBack = Math.min(24 * 90, Math.max(1, Number(request.nextUrl.searchParams.get('hours_back') || '24')))
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '20')))

  const news = await getNewsByCode(symbol, { hoursBack, limit })
  return ok(
    {
      symbol,
      hours_back: hoursBack,
      total_count: news.length,
      news
    },
    '查询新闻成功'
  )
}
