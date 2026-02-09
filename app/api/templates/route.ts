import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Payload {
  name?: string
  description?: string
  type?: string
  config?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const type = request.nextUrl.searchParams.get('type') || undefined
  const query: Record<string, unknown> = { user_id: user.userId }
  if (type) query.type = type

  const db = await getDb()
  const rows = await db.collection('templates').find(query).sort({ updated_at: -1, created_at: -1 }).toArray()

  return ok(
    rows.map((row) => ({
      id: String(row._id),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      type: row.type ? String(row.type) : undefined,
      config: row.config || {},
      created_at: row.created_at,
      updated_at: row.updated_at
    })),
    '获取模板成功'
  )
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const name = (body.name || '').trim()
  if (!name) return fail('模板名不能为空', 400)

  const now = new Date()
  const db = await getDb()
  const result = await db.collection('templates').insertOne({
    user_id: user.userId,
    name,
    description: body.description || '',
    type: body.type || 'general',
    config: body.config || {},
    created_at: now,
    updated_at: now
  })

  return ok(
    {
      id: result.insertedId.toHexString(),
      name,
      description: body.description || '',
      type: body.type || 'general',
      config: body.config || {},
      created_at: now,
      updated_at: now
    },
    '模板创建成功'
  )
}
