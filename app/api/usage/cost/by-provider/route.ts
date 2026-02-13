import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { computeUsageStatistics } from '@/lib/usage'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const stats = await computeUsageStatistics(user.userId)
  const items = Object.entries(stats.by_provider).map(([provider, count]) => ({
    provider,
    count
  }))

  return ok({ items }, '获取供应商统计成功')
}
