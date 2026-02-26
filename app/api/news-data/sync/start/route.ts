import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface Payload {
  symbol?: string | null
  data_sources?: string[] | null
  hours_back?: number
  max_news_per_source?: number
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const requested = (body.data_sources || []).map((item) => String(item).trim().toLowerCase())
  const dataSources = requested.filter((item) => item === 'mairui')
  return ok(
    {
      sync_type: body.symbol ? 'single_stock' : 'market',
      symbol: body.symbol || undefined,
      data_sources: dataSources.length > 0 ? dataSources : ['mairui'],
      hours_back: body.hours_back || 24,
      max_news_per_source: body.max_news_per_source || 50
    },
    '现场执行模式下新闻同步由页面手动触发，不再后台排队'
  )
}
