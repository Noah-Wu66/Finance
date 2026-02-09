import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Payload {
  name?: string
  color?: string
  sort_order?: number
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const db = await getDb()
  const rows = await db.collection('tags').find({ user_id: user.userId }).sort({ sort_order: 1, created_at: -1 }).toArray()
  const items = rows.map((row) => ({
    id: String(row._id),
    name: String(row.name || ''),
    color: String(row.color || '#409eff'),
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at || new Date(),
    updated_at: row.updated_at || row.created_at || new Date()
  }))

  return ok(items, '获取标签成功')
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const name = (body.name || '').trim()
  if (!name) return fail('标签名不能为空', 400)

  const now = new Date()
  const db = await getDb()
  const result = await db.collection('tags').insertOne({
    user_id: user.userId,
    name,
    color: body.color || '#409eff',
    sort_order: Number(body.sort_order || 0),
    created_at: now,
    updated_at: now
  })

  return ok(
    {
      id: result.insertedId.toHexString(),
      name,
      color: body.color || '#409eff',
      sort_order: Number(body.sort_order || 0),
      created_at: now,
      updated_at: now
    },
    '标签创建成功'
  )
}
