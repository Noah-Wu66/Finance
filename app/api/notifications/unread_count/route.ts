import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const db = await getDb()
  const count = await db.collection('notifications').countDocuments({
    user_id: user.userId,
    status: 'unread'
  })

  return ok({ count }, 'ok')
}
