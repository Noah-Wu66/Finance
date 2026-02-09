import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

interface Params {
  params: { code: string }
}

interface UpdatePayload {
  tags?: string[]
  notes?: string
  alert_price_high?: number | null
  alert_price_low?: number | null
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const stockCode = params.code.trim().toUpperCase()
  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)

  const body = (await request.json().catch(() => ({}))) as UpdatePayload
  const patch: Record<string, unknown> = {}

  if (Array.isArray(body.tags)) patch['favorite_stocks.$.tags'] = body.tags
  if (typeof body.notes === 'string') patch['favorite_stocks.$.notes'] = body.notes
  if (body.alert_price_high === null || typeof body.alert_price_high === 'number') {
    patch['favorite_stocks.$.alert_price_high'] = body.alert_price_high ?? null
  }
  if (body.alert_price_low === null || typeof body.alert_price_low === 'number') {
    patch['favorite_stocks.$.alert_price_low'] = body.alert_price_low ?? null
  }

  if (Object.keys(patch).length === 0) {
    return fail('没有可更新字段', 400)
  }

  const db = await getDb()
  const users = db.collection('users')
  const res = await users.updateOne(
    {
      _id: userObjectId,
      'favorite_stocks.stock_code': stockCode
    },
    {
      $set: {
        ...patch,
        updated_at: new Date()
      }
    }
  )

  if (!res.matchedCount) {
    return fail('自选股不存在', 404)
  }

  return ok({ stock_code: stockCode }, '自选股更新成功')
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const { code } = params
  const stockCode = code.trim().toUpperCase()
  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)

  const db = await getDb()
  const users = db.collection('users')
  await users.updateOne(
    { _id: userObjectId },
    {
      $pull: {
        favorite_stocks: {
          stock_code: stockCode
        }
      },
      $set: {
        updated_at: new Date()
      }
    }
  )

  return ok({ stock_code: stockCode }, '已移除自选股')
}
