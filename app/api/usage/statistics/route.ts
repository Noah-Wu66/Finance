import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { computeUsageStatistics } from '@/lib/usage'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const data = await computeUsageStatistics(user.userId)
  return ok(data, '获取使用统计成功')
}
