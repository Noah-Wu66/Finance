import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

const defaultPreferences = {
  default_market: 'A股',
  default_depth: '标准',
  auto_refresh: true,
  refresh_interval: 3,
  language: 'zh-CN'
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const db = await getDb()
  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)
  const doc = await db
    .collection('users')
    .findOne({ _id: userObjectId }, { projection: { preferences: 1 } })

  return ok({ ...defaultPreferences, ...(doc?.preferences || {}) }, '获取偏好设置成功')
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json()) as Partial<typeof defaultPreferences>

  const nextPreferences = {
    ...defaultPreferences,
    ...body,
    refresh_interval: Number(body.refresh_interval || defaultPreferences.refresh_interval)
  }

  const db = await getDb()
  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)
  await db.collection('users').updateOne(
    { _id: userObjectId },
    {
      $set: {
        preferences: nextPreferences,
        updated_at: new Date()
      }
    }
  )

  return ok(nextPreferences, '偏好设置已保存')
}
