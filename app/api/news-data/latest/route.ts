import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { getNewsByCode } from '@/lib/stock-data'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const symbol = (request.nextUrl.searchParams.get('symbol') || '').trim().toUpperCase()
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '10')))
  const hoursBack = Math.min(24 * 90, Math.max(1, Number(request.nextUrl.searchParams.get('hours_back') || '24')))

  let items
  if (symbol) {
    items = await getNewsByCode(symbol, { hoursBack, limit })
  } else {
    const db = await getDb()
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
    const rows = await db
      .collection('news_data')
      .find({ publish_time: { $gte: cutoff.toISOString() } })
      .sort({ publish_time: -1, created_at: -1 })
      .limit(limit)
      .toArray()

    items = rows.map((row) => ({
      id: String(row._id),
      title: String(row.title || ''),
      content: row.content ? String(row.content) : undefined,
      summary: row.summary ? String(row.summary) : undefined,
      source: row.source ? String(row.source) : undefined,
      publish_time: String(row.publish_time || row.created_at || new Date().toISOString()),
      url: row.url ? String(row.url) : undefined,
      symbol: row.symbol ? String(row.symbol) : undefined,
      category: row.category ? String(row.category) : undefined,
      sentiment: row.sentiment ? String(row.sentiment) : undefined,
      importance: Number(row.importance || 0),
      data_source: row.data_source ? String(row.data_source) : undefined
    }))
  }

  return ok(
    {
      symbol: symbol || undefined,
      limit,
      hours_back: hoursBack,
      total_count: items.length,
      news: items
    },
    '获取最新新闻成功'
  )
}
