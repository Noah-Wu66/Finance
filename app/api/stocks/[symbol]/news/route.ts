import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getNewsByCode } from '@/lib/stock-data'

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get('days') || '30')))
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '50')))

  const items = await getNewsByCode(symbol, {
    hoursBack: days * 24,
    limit
  })

  return ok(
    {
      symbol,
      code: symbol,
      days,
      limit,
      include_announcements: request.nextUrl.searchParams.get('include_announcements') !== 'false',
      source: 'news_data',
      items: items.map((row) => ({
        title: row.title,
        source: row.source || 'unknown',
        time: row.publish_time,
        url: row.url || '',
        type: 'news'
      }))
    },
    '获取新闻成功'
  )
}
