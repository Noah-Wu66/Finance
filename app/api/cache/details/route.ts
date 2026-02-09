import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('page_size') || '20')))
  const skip = (page - 1) * pageSize

  const db = await getDb()
  const cache = db.collection('app_cache')

  const [total, rows] = await Promise.all([
    cache.countDocuments(),
    cache.find({}).sort({ created_at: -1 }).skip(skip).limit(pageSize).toArray()
  ])

  const items = rows.map((row) => ({
    type: String(row.type || 'unknown'),
    symbol: String(row.symbol || row.key || '-'),
    size: Number(row.size || 0),
    created_at: row.created_at || new Date(),
    last_accessed: row.last_accessed || row.updated_at || row.created_at || new Date(),
    hit_count: Number(row.hit_count || 0)
  }))

  return ok(
    {
      items,
      total,
      page,
      page_size: pageSize
    },
    '获取缓存详情成功'
  )
}
