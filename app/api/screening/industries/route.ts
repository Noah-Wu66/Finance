import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const db = await getDb()
  const rows = await db
    .collection('stock_basic_info')
    .aggregate([
      { $match: { industry: { $exists: true, $ne: '' } } },
      { $group: { _id: '$industry', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 200 }
    ])
    .toArray()

  const industries = rows.map((row) => ({
    value: String(row._id),
    label: String(row._id),
    count: Number(row.count || 0)
  }))

  return ok(
    {
      industries,
      total: industries.length
    },
    '获取行业列表成功'
  )
}
