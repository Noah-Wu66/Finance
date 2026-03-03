import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockQuote } from '@/lib/tushare-data'
import { maybeObjectId } from '@/lib/mongo-helpers'
import { toNum } from '@/lib/utils'

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
  const uniqueCodes = Array.from(new Set(codes))
  const rows = await Promise.all(uniqueCodes.map(async (code) => {
    const result = await getOrSetLocalCache(`stock-quote:${code}`, () => fetchAStockQuote(code))
    if (!result.success || !result.data) return null
    return {
      code,
      data: result.data
    }
  }))

  for (const row of rows) {
    if (!row) continue
    quotes[row.code] = {
      price: toNum(row.data.close),
      pct_chg: toNum(row.data.pct_chg),
      trade_date: String(row.data.trade_date || '')
    }
  }

  return ok(quotes, '获取行情成功')
}
