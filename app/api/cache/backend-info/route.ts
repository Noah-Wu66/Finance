import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    {
      system: 'next-app-router-live',
      primary_backend: 'mongodb',
      fallback_enabled: false,
      mongodb_available: true,
      redis_available: false
    },
    '获取缓存后端信息成功'
  )
}
