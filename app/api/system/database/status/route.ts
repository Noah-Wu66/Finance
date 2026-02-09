import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  try {
    const db = await getDb()
    const ping = await db.command({ ping: 1 })

    return ok(
      {
        mongodb: {
          connected: ping.ok === 1,
          host: process.env.MONGODB_HOST || 'MongoDB Atlas/Vercel',
          port: Number(process.env.MONGODB_PORT || 27017),
          database: db.databaseName,
          connected_at: new Date().toISOString()
        },
        redis: {
          connected: false,
          host: 'N/A',
          port: 0,
          database: 0,
          error: '现场执行模式下未启用 Redis 后台服务'
        }
      },
      '获取数据库状态成功'
    )
  } catch (error) {
    return fail('获取数据库状态失败', 500, error instanceof Error ? error.message : String(error))
  }
}
