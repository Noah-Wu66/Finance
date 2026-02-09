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
  const items = Object.entries(stats.by_date)
    .map(([date, value]) => ({
      date,
      count: value.count,
      cost: value.cost
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return ok({ items }, '获取每日成本成功')
}
