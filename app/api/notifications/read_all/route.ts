import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const db = await getDb()
  const res = await db.collection('notifications').updateMany(
    { user_id: user.userId, status: 'unread' },
    { $set: { status: 'read' } }
  )

  return ok({ updated: res.modifiedCount }, 'ok')
}
