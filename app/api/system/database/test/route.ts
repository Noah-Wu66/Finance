import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  try {
    const db = await getDb()
    const started = Date.now()
    const ping = await db.command({ ping: 1 })
    const cost = Date.now() - started

    return ok(
      {
        mongodb: {
          success: ping.ok === 1,
          response_time_ms: cost,
          message: 'MongoDB 连接正常'
        },
        redis: {
          success: true,
          response_time_ms: 0,
          message: '现场执行模式下无需 Redis'
        },
        overall: true
      },
      '连接测试成功'
    )
  } catch (error) {
    return fail('连接测试失败', 500, error instanceof Error ? error.message : String(error))
  }
}
