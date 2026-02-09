import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId, userIdOrFilter } from '@/lib/mongo-helpers'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const db = await getDb()
  const userObjectId = maybeObjectId(user.userId)

  const [running, completed, failed, stopped, reports, favorites] = await Promise.all([
    db.collection('web_executions').countDocuments({ user_id: user.userId, status: 'running' }),
    db.collection('web_executions').countDocuments({ user_id: user.userId, status: 'completed' }),
    db.collection('web_executions').countDocuments({ user_id: user.userId, status: 'failed' }),
    db.collection('web_executions').countDocuments({ user_id: user.userId, status: { $in: ['stopped', 'canceled'] } }),
    db.collection('analysis_reports').countDocuments(userIdOrFilter(user.userId)),
    db
      .collection('users')
      .findOne(userObjectId ? { _id: userObjectId } : { username: user.username }, { projection: { favorite_stocks: 1 } })
  ])

  return ok(
    {
      running,
      completed,
      failed,
      stopped,
      reports,
      favorites: Array.isArray(favorites?.favorite_stocks) ? favorites.favorite_stocks.length : 0
    },
    '获取看板数据成功'
  )
}
