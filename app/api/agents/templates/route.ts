import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const db = await getDb()
  const rows = await db
    .collection('templates')
    .find({ user_id: user.userId, $or: [{ type: 'agent' }, { type: 'prompt_agent' }] })
    .sort({ updated_at: -1 })
    .toArray()

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
    '获取Agent模板成功'
  )
}
