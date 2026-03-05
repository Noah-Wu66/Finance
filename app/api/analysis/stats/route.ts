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
  const usage = db.collection('usage_records')

  const [total, completed, failed, running, popularRows, durationRows, tokenRows, byDateRows, byMarketRows] = await Promise.all([
    exec.countDocuments({ user_id: user.userId }),
    exec.countDocuments({ user_id: user.userId, status: 'completed' }),
    exec.countDocuments({ user_id: user.userId, status: { $in: ['failed', 'canceled', 'stopped'] } }),
    exec.countDocuments({ user_id: user.userId, status: 'running' }),
    exec
      .aggregate([
        { $match: { user_id: user.userId } },
        { $group: { _id: '$symbol', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ])
      .toArray(),
    exec
      .aggregate([
        {
          $match: {
            user_id: user.userId,
            status: 'completed',
            created_at: { $exists: true },
            updated_at: { $exists: true }
          }
        },
        {
          $project: {
            duration_sec: {
              $divide: [
                { $subtract: [{ $toLong: '$updated_at' }, { $toLong: '$created_at' }] },
                1000
              ]
            }
          }
        },
        { $match: { duration_sec: { $gte: 0 } } },
        { $group: { _id: null, avg_duration: { $avg: '$duration_sec' } } }
      ])
      .toArray(),
    usage
      .aggregate([
        { $match: { user_id: user.userId } },
        {
          $group: {
            _id: null,
            input_tokens: { $sum: { $ifNull: ['$input_tokens', 0] } },
            output_tokens: { $sum: { $ifNull: ['$output_tokens', 0] } }
          }
        }
      ])
      .toArray(),
    exec
      .aggregate([
        { $match: { user_id: user.userId, created_at: { $exists: true } } },
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } } } },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 14 }
      ])
      .toArray(),
    exec
      .aggregate([
        { $match: { user_id: user.userId } },
        {
          $group: {
            _id: {
              $cond: [
                { $or: [{ $eq: ['$market', null] }, { $eq: ['$market', ''] }] },
                '未知',
                '$market'
              ]
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
      .toArray()
  ])

  const popularStocks = popularRows.map((row) => ({
    symbol: String(row._id || ''),
    name: String(row._id || ''),
    count: Number(row.count || 0)
  }))

  const avgDuration = Number((Number(durationRows[0]?.avg_duration || 0)).toFixed(2))
  const totalTokens = Number(tokenRows[0]?.input_tokens || 0) + Number(tokenRows[0]?.output_tokens || 0)

  return ok(
    {
      total_analyses: total,
      successful_analyses: completed,
      failed_analyses: failed,
      running_analyses: running,
      avg_duration: avgDuration,
      total_tokens: totalTokens,
      popular_stocks: popularStocks,
      analysis_by_date: byDateRows
        .map((row) => ({ date: String(row._id || ''), count: Number(row.count || 0) }))
        .reverse(),
      analysis_by_market: byMarketRows.map((row) => ({ market: String(row._id || '未知'), count: Number(row.count || 0) }))
    },
    '获取统计成功'
  )
}