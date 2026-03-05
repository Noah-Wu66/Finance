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
  const cache = db.collection('app_cache')

  const [totalFiles, stockDataCount, newsDataCount, analysisDataCount, sizeRows] = await Promise.all([
    cache.countDocuments(),
    cache.countDocuments({ type: 'stock' }),
    cache.countDocuments({ type: 'news' }),
    cache.countDocuments({ type: 'analysis' }),
    cache
      .aggregate([
        {
          $group: {
            _id: null,
            totalSize: { $sum: { $bsonSize: '$$ROOT' } },
            maxSize: { $max: { $bsonSize: '$$ROOT' } }
          }
        }
      ])
      .toArray()
  ])

  const sizeStat = sizeRows[0] as { totalSize?: number; maxSize?: number } | undefined

  return ok(
    {
      totalFiles,
      totalSize: Number(sizeStat?.totalSize || 0),
      maxSize: Number(sizeStat?.maxSize || 0),
      stockDataCount,
      newsDataCount,
      analysisDataCount
    },
    '获取缓存统计成功'
  )
}