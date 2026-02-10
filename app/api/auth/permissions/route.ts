import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const permissions = user.isAdmin
    ? ['*']
    : ['analysis:run', 'analysis:view', 'report:view', 'favorites:manage']
  const roles = user.isAdmin ? ['admin'] : ['user']

  return ok({ permissions, roles }, '获取权限成功')
}
