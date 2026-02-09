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
  const exec = db.collection('web_executions')

  const [total, completed, failed, running] = await Promise.all([
    exec.countDocuments({ user_id: user.userId }),
    exec.countDocuments({ user_id: user.userId, status: 'completed' }),
    exec.countDocuments({ user_id: user.userId, status: { $in: ['failed', 'canceled', 'stopped'] } }),
    exec.countDocuments({ user_id: user.userId, status: 'running' })
  ])

  const popularRows = await exec
    .aggregate([
      { $match: { user_id: user.userId } },
      { $group: { _id: '$symbol', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
    .toArray()

  const popularStocks = popularRows.map((row) => ({
    symbol: String(row._id || ''),
    name: String(row._id || ''),
    count: Number(row.count || 0)
  }))

  return ok(
    {
      total_analyses: total,
      successful_analyses: completed,
      failed_analyses: failed,
      running_analyses: running,
      avg_duration: 0,
      total_tokens: 0,
      total_cost: 0,
      popular_stocks: popularStocks,
      analysis_by_date: [],
      analysis_by_market: []
    },
    '获取统计成功'
  )
}
