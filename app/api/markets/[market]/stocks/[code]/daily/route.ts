import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getDailyQuotesByCode } from '@/lib/stock-data'

interface Params {
  params: { market: string; code: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const startDate = request.nextUrl.searchParams.get('start_date') || undefined
  const endDate = request.nextUrl.searchParams.get('end_date') || undefined
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '100')))

  const quotes = await getDailyQuotesByCode(params.code, {
    startDate,
    endDate,
    limit
  })

  return ok(
    {
      code: params.code.toUpperCase(),
      market: params.market.toUpperCase(),
      quotes,
      total: quotes.length
    },
    '获取日线成功'
  )
}
