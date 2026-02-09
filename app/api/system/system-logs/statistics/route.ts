import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getOperationLogStats } from '@/lib/operation-logs'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const days = Math.max(1, Number(request.nextUrl.searchParams.get('days') || '7'))
  const stats = await getOperationLogStats(user.userId, days)

  return ok(
    {
      total_files: 2,
      total_size_mb: 0,
      error_files: stats.failed_logs > 0 ? 1 : 0,
      recent_errors: [],
      log_types: {
        webapi: 1,
        other: 1
      }
    },
    '获取系统日志统计成功'
  )
}
