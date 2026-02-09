import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

interface FavoritePayload {
  symbol?: string
  stock_code?: string
  stock_name?: string
  market?: string
  tags?: string[]
  notes?: string
  alert_price_high?: number | null
  alert_price_low?: number | null
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
    .findOne({ _id: userObjectId }, { projection: { favorite_stocks: 1 } })

  return ok(doc?.favorite_stocks || [], '获取自选股成功')
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json()) as FavoritePayload
  const stockCode = (body.symbol || body.stock_code || '').trim().toUpperCase()
  if (!stockCode) {
    return fail('请输入股票代码', 400)
  }

  const item = {
    stock_code: stockCode,
    stock_name: (body.stock_name || stockCode).trim(),
    market: (body.market || 'A股').trim(),
    added_at: new Date(),
    tags: Array.isArray(body.tags) ? body.tags : [],
    notes: body.notes || '',
    alert_price_high:
      typeof body.alert_price_high === 'number' && Number.isFinite(body.alert_price_high) ? body.alert_price_high : null,
    alert_price_low:
      typeof body.alert_price_low === 'number' && Number.isFinite(body.alert_price_low) ? body.alert_price_low : null
  }

  const db = await getDb()
  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)
  const users = db.collection('users')

  await users.updateOne(
    {
      _id: userObjectId,
      'favorite_stocks.stock_code': { $ne: stockCode }
    },
    {
      $push: {
        favorite_stocks: item
      },
      $set: {
        updated_at: new Date()
      }
    } as any
  )

  const doc = await users.findOne({ _id: userObjectId }, { projection: { favorite_stocks: 1 } })
  return ok(doc?.favorite_stocks || [], '已添加到自选股')
}
