import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

interface Payload {
  data_source?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const dataSource = (body.data_source || 'mairui').trim()

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

    const quote = await db
      .collection('stock_quotes')
      .find({ symbol })
      .sort({ trade_date: -1 })
      .limit(1)
      .next()

    if (!quote) {
      failedCount += 1
      continue
    }

    const price = Number(quote.close ?? 0)
    const changePercent = Number(quote.pct_chg ?? 0)
    const volume = Number(quote.volume ?? 0)

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
