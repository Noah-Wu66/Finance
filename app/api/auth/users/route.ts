import { NextRequest } from 'next/server'

import { getRequestUser, toPublicUserProfile } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const current = await getRequestUser(request)
  if (!current) return fail('未登录', 401)
  if (!current.isAdmin) return fail('仅管理员可查看用户列表', 403)

  const db = await getDb()
  const rows = await db.collection('users').find({}).sort({ created_at: -1 }).toArray()
  return ok(rows.map((row) => toPublicUserProfile(row as Record<string, unknown>)), '获取用户列表成功')
}
