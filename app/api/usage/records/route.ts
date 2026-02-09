import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { loadUsageRecords } from '@/lib/usage'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '100')))
  const records = await loadUsageRecords(user.userId, limit)

  return ok(
    {
      records,
      total: records.length
    },
    '获取使用记录成功'
  )
}
