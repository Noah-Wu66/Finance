import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)

  const db = await getDb()
  const doc = await db.collection('users').findOne(
    { _id: userObjectId },
    { projection: { favorite_stocks: 1 } }
  )

  const tagSet = new Set<string>()
  const favorites = Array.isArray(doc?.favorite_stocks) ? doc.favorite_stocks : []
  for (const item of favorites) {
    const tags = Array.isArray(item?.tags) ? item.tags : []
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.trim()) {
        tagSet.add(tag.trim())
      }
    }
  }

  return ok(Array.from(tagSet).sort((a, b) => a.localeCompare(b)), '获取标签成功')
}
