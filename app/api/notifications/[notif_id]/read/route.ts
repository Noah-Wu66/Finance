import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Params {
  params: { notif_id: string }
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const id = params.notif_id
  if (!ObjectId.isValid(id)) {
    return fail('通知ID无效', 400)
  }

  const db = await getDb()
  const res = await db.collection('notifications').updateOne(
    { _id: new ObjectId(id), user_id: user.userId },
    { $set: { status: 'read' } }
  )

  if (!res.matchedCount) {
    return fail('通知不存在', 404)
  }

  return ok({ id }, 'ok')
}
