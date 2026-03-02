import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { fetchAStockQuote } from '@/lib/mairui-data'
import { maybeObjectId } from '@/lib/mongo-helpers'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface Payload {
  data_source?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const dataSource = (body.data_source || 'tushare').trim()

  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)

  const db = await getDb()
  const users = db.collection('users')

  const userDoc = await users.findOne(
    { _id: userObjectId },
    { projection: { favorite_stocks: 1 } }
  )

  const favorites = Array.isArray(userDoc?.favorite_stocks) ? userDoc.favorite_stocks : []
  let successCount = 0
  let failedCount = 0
  const symbols: string[] = []

  for (const item of favorites) {
    const symbol = String(item?.stock_code || item?.symbol || '').trim().toUpperCase()
    if (!symbol) {
      failedCount += 1
      continue
    }

    const result = await fetchAStockQuote(symbol)
    if (!result.success || !result.data) {
      failedCount += 1
      continue
    }

    const data = result.data
    const price = toNum(data.close)
    const changePercent = toNum(data.pct_chg)
    const volume = toNum(data.volume ?? data.vol)

    await users.updateOne(
      { _id: userObjectId, 'favorite_stocks.stock_code': symbol },
      {
        $set: {
          'favorite_stocks.$.current_price': price,
          'favorite_stocks.$.change_percent': changePercent,
          'favorite_stocks.$.volume': volume,
          updated_at: new Date()
        }
      }
    )

    successCount += 1
    symbols.push(symbol)
  }

  return ok(
    {
      total: favorites.length,
      success_count: successCount,
      failed_count: failedCount,
      symbols,
      data_source: dataSource,
      message: `已同步 ${successCount} 只股票实时行情`
    },
    '同步完成'
  )
}
