import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { fetchAStockDaily } from '@/lib/mairui-data'
import { getDailyQuotesByCode } from '@/lib/stock-data'

interface Params {
  params: Promise<{ market: string; code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { code, market } = await params

  const startDate = request.nextUrl.searchParams.get('start_date') || undefined
  const endDate = request.nextUrl.searchParams.get('end_date') || undefined
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '100')))

  let quotes = await getDailyQuotesByCode(code, {
    startDate,
    endDate,
    limit
  })

  if (quotes.length === 0) {
    await fetchAStockDaily(code, limit)
    quotes = await getDailyQuotesByCode(code, {
      startDate,
      endDate,
      limit
    })
  }

  return ok(
    {
      code: code.toUpperCase(),
      market: market.toUpperCase(),
      quotes,
      total: quotes.length
    },
    '获取日线成功'
  )
}
