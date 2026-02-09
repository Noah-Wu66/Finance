import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getOperationLogStats } from '@/lib/operation-logs'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const days = Math.max(1, Number(request.nextUrl.searchParams.get('days') || '30'))
  const data = await getOperationLogStats(user.userId, days)
  return ok(data, '获取日志统计成功')
}
