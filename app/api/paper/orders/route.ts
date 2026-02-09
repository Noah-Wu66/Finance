import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getOrders } from '@/lib/paper-trading'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '50')))
  const items = await getOrders(user.userId, limit)
  return ok({ items }, '获取订单成功')
}
