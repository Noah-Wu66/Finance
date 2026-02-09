import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getPositions } from '@/lib/paper-trading'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const items = await getPositions(user.userId)
  return ok({ items }, '获取持仓成功')
}
