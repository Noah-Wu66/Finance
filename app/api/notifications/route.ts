import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const status = request.nextUrl.searchParams.get('status') || 'all'
  const type = request.nextUrl.searchParams.get('type') || undefined
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('page_size') || '20')))
  const skip = (page - 1) * pageSize

  const query: Record<string, unknown> = { user_id: user.userId }
  if (status === 'read' || status === 'unread') {
    query.status = status
  }
  if (type) {
    query.type = type
  }

  const db = await getDb()
  const notifications = db.collection('notifications')

  const [total, rows] = await Promise.all([
    notifications.countDocuments(query),
    notifications.find(query).sort({ created_at: -1 }).skip(skip).limit(pageSize).toArray()
  ])

  const items = rows.map((item) => ({
    id: String(item._id),
    title: String(item.title || ''),
    content: item.content ? String(item.content) : undefined,
    type: (item.type as 'analysis' | 'alert' | 'system') || 'system',
    status: (item.status as 'unread' | 'read') || 'unread',
    created_at: item.created_at,
    link: item.link ? String(item.link) : undefined,
    source: item.source ? String(item.source) : undefined
  }))

  return ok(
    {
      items,
      total,
      page,
      page_size: pageSize
    },
    'ok'
  )
}
