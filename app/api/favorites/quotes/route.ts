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
  const doc = await db
    .collection('users')
    .findOne({ _id: userObjectId }, { projection: { favorite_stocks: 1 } })

  const favorites = Array.isArray(doc?.favorite_stocks) ? doc.favorite_stocks : []
  if (favorites.length === 0) return ok({}, '暂无自选股')

  const codes = favorites
    .map((f: Record<string, unknown>) => String(f.stock_code || f.symbol || '').trim().toUpperCase())
    .filter(Boolean)

  if (codes.length === 0) return ok({}, '暂无自选股')

  const quotes: Record<string, { price: number; pct_chg: number; trade_date: string }> = {}

  for (const code of codes) {
    const row = await db
      .collection('stock_quotes')
      .find({ symbol: code })
      .sort({ trade_date: -1 })
      .limit(1)
      .next()

    if (row) {
      quotes[code] = {
        price: Number(row.close ?? 0),
        pct_chg: Number(row.pct_chg ?? 0),
        trade_date: String(row.trade_date || '')
      }
    }
  }

  return ok(quotes, '获取行情成功')
}
