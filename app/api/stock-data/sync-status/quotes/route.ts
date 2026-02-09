import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const db = await getDb()
  const latest = await db
    .collection('stock_quotes')
    .find({})
    .sort({ trade_date: -1, date: -1, updated_at: -1, created_at: -1 })
    .limit(1)
    .next()

  const total = await db.collection('stock_quotes').countDocuments()

  return ok(
    {
      status: latest ? 'ready' : 'empty',
      total_records: total,
      last_trade_date: latest?.trade_date || latest?.date || null,
      updated_at: latest?.updated_at || latest?.created_at || null
    },
    '获取行情同步状态成功'
  )
}
