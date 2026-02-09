import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

interface Params {
  params: { symbol: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const symbol = params.symbol.trim().toUpperCase()
  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)

  const db = await getDb()
  const doc = await db.collection('users').findOne(
    {
      _id: userObjectId,
      'favorite_stocks.stock_code': symbol
    },
    {
      projection: { _id: 1 }
    }
  )

  return ok(
    {
      symbol,
      stock_code: symbol,
      is_favorite: Boolean(doc)
    },
    '检查完成'
  )
}
